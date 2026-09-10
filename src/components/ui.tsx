import * as React from "react";

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
  size?: "md" | "lg";
  loading?: boolean;
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    { variant = "primary", size = "md", loading, className, children, disabled, ...rest },
    ref,
  ) {
    const base =
      "inline-flex items-center justify-center gap-2 rounded-full font-medium transition active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none " +
      // A visible keyboard focus ring on every button, in both tones.
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white";
    const sizes = { md: "px-5 py-2.5 text-sm", lg: "px-6 py-3.5 text-base" };
    const variants = {
      primary: "bg-ink text-cream hover:bg-ink/90",
      secondary: "bg-white text-ink ring-1 ring-black/10 hover:bg-black/[0.03]",
      ghost: "text-ink/70 hover:text-ink hover:bg-black/[0.04]",
    };
    return (
      <button
        ref={ref}
        className={cn(base, sizes[size], variants[variant], className)}
        disabled={disabled || loading}
        // A disabled button is silent to a screen reader about *why*. aria-busy
        // says "working", not "unavailable".
        aria-busy={loading || undefined}
        {...rest}
      >
        {loading && (
          <span
            aria-hidden
            className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
          />
        )}
        {children}
        {loading && <span className="sr-only">, working…</span>}
      </button>
    );
  },
);

export function Field({
  label,
  hint,
  error,
  children,
  optional,
}: {
  label: string;
  hint?: string;
  error?: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-baseline justify-between text-sm font-medium text-ink/80">
        {label}
        {optional && <span className="text-xs font-normal text-ink/40">optional</span>}
      </span>
      {children}
      {error ? (
        <span className="mt-1 block text-xs text-red-600">{error}</span>
      ) : hint ? (
        <span className="mt-1 block text-xs text-ink/45">{hint}</span>
      ) : null}
    </label>
  );
}

/**
 * Same look as <Field>, but a grouping element rather than a <label>.
 *
 * A <label> can only ever be associated with ONE control, so wrapping several
 * inputs in it means tapping the second or third activates the first instead.
 * Use this whenever a field is made of more than one control; each control
 * carries its own aria-label.
 */
export function Fieldset({
  label,
  hint,
  error,
  children,
  optional,
}: {
  label: string;
  hint?: string;
  error?: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div role="group" aria-label={label} className="block">
      <span className="mb-1.5 flex items-baseline justify-between text-sm font-medium text-ink/80">
        {label}
        {optional && <span className="text-xs font-normal text-ink/40">optional</span>}
      </span>
      {children}
      {error ? (
        <span className="mt-1 block text-xs text-red-600">{error}</span>
      ) : hint ? (
        <span className="mt-1 block text-xs text-ink/45">{hint}</span>
      ) : null}
    </div>
  );
}

const fieldStyle =
  "w-full rounded-xl bg-white px-3.5 py-2.5 text-sm text-ink ring-1 ring-black/10 placeholder:text-ink/35 focus:outline-none focus:ring-2 focus:ring-ink/30";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={cn(fieldStyle, className)} {...rest} />;
});

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...rest }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(fieldStyle, "min-h-[84px] resize-y", className)}
      {...rest}
    />
  );
});

export function Card({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-3xl bg-white p-6 shadow-[0_1px_0_rgba(0,0,0,0.04),0_18px_40px_-24px_rgba(0,0,0,0.25)] ring-1 ring-black/5",
        className,
      )}
    >
      {children}
    </div>
  );
}
