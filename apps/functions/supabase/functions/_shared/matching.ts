export const clampMatchLimit = (input: number | undefined): number => {
  if (input === undefined || input === null || Number.isNaN(input)) return 5;
  return Math.min(Math.max(Math.floor(input), 1), 5);
};
