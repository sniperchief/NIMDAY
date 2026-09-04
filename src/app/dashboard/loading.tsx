/** Placeholder while "My NIMday" loads. */
export default function LoadingDashboard() {
  return (
    <main className="min-h-dvh bg-cream px-4 py-8 sm:py-12">
      <div
        className="mx-auto w-full max-w-xl animate-pulse space-y-5"
        role="status"
        aria-label="Loading your NIMday"
      >
        <div className="h-52 rounded-3xl bg-white ring-1 ring-black/5" />
        <div className="h-40 rounded-3xl bg-white ring-1 ring-black/5" />
        <div className="h-56 rounded-3xl bg-white ring-1 ring-black/5" />
      </div>
    </main>
  );
}
