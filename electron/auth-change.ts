import { statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export function codexAuthPath() {
  return join(process.env.CODEX_HOME || join(homedir(), '.codex'), 'auth.json');
}

function revision(path: string): string | undefined {
  try {
    const stat = statSync(path, { bigint: true });
    return `${stat.dev}:${stat.ino}:${stat.size}:${stat.mtimeNs}:${stat.ctimeNs}`;
  } catch (error) {
    // Permission or transient I/O failures must not masquerade as a logout.
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return 'missing';
    return undefined;
  }
}

/** Poll metadata rather than credentials; polling survives atomic file replacement. */
export class AuthChangeDetector {
  private current: string | undefined;
  private candidate: string | undefined;

  constructor(private path = codexAuthPath()) {
    this.current = revision(path);
  }

  changed(): boolean {
    const next = revision(this.path);
    if (next === undefined) {
      this.candidate = undefined;
      return false;
    }
    if (this.current === undefined) {
      this.current = next;
      return false;
    }
    if (next === this.current) {
      this.candidate = undefined;
      return false;
    }
    // Require two stable samples so truncate/write and rename sequences can settle.
    if (next !== this.candidate) {
      this.candidate = next;
      return false;
    }
    this.current = next;
    this.candidate = undefined;
    return true;
  }
}
