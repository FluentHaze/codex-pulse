export interface SearchableCommand {
  id: string;
  label: string;
  hint: string;
  keywords?: readonly string[];
}

const normalize = (value: string) => value.normalize('NFKC').toLocaleLowerCase();

export function searchCommands<T extends SearchableCommand>(
  commands: readonly T[],
  query: string,
): T[] {
  const terms = normalize(query).trim().split(/\s+/).filter(Boolean);
  return commands.filter((command) => {
    const text = normalize(
      [command.id, command.label, command.hint, ...(command.keywords ?? [])].join(' '),
    );
    return terms.every((term) => text.includes(term));
  });
}
