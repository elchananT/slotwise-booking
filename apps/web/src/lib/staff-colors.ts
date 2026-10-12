const PALETTE = ["#d9603b", "#0f5c5c", "#b8892b", "#7b4b6a", "#5f7a3a", "#3d5a80"];

export function staffColor(index: number) {
  return PALETTE[((index % PALETTE.length) + PALETTE.length) % PALETTE.length]!;
}

export function hashIndex(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % PALETTE.length;
}
