import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type ButtonVariant = "primary" | "secondary";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

// Primary/secondary/disabled button treatments from the mockups' component
// primitives (P0-05).
export function Button({ variant = "primary", className, disabled, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "rounded-md text-[14.5px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald focus-visible:ring-offset-2",
        variant === "primary" &&
          "bg-forest px-6 py-3.5 text-cream shadow-[0_8px_18px_-6px_rgba(22,58,46,0.5)] hover:bg-[#1a4536]",
        variant === "secondary" &&
          "border border-ink/15 bg-cream px-5 py-[11px] text-[13.5px] text-ink hover:bg-[#efe9db]",
        disabled &&
          "cursor-not-allowed bg-[#E4E2DC] text-[#A9A49C] shadow-none hover:bg-[#E4E2DC]",
        className,
      )}
      disabled={disabled}
      {...props}
    />
  );
}
