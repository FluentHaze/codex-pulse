/**
 * 读取 Codex 项目目录，为会话补充项目名；目录元数据缺失时仍保留原始工作路径。
 */
import { readFile } from 'node:fs/promises';
import { win32, posix } from 'node:path';
export interface LocalProject {
  id: string;
  name: string;
  roots: string[];
}
const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const canonical = (path: string) =>
  /^[a-z]:[\\/]|^\\\\/i.test(path)
    ? win32.normalize(path).replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase()
    : posix.normalize(path).replace(/\/+$/, '');
export function parseProjectCatalog(value: unknown) {
  const state = record(value);
  const projects: LocalProject[] = Object.values(record(state['local-projects'])).flatMap(
    (value) => {
      const item = record(value);
      return typeof item.id === 'string' &&
        typeof item.name === 'string' &&
        Array.isArray(item.rootPaths)
        ? [
            {
              id: item.id,
              name: item.name.slice(0, 160),
              roots: item.rootPaths.filter((root): root is string => typeof root === 'string'),
            },
          ]
        : [];
    },
  );
  const assignments = record(state['thread-project-assignments']);
  return {
    projects,
    match(sessionId: string, cwd: string) {
      const assigned = record(assignments[sessionId]);
      const explicit =
        assigned.projectKind === 'local'
          ? projects.find((project) => project.id === assigned.projectId)
          : undefined;
      if (explicit) return explicit;
      const path = canonical(cwd);
      return projects
        .flatMap((project) => project.roots.map((root) => ({ project, root: canonical(root) })))
        .filter((item) => item.root && (path === item.root || path.startsWith(item.root + '/')))
        .sort((a, b) => b.root.length - a.root.length)[0]?.project;
    },
  };
}
export async function readProjectCatalog(path: string) {
  try {
    return parseProjectCatalog(JSON.parse(await readFile(path, 'utf8')));
  } catch {
    return parseProjectCatalog({});
  }
}
