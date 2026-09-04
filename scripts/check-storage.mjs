/**
 * DEV ONLY — confirms the Supabase Storage settings in .env are the right ones
 * before you paste them into a host's env panel. Prints nothing secret: keys are
 * masked, and it never writes to the bucket.
 *
 *   node scripts/check-storage.mjs
 */
import fs from "node:fs";

const env = {};
for (const line of fs.readFileSync(".env", "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"]*)"?\s*$/);
  if (m) env[m[1]] = m[2];
}

const mask = (s) =>
  !s ? "(unset)" : `${s.slice(0, 6)}…${s.slice(-4)}  (${s.length} chars)`;

const key = env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const bucket = env.SUPABASE_STORAGE_BUCKET || "nimday-uploads";

console.log(`SUPABASE_URL              = ${env.SUPABASE_URL || "(unset)"}`);
console.log(`SUPABASE_STORAGE_BUCKET   = ${bucket}`);
console.log(`SUPABASE_SERVICE_ROLE_KEY = ${mask(key)}`);

const isJwt = key.split(".").length === 3;
if (isJwt) {
  try {
    const role = JSON.parse(
      Buffer.from(key.split(".")[1], "base64").toString(),
    ).role;
    console.log(
      `  role -> ${role}${role === "service_role" ? "  ✓" : "  ✗ wrong key"}`,
    );
  } catch {
    console.log("  ✗ JWT payload unreadable");
  }
} else if (key.startsWith("sb_secret_")) {
  console.log("  ✓ new-style secret key");
} else if (key.startsWith("sb_publishable_")) {
  console.log("  ✗ that's the publishable (public) key");
} else {
  console.log(
    "  ✗ not an API key — probably the JWT Secret. Use Settings → API →\n" +
      "    Project API keys → service_role",
  );
}

if (!env.SUPABASE_URL || !key) process.exit(1);

// A real, read-only probe: list the bucket. Proves the URL, key and bucket
// name all line up, without uploading anything.
const res = await fetch(
  `${env.SUPABASE_URL.replace(/\/+$/, "")}/storage/v1/bucket/${bucket}`,
  { headers: { authorization: `Bearer ${key}`, apikey: key } },
);
if (res.ok) {
  const b = await res.json();
  console.log(
    `\n✓ bucket "${b.name}" reachable — public: ${b.public === true ? "yes ✓" : "NO ✗ (make it public)"}`,
  );
} else {
  console.log(
    `\n✗ ${res.status} ${res.statusText} — ${(await res.text()).slice(0, 200)}`,
  );
  process.exit(1);
}
