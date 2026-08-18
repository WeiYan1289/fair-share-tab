// A full-screen spinner overlay shown while a full-page navigation is in
// flight (e.g. entering a group: a native form POST -> redirect, which would
// otherwise freeze the screen with no feedback). The caller drives visibility
// from an onSubmit handler; this component is just the markup.
export function PendingOverlay({ label = "Opening…" }: { label?: string }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-cream/70 backdrop-blur-[1px] dark:bg-dark-bg/70">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-forest/25 border-t-forest dark:border-mint/25 dark:border-t-mint" />
        <p className="text-[13px] font-bold text-muted dark:text-dark-muted">{label}</p>
      </div>
    </div>
  );
}
