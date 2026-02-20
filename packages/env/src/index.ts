export const requireKeys = (record: Record<string, string | undefined>, keys: string[]): string[] =>
  keys.filter((key) => !record[key]);
