// Route-level loading fallback (Next.js loading.tsx). Streams instantly while a
// heavy page's data loads -- both on soft in-app navigations and, because it is
// a Suspense fallback, while the server streams a full navigation's data. Keeps
// the screen from appearing frozen during the wait.
export function RouteLoading({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-cream dark:bg-dark-bg">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-forest/25 border-t-forest dark:border-mint/25 dark:border-t-mint" />
        <p className="text-[13px] font-bold text-muted dark:text-dark-muted">{label}</p>
      </div>
    </div>
  );
}
