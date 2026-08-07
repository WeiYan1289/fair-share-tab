import Link from "next/link";
import { Logo } from "@/components/ui/Logo";

// Landing spot for anyone whose link or membership points at an archived
// group (spec 2026-08-06 feature C). Deliberately name-free: one static
// page covers every archived group, and the visitor's link already told
// them which group they were opening.
export default function GroupArchivedPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-cream px-6 text-center dark:bg-dark-bg">
      <Logo size={26} wordmarkClassName="text-base" />
      <h1 className="num mt-8 mb-2.5 text-2xl text-ink sm:text-[26px] dark:text-dark-text">
        This group has been archived
      </h1>
      <p className="mb-6 max-w-[380px] text-[14px] leading-relaxed text-muted dark:text-dark-muted">
        The group&apos;s owner has archived it, so it can&apos;t be opened right
        now. Your link stays valid — if the owner restores the group, the same
        link will work again.
      </p>
      <Link
        href="/"
        className="rounded-md bg-forest px-6 py-3.5 text-sm font-bold text-cream shadow-[0_8px_20px_-6px_rgba(22,58,46,0.5)] hover:bg-forest-hover dark:bg-dark-forest"
      >
        Back to home
      </Link>
    </div>
  );
}
