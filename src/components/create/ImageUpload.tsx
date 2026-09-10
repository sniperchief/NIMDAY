"use client";

import { useRef, useState } from "react";
import { uploadImage, ApiError } from "@/lib/apiClient";
import { Button } from "@/components/ui";

export function ImageUpload({
  value,
  onChange,
  label = "Photo",
  shape = "circle",
}: {
  value: string;
  onChange: (url: string) => void;
  label?: string;
  shape?: "circle" | "square";
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pick(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const url = await uploadImage(file);
      onChange(url);
    } catch (err) {
      // Uploads need a session. The wizard connects first so this shouldn't
      // happen, but a session can lapse mid-flow — say what to do about it
      // rather than showing the generic "Sign in to continue".
      if (err instanceof ApiError && err.status === 401) {
        setError("Reconnect your Nimiq wallet, then add the photo again.");
      } else {
        setError(
          err instanceof ApiError ? err.message : "Couldn't upload that image",
        );
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <span className="mb-1.5 block text-sm font-medium text-ink/80">
        {label} <span className="text-xs font-normal text-ink/40">optional</span>
      </span>
      <div className="flex items-center gap-3">
        <div
          className={
            "h-16 w-16 flex-none overflow-hidden bg-black/5 ring-1 ring-black/10 " +
            (shape === "circle" ? "rounded-full" : "rounded-xl")
          }
        >
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-lg opacity-30">
              🖼️
            </div>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="hidden"
          onChange={(e) => pick(e.target.files?.[0])}
        />
        <Button
          type="button"
          variant="secondary"
          loading={busy}
          onClick={() => inputRef.current?.click()}
        >
          {value ? "Replace" : "Upload"}
        </Button>
        {value ? (
          <Button type="button" variant="ghost" onClick={() => onChange("")}>
            Remove
          </Button>
        ) : null}
      </div>
      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
