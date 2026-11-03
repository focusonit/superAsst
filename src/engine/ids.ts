let seq = 0;

export function resetIds(seed = 0): void {
  seq = seed;
}

export function nextId(prefix: string): string {
  seq += 1;
  return `${prefix}-${seq}`;
}
