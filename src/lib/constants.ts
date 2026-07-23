// No avatar-color assignment rule is specified anywhere in the docs or
// mockups (data-model.md §3.3 only says "assigned on creation"). Picking
// randomly from a small fixed palette pending real design input.
const AVATAR_COLOR_PALETTE = [
  "#1B9A62",
  "#35D28A",
  "#C24B36",
  "#7A5C9E",
  "#2E8562",
  "#B0793D",
];

export function assignAvatarColor(): string {
  return AVATAR_COLOR_PALETTE[Math.floor(Math.random() * AVATAR_COLOR_PALETTE.length)];
}
