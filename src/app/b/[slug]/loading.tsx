/**
 * Shown while a nimDay is being fetched on a client-side navigation. Shaped
 * like the card that's coming so the page doesn't jump when it arrives.
 */
export default function LoadingBirthday() {
  return (
    <main className="min-h-dvh bg-white px-4 py-6 sm:py-10">
      <div
        className="mx-auto w-full max-w-lg space-y-4"
        role="status"
        aria-label="Loading this nimDay"
      >
        <div className="animate-pulse overflow-hidden rounded-[28px] bg-white ring-1 ring-black/5">
          <div className="h-28 bg-black/[0.06]" />
          <div className="-mt-14 flex flex-col items-center px-5 pb-8">
            <div className="h-24 w-24 rounded-full bg-black/[0.08] ring-4 ring-white" />
            <div className="mt-5 h-7 w-48 rounded-full bg-black/[0.08]" />
            <div className="mt-3 h-6 w-36 rounded-full bg-black/[0.06]" />
            <div className="mt-6 grid w-full gap-3">
              <div className="h-24 rounded-3xl bg-black/[0.05]" />
              <div className="h-24 rounded-3xl bg-black/[0.05]" />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
