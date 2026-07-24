import { cn } from "@/lib/cn";

interface LogoProps {
  size?: number;
  wordmark?: boolean;
  wordmarkClassName?: string;
  className?: string;
}

// Badge + wordmark lockup from the mockups' Part 0 brand section (P0-01):
// a two-tone forest/mint gradient badge with a cream fold-and-checkmark
// mark, "FairShare" in forest + "Tab" in emerald. Fixed (not useId-derived)
// gradient/clip ids -- every instance renders the identical gradient, so
// there's nothing per-instance to disambiguate, and a fixed id sidesteps a
// server/client useId mismatch when the number of Logo instances on the
// page differs between the SSR pass and the client (e.g. GroupHeader vs.
// landing headers).
const fgId = "fst-logo-fg";
const mgId = "fst-logo-mg";
const clipId = "fst-logo-clip";

export function Logo({ size = 26, wordmark = true, wordmarkClassName, className }: LogoProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <svg width={size} height={size} viewBox="0 0 64 64" className="shrink-0">
        <defs>
          <linearGradient id={fgId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#1F5C46" />
            <stop offset="1" stopColor="#102219" />
          </linearGradient>
          <linearGradient id={mgId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#4FE29C" />
            <stop offset="1" stopColor="#1F9E68" />
          </linearGradient>
          <clipPath id={clipId}>
            <rect width="64" height="64" rx="18" />
          </clipPath>
        </defs>
        <g clipPath={`url(#${clipId})`}>
          <rect x="0" width="32" height="64" fill={`url(#${fgId})`} />
          <rect x="32" width="32" height="64" fill={`url(#${mgId})`} />
        </g>
        <path
          d="M20 12 H44 V38 L40 42 L36 38 L32 42 L28 38 L24 42 L20 38 Z"
          fill="#F6F1E7"
        />
        <line
          x1="32"
          y1="12"
          x2="32"
          y2="36"
          stroke="#35D28A"
          strokeWidth="3"
          strokeDasharray="4 3"
          strokeLinecap="round"
        />
        <path
          d="M26 27 L30 31 L38 21"
          stroke="#1B9A62"
          strokeWidth="3.4"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {wordmark && (
        <span className={cn("font-sans font-extrabold tracking-tight", wordmarkClassName)}>
          <span className="text-forest dark:text-dark-text">FairShare</span>
          <span className="text-emerald dark:text-mint">Tab</span>
        </span>
      )}
    </div>
  );
}
