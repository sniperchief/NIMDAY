/**
 * DEV ONLY — Phase 3 end-to-end pass, driven over real HTTP against a running
 * dev server: creator flow -> public page -> messages -> gifting regression ->
 * creator dashboard -> authorization.
 *
 * It needs `ALLOW_DEV_LOGIN=1` and a database with no NIMday for the dev wallet
 * (the dev-login route always signs in as the same fixed test wallet, and there
 * is one NIMday per wallet), so reset the dev database first:
 *
 *   npm run db:dev                       # shell 1
 *   npx prisma db push --force-reset     # shell 2 — DESTROYS local dev data
 *   npm run dev                          # shell 2
 *   E2E_BASE=http://localhost:3000 npm run e2e:phase3
 *
 * Nothing here touches the Nimiq network: the gift half runs through
 * /api/dev/mock-verify, which feeds a synthetic transaction into the REAL
 * verification and credit code.
 */
const BASE = process.env.E2E_BASE ?? "http://localhost:3100";
const SUFFIX = String(Date.now()).slice(-4);
const ADDR = `NQ34 E2E3 0000 0000 0000 0000 0000 0000 ${SUFFIX}`;

let cookie = "";
const results = [];

function check(name, pass, detail = "") {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
}

async function api(path, init = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...(cookie ? { cookie } : {}),
      ...(init.headers ?? {}),
    },
  });
  const setCookie = res.headers.get("set-cookie");
  if (setCookie) cookie = setCookie.split(";")[0];
  let body = null;
  try {
    body = await res.json();
  } catch {
    /* html */
  }
  return { status: res.status, body };
}

async function html(path) {
  const res = await fetch(`${BASE}${path}`, { headers: cookie ? { cookie } : {} });
  // React marks text-node boundaries with <!-- --> in server HTML; strip them so
  // assertions read the sentence a person would see.
  const text = (await res.text()).replace(/<!-- -->/g, "");
  return { status: res.status, text };
}

const run = async () => {
  /* ---------- creator ---------- */
  const login = await api("/api/auth/dev-login", {
    method: "POST",
    body: JSON.stringify({ address: ADDR }),
  });
  check("creator signs in (dev wallet)", login.status === 200, `status ${login.status}`);
  // The dev-login route issues its own fixed test wallet; that address — not
  // anything the client sends — is what gifts must be routed to.
  const creatorWallet = (await api("/api/auth/me")).body.data.user.walletAddress;

  const created = await api("/api/birthdays", {
    method: "POST",
    body: JSON.stringify({
      name: "Sarah Chen",
      birthday: "1996-12-24",
      message: "Turning a year wiser — thank you for celebrating with me!",
      theme: "confetti",
      wishes: [
        {
          title: "Headphones",
          description: "The over-ear ones I keep talking about",
          targetAmount: 10,
          currency: "NIM",
          giftType: "FUND",
        },
        { title: "Pottery class", targetAmount: 25, currency: "NIM", giftType: "EITHER" },
      ],
    }),
  });
  check("creator creates a NIMday with wishes", created.status === 201, `status ${created.status}`);
  const birthday = created.body?.data?.birthday;
  const slug = birthday?.slug;
  const wishId = birthday?.wishes?.[0]?.id;

  const published = await api(`/api/birthdays/${birthday.id}/publish`, { method: "POST" });
  check("creator publishes", published.status === 200, published.body?.data?.url);

  /* ---------- dashboard, empty ---------- */
  const empty = await api("/api/birthdays/me/dashboard");
  const d0 = empty.body?.data?.dashboard;
  check(
    "dashboard shows an empty state with countdown + canonical link",
    empty.status === 200 &&
      d0.summary.giftCount === 0 &&
      d0.summary.messageCount === 0 &&
      d0.activity.length === 0 &&
      d0.overview.url.endsWith(`/b/${slug}`) &&
      typeof d0.overview.countdown.daysUntil === "number",
    `${d0.overview.countdown.daysUntil} days until, url ${d0.overview.url}`,
  );

  const dashPage = await html("/dashboard");
  check(
    "dashboard page renders for the signed-in creator",
    dashPage.status === 200 && dashPage.text.includes("My NIMday"),
  );

  /* ---------- public page, as a visitor with no session ---------- */
  const savedCookie = cookie;
  cookie = "";

  const page = await html(`/b/${slug}`);
  check(
    "public page loads with no wallet and no account",
    page.status === 200 &&
      page.text.includes("Sarah Chen") &&
      page.text.includes("Leave a birthday message") &&
      page.text.includes("Birthday Quest") &&
      page.text.includes("Headphones"),
  );
  check(
    "public page shows the empty message state",
    page.text.includes("be the first to wish Sarah a happy birthday"),
  );
  check(
    "public page is a birthday card, not a crypto dashboard",
    !/wallet address|blockchain|0x|Luna/i.test(page.text.replace(/<script[\s\S]*?<\/script>/g, "")),
  );

  /* ---------- messages ---------- */
  const named = await api("/api/messages", {
    method: "POST",
    headers: { "x-forwarded-for": "198.51.100.1" },
    body: JSON.stringify({
      slug,
      body: "Happy birthday Sarah! Hope you have an amazing day 🎉",
      senderName: "Alex",
    }),
  });
  check(
    "visitor leaves a named message without connecting a wallet",
    named.status === 201 && named.body.data.message.author === "Alex",
  );

  const anon = await api("/api/messages", {
    method: "POST",
    headers: { "x-forwarded-for": "198.51.100.2" },
    body: JSON.stringify({
      slug,
      body: "Have the loveliest day 🎂",
      senderName: "Priya",
      anonymous: true,
    }),
  });
  const anonMsg = anon.body?.data?.message;
  check(
    "anonymous message hides the sender",
    anon.status === 201 &&
      anonMsg.author === "Someone" &&
      !JSON.stringify(anonMsg).includes("Priya"),
  );

  const noName = await api("/api/messages", {
    method: "POST",
    headers: { "x-forwarded-for": "198.51.100.3" },
    body: JSON.stringify({ slug, body: "Wishing you a great one!" }),
  });
  check(
    "unnamed message becomes 'A friend'",
    noName.status === 201 && noName.body.data.message.author === "A friend",
  );

  const emptyMsg = await api("/api/messages", {
    method: "POST",
    headers: { "x-forwarded-for": "198.51.100.4" },
    body: JSON.stringify({ slug, body: "   " }),
  });
  check("empty message is rejected", emptyMsg.status === 400, emptyMsg.body?.error?.message);

  const longMsg = await api("/api/messages", {
    method: "POST",
    headers: { "x-forwarded-for": "198.51.100.5" },
    body: JSON.stringify({ slug, body: "a".repeat(300) }),
  });
  check("over-long message is rejected", longMsg.status === 400, longMsg.body?.error?.message);

  const spam = await api("/api/messages", {
    method: "POST",
    headers: { "x-forwarded-for": "198.51.100.6" },
    body: JSON.stringify({ slug, body: "happy birthday https://spam.example" }),
  });
  check("link spam is rejected", spam.status === 400, spam.body?.error?.message);

  const dupe = await api("/api/messages", {
    method: "POST",
    headers: { "x-forwarded-for": "198.51.100.1" },
    body: JSON.stringify({
      slug,
      body: "Happy birthday Sarah! Hope you have an amazing day 🎉",
      senderName: "Alex",
    }),
  });
  check("the same message twice is rejected", dupe.status === 400, dupe.body?.error?.message);

  let limited = null;
  for (let i = 0; i < 8; i++) {
    limited = await api("/api/messages", {
      method: "POST",
      headers: { "x-forwarded-for": "198.51.100.77" },
      body: JSON.stringify({ slug, body: `Burst message number ${i}` }),
    });
    if (limited.status === 429) break;
  }
  check("a burst from one client is rate limited", limited.status === 429, limited.body?.error?.message);

  const feed = await api(`/api/messages?slug=${slug}`);
  check(
    "message feed lists newest first and never exposes an address",
    feed.status === 200 &&
      feed.body.data.messages[0].createdAt >= feed.body.data.messages.at(-1).createdAt &&
      !JSON.stringify(feed.body.data).includes("NQ"),
    `${feed.body.data.total} messages`,
  );

  const rendered = await html(`/b/${slug}`);
  check(
    "messages are server-rendered on the public page",
    rendered.text.includes("Hope you have an amazing day") &&
      rendered.text.includes("Someone") &&
      !rendered.text.includes("Priya"),
  );

  /* ---------- gift flow (Phase 2 regression) ---------- */
  const intent = await api("/api/gifts/intent", {
    method: "POST",
    body: JSON.stringify({ slug, wishId, amountNim: "4", anonymous: false }),
  });
  check(
    "gift intent still created with a server-derived recipient and deep link",
    intent.status === 201 &&
      intent.body.data.intent.recipientAddress === creatorWallet &&
      intent.body.data.intent.deepLink.includes("nimpay.app/miniapps/open/") &&
      intent.body.data.intent.deepLink.includes(`/b/${slug}?gift=1&intent=`),
  );
  const intentId = intent.body.data.intent.id;

  const submitted = await api(`/api/gifts/intent/${intentId}/submit`, {
    method: "POST",
    body: JSON.stringify({ txHash: "9".repeat(64), senderAddress: "NQ55 GIVE R000 0000 0000 0000 0000 0000 0001" }),
  });
  check(
    "submitting a hash only marks it SUBMITTED — never credits",
    submitted.status === 200 && submitted.body.data.payment.status === "SUBMITTED",
  );

  const pageBefore = await html(`/b/${slug}`);
  check(
    "wish progress is untouched by an unverified payment",
    /0<\/span> of 10 NIM/.test(pageBefore.text),
    "progress still 0 / 10 NIM",
  );

  const mock = await api("/api/dev/mock-verify", {
    method: "POST",
    body: JSON.stringify({ intentId, state: "confirmed" }),
  });
  check("dev mock-verify credits a confirmed transaction", mock.status === 200, JSON.stringify(mock.body?.data ?? mock.body?.error));

  const pageAfter = await html(`/b/${slug}`);
  check(
    "wish progress updates after verification",
    /4<\/span> of 10 NIM/.test(pageAfter.text),
    "4 of 10 NIM",
  );

  /* ---------- message linked to that gift ---------- */
  const giftMsg = await api("/api/messages", {
    method: "POST",
    headers: { "x-forwarded-for": "198.51.100.20" },
    body: JSON.stringify({
      slug,
      body: "Enjoy the headphones!",
      senderName: "Alex",
      intentId,
    }),
  });
  check(
    "a message after a gift carries the gift badge",
    giftMsg.status === 201 && giftMsg.body.data.message.gift?.wishTitle === "Headphones",
    JSON.stringify(giftMsg.body?.data?.message?.gift),
  );

  /* ---------- anonymous gift is never unmasked ---------- */
  const anonIntent = await api("/api/gifts/intent", {
    method: "POST",
    body: JSON.stringify({ slug, wishId, amountNim: "6", anonymous: true }),
  });
  const anonIntentId = anonIntent.body.data.intent.id;
  await api(`/api/gifts/intent/${anonIntentId}/submit`, {
    method: "POST",
    body: JSON.stringify({ txHash: "8".repeat(64), senderAddress: "NQ55 GIVE R000 0000 0000 0000 0000 0000 0002" }),
  });
  await api("/api/dev/mock-verify", {
    method: "POST",
    body: JSON.stringify({ intentId: anonIntentId, state: "confirmed" }),
  });
  const anonGiftMsg = await api("/api/messages", {
    method: "POST",
    headers: { "x-forwarded-for": "198.51.100.21" },
    body: JSON.stringify({
      slug,
      body: "Hope you love it!",
      senderName: "Alex",
      intentId: anonIntentId,
    }),
  });
  check(
    "an anonymous gift is never linked to a named message",
    anonGiftMsg.status === 201 && anonGiftMsg.body.data.message.gift === null,
  );

  const pageFulfilled = await html(`/b/${slug}`);
  check(
    "a wish that reaches its target reads as fulfilled on the public page",
    pageFulfilled.text.includes("🎉 Wish fulfilled!"),
  );

  /* ---------- creator dashboard, populated ---------- */
  cookie = savedCookie;
  const dash = await api("/api/birthdays/me/dashboard");
  const d = dash.body?.data?.dashboard;
  check(
    "dashboard totals come from the verified ledger",
    d.summary.giftCount === 2 && d.summary.totalNim === "10",
    `${d.summary.giftCount} gifts, ${d.summary.totalNim} NIM`,
  );
  check(
    "dashboard counts wishes fulfilled and messages",
    d.summary.wishesFulfilled === 1 && d.summary.wishCount === 2 && d.summary.messageCount >= 5,
    `${d.summary.wishesFulfilled}/${d.summary.wishCount} wishes, ${d.summary.messageCount} messages`,
  );
  const kinds = new Set(d.activity.map((a) => a.kind));
  check(
    "activity feed carries gifts, messages and the fulfilled wish",
    kinds.has("gift") && kinds.has("message") && kinds.has("fulfilled"),
    [...kinds].join(", "),
  );
  const anonGiftItem = d.activity.find((a) => a.kind === "gift" && a.amountNim === "6");
  const namedGiftItem = d.activity.find((a) => a.kind === "gift" && a.amountNim === "4");
  check(
    "anonymous gift stays anonymous to the creator; named gift is masked",
    anonGiftItem.actor === null && /^NQ55…/.test(namedGiftItem.actor),
    `${anonGiftItem.actor} / ${namedGiftItem.actor}`,
  );
  check(
    "no raw wallet address anywhere in the dashboard payload",
    !JSON.stringify(d).includes("GIVE R000") && !JSON.stringify(d).includes("NQ55 GIVE"),
  );
  const times = d.activity.map((a) => Date.parse(a.at));
  check(
    "activity is newest first",
    times.every((t, i) => i === 0 || times[i - 1] >= t),
  );

  const dashHtml = await html("/dashboard");
  check(
    "dashboard page renders the numbers and the share block",
    dashHtml.text.includes("Share your NIMday") &&
      dashHtml.text.includes("Headphones") &&
      dashHtml.text.includes("gifted"),
  );

  /* ---------- creator deletes a message (final readiness) ---------- */
  cookie = savedCookie;

  const toDelete = await api("/api/messages", {
    method: "POST",
    headers: { "x-forwarded-for": "198.51.100.44" },
    body: JSON.stringify({ slug, body: "A note the creator will remove", senderName: "Sam" }),
  });
  const doomedId = toDelete.body?.data?.message?.id;
  check("a message to remove was left", toDelete.status === 201, doomedId);

  // A visitor with no session must not be able to remove it.
  cookie = "";
  const anonDelete = await api(`/api/messages/${doomedId}`, { method: "DELETE" });
  check("an unauthenticated visitor cannot delete a message", anonDelete.status === 401);

  // A made-up id is refused too, and says nothing about what exists.
  // (The cross-creator 403 needs a second wallet, which dev-login can't issue —
  // it is covered against a real database in tests/db/messages.test.ts.)
  const forged = await api("/api/messages/not-a-real-message-id", { method: "DELETE" });
  check("a made-up message id is refused for a signed-out caller", forged.status === 401);

  cookie = savedCookie;
  const beforeDelete = await api(`/api/messages?slug=${slug}`);
  const countBefore = beforeDelete.body.data.total;
  const giftsBefore = (await api("/api/birthdays/me/dashboard")).body.data.dashboard.summary;

  const removed = await api(`/api/messages/${doomedId}`, { method: "DELETE" });
  check(
    "the creator deletes a message from their own NIMday",
    removed.status === 200 && removed.body.data.deleted.id === doomedId,
    `status ${removed.status}`,
  );

  const afterDelete = await api(`/api/messages?slug=${slug}`);
  check(
    "the deleted message is gone from the public feed",
    afterDelete.body.data.total === countBefore - 1 &&
      !afterDelete.body.data.messages.some((m) => m.id === doomedId),
    `${countBefore} -> ${afterDelete.body.data.total}`,
  );

  const publicAfterDelete = await html(`/b/${slug}`);
  check(
    "the deleted message is gone from the rendered page too",
    !publicAfterDelete.text.includes("A note the creator will remove"),
  );

  const giftsAfter = (await api("/api/birthdays/me/dashboard")).body.data.dashboard;
  check(
    "deleting a message leaves gifts and totals untouched",
    giftsAfter.summary.giftCount === giftsBefore.giftCount &&
      giftsAfter.summary.totalNim === giftsBefore.totalNim &&
      giftsAfter.summary.wishesFulfilled === giftsBefore.wishesFulfilled,
    `${giftsAfter.summary.giftCount} gifts, ${giftsAfter.summary.totalNim} NIM`,
  );
  check(
    "the creator's own message list drops it and the count follows",
    !giftsAfter.messages.some((m) => m.id === doomedId) &&
      giftsAfter.summary.messageCount === countBefore - 1,
    `${giftsAfter.summary.messageCount} messages`,
  );

  const deletedTwice = await api(`/api/messages/${doomedId}`, { method: "DELETE" });
  check(
    "deleting it again is a clean 404 with no internals",
    deletedTwice.status === 404 &&
      !/prisma|sql|stack|at\s+\//i.test(deletedTwice.body?.error?.message ?? ""),
    deletedTwice.body?.error?.message,
  );

  /* ---------- a gifted wish can never be deleted ---------- */
  const gifted = await api(`/api/wishes/${wishId}`, { method: "DELETE" });
  check(
    "a wish that received a gift cannot be deleted",
    gifted.status === 409 && /already received a gift/i.test(gifted.body?.error?.message ?? ""),
    gifted.body?.error?.message,
  );

  const ledgerIntact = (await api("/api/birthdays/me/dashboard")).body.data.dashboard;
  check(
    "the gift ledger survived the refused wish deletion",
    ledgerIntact.summary.giftCount === giftsAfter.summary.giftCount &&
      ledgerIntact.summary.totalNim === giftsAfter.summary.totalNim,
    `${ledgerIntact.summary.giftCount} gifts, ${ledgerIntact.summary.totalNim} NIM`,
  );

  const editor = (await api("/api/birthdays/me")).body.data.birthday;
  const giftedWish = editor.wishes.find((w) => w.id === wishId);
  const untouchedWish = editor.wishes.find((w) => w.id !== wishId);
  check(
    "the editor knows which wishes are gifted, so Remove can be blocked up front",
    giftedWish.giftCount > 0 && untouchedWish.giftCount === 0,
    `${giftedWish.title}: ${giftedWish.giftCount} gift(s), ${giftedWish.raisedNim} NIM`,
  );

  const spare = await api(`/api/birthdays/${birthday.id}/wishes`, {
    method: "POST",
    body: JSON.stringify({ title: "Socks", targetAmount: 3, currency: "NIM", giftType: "EITHER" }),
  });
  const spareId = spare.body.data.birthday.wishes.find((w) => w.title === "Socks").id;
  const spareDeleted = await api(`/api/wishes/${spareId}`, { method: "DELETE" });
  check(
    "an ungifted wish can still be removed",
    spareDeleted.status === 200 &&
      !spareDeleted.body.data.birthday.wishes.some((w) => w.id === spareId),
  );

  /* ---------- network configuration is never silent ---------- */
  const netIntent = await api("/api/gifts/intent", {
    method: "POST",
    body: JSON.stringify({ slug, wishId, amountNim: "1", anonymous: false }),
  });
  const onTestnet = netIntent.body.data.intent.testnet;
  check(
    "the payment API always states which network this NIMday runs on",
    typeof onTestnet === "boolean",
    `testnet=${onTestnet}`,
  );
  const dashNet = (await api("/api/birthdays/me/dashboard")).body.data.dashboard;
  check(
    "the creator dashboard agrees, from the same single source",
    dashNet.overview.testnet === onTestnet,
    `testnet=${dashNet.overview.testnet}`,
  );
  // Set E2E_EXPECT_TESTNET=1 or =0 to assert which chain the server is on.
  if (process.env.E2E_EXPECT_TESTNET !== undefined) {
    check(
      "the server is on the network this run expected",
      onTestnet === (process.env.E2E_EXPECT_TESTNET === "1"),
      `expected testnet=${process.env.E2E_EXPECT_TESTNET === "1"}, got ${onTestnet}`,
    );
  }

  /* ---------- authorization ---------- */
  cookie = "";
  const noAuth = await api("/api/birthdays/me/dashboard");
  check("dashboard API requires a session", noAuth.status === 401);
  const signedOutPage = await html("/dashboard");
  check(
    "signed-out /dashboard shows a sign-in prompt, not someone's data",
    signedOutPage.status === 200 &&
      signedOutPage.text.includes("Sign in to see your NIMday") &&
      !signedOutPage.text.includes("Sarah Chen"),
  );

  /* ---------- unpublished NIMday ---------- */
  cookie = savedCookie;
  await api(`/api/birthdays/${birthday.id}`, {
    method: "PATCH",
    body: JSON.stringify({ name: "Sarah Chen" }),
  });

  console.log("\n----------------------------------------");
  const failed = results.filter((r) => !r.pass);
  console.log(`${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length) {
    console.log("FAILED:");
    for (const f of failed) console.log(`  - ${f.name} ${f.detail}`);
    process.exitCode = 1;
  }
};

run().catch((e) => {
  console.error("E2E crashed:", e);
  process.exitCode = 1;
});
