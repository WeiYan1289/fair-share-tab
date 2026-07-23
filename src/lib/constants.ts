// No avatar-color assignment rule is specified in the docs (data-model.md
// §3.3 only says "assigned on creation"), but the mockups consistently use
// this set for member/group identity badges (P0-05, P1-02, P7 sample data)
// -- mint and coral are reserved there for balance sign (owed to you / you
// owe), so this pool deliberately excludes both.
const AVATAR_COLOR_PALETTE = [
  "#4A6FA5", // blue
  "#7A5C9E", // violet
  "#B5654A", // terracotta
  "#3E7C86", // teal
  "#B08A3E", // gold
  "#2E8562", // pine
];

export function assignAvatarColor(): string {
  return AVATAR_COLOR_PALETTE[Math.floor(Math.random() * AVATAR_COLOR_PALETTE.length)];
}

/** Deterministic color from the same palette, stable for a given id/name. */
export function colorForSeed(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return AVATAR_COLOR_PALETTE[Math.abs(hash) % AVATAR_COLOR_PALETTE.length];
}

/** "Family & Friends" -> "FF", "Work Friends" -> "WF", "Sarah" -> "SA". */
export function getInitials(name: string): string {
  const words = name
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0 && !/^(&|and)$/i.test(word));

  if (words.length === 0) return "";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}
