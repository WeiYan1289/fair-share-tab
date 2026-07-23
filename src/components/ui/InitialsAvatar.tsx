import { colorForSeed, getInitials } from "@/lib/constants";
import { cn } from "@/lib/cn";

interface InitialsAvatarProps {
  name: string;
  size?: number;
  /** Deterministic color source; defaults to `name` (e.g. pass a stable id instead). */
  colorSeed?: string;
  /** Members render as circles; groups render as rounded squares (P0-05, P1-02). */
  shape?: "circle" | "square";
  className?: string;
}

export function InitialsAvatar({
  name,
  size = 40,
  colorSeed,
  shape = "circle",
  className,
}: InitialsAvatarProps) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center font-bold text-white",
        shape === "circle" ? "rounded-full" : "rounded-[30%]",
        className,
      )}
      style={{
        width: size,
        height: size,
        backgroundColor: colorForSeed(colorSeed ?? name),
        fontSize: Math.round(size * 0.36),
      }}
    >
      {getInitials(name)}
    </div>
  );
}
