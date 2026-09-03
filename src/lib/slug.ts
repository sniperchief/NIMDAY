import { randomBytes } from "node:crypto";

// Combining diacritical marks (U+0300–U+036F), stripped after NFKD normalisation.
const DIACRITICS = new RegExp("[\\u0300-\\u036f]", "g");

/** "Sarah López!!" -> "sarah-lopez" */
export function slugifyName(name: string): string {
  const base = name
    .normalize("NFKD")
    .replace(DIACRITICS, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
  return base || "nimday";
}

function suffix(len = 5): string {
  const alphabet = "0123456789abcdefghijklmnopqrstuvwxyz";
  const bytes = randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) out += alphabet[bytes[i] % 36];
  return out;
}

export function makeSlugCandidate(name: string): string {
  return `${slugifyName(name)}-${suffix()}`;
}

/**
 * Generate a slug that passes `exists`. Tries a few candidates, then falls back
 * to a longer random suffix so this always terminates.
 */
export async function generateUniqueSlug(
  name: string,
  exists: (slug: string) => Promise<boolean>,
): Promise<string> {
  for (let i = 0; i < 6; i++) {
    const candidate = makeSlugCandidate(name);
    if (!(await exists(candidate))) return candidate;
  }
  let candidate = `${slugifyName(name)}-${suffix(10)}`;
  while (await exists(candidate)) {
    candidate = `${slugifyName(name)}-${suffix(12)}`;
  }
  return candidate;
}
