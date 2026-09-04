# Testing NIMday by hand

**Project folder:** `C:\Users\USER\OneDrive\Desktop\NIMDAY`
Every command below is run from there.

There are two tracks. Do **A** first — it takes five minutes and needs nothing but
your laptop. **B** is the real thing on a phone, and it's the only way to answer the
three outstanding Nimiq Pay device checks.

---

## Track A — Desktop (no phone, no real NIM)

Covers: creating a NIMday, publishing, sharing, the public card, wish progress,
anonymous gifts, and the creator's gift dashboard. The wallet steps use a dev test
wallet; the gift is simulated through the **real** verification and credit code.

### 1. Start the database (shell 1, leave it running)

```
cd C:\Users\USER\OneDrive\Desktop\NIMDAY
npm run db:dev
```

Wait for `[dev-db] PGlite on postgresql://…localhost:5433…`. This is a self-contained
Postgres — no Docker, no install. Data persists in `.pglite/`.

### 2. Create the tables (shell 2, one time)

```
cd C:\Users\USER\OneDrive\Desktop\NIMDAY
npm run db:push
```

### 3. Start the app (shell 2, leave it running)

```
npm run dev
```

Open **http://localhost:3000**

### 4. Create a NIMday

1. Click **Create your NIMday**
2. **Details** — name, birthday date, a message, optionally a photo, pick a theme
3. **Wishes** — add one or two (title, amount in NIM, gift type)
4. **Connect** — click **"Use a test wallet (dev)"**
   *(the real "Connect Nimiq Wallet" button only works inside Nimiq Pay — Track B)*
5. **Preview** — this is exactly what visitors see
6. **Publish** — you get your `/b/<slug>` link

### 5. Look at the public page

Open the link. You should see the card, the countdown, your wishes with a
`0 / 12 NIM` progress bar, share buttons, and *"tap one to send a gift"*.

Click a wish → choose an amount → **Continue**. Because a desktop browser has no
Nimiq wallet, you'll correctly get the **"Open in Nimiq Pay"** hand-off screen. That
is the right behaviour, not a bug.

### 6. Simulate someone sending a gift (shell 3)

```
cd C:\Users\USER\OneDrive\Desktop\NIMDAY
npm run dev:gift
npm run dev:gift 5
npm run dev:gift 5 anon
```

| Command | What it does |
|---|---|
| `npm run dev:gift` | 2 NIM to the newest NIMday's first wish |
| `npm run dev:gift 5` | 5 NIM |
| `npm run dev:gift 5 anon` | 5 NIM, anonymous |

> **Don't paste `# comments` after a command.** On Windows `cmd.exe` `#` is not a
> comment character — it gets passed to the script as the amount.

Then refresh the public page — the progress bar moves, and at target it flips to
**🎉 Wish fulfilled!**

### 7. Leave a birthday message

On the public page, scroll to **"Leave a birthday message"**. No wallet, no account.
Try all four: a named message, one with the name left blank (shows as *"A friend"*),
one with **Send anonymously** ticked (shows as *"Someone"*), and one containing a link
(rejected — links aren't allowed). Send the same message twice and the second is
refused; send six in a row and you get a friendly rate-limit message.

The **Birthday Quest** strip sits under the wishes. Tap it to expand: visiting already
ticked step 1, sending a message ticks step 2, opening a wish ticks step 3, and
**Celebrate your friend** fires confetti for step 4. Progress is stored per-device in
`localStorage` — nothing about the quest is on the server.

### 8. Check the creator dashboard

Go to **/dashboard** (also linked from the home page and after publishing). You get:
countdown, published status, the share block with copy + Web Share, gift totals,
per-wish progress, and an activity feed mixing gifts, messages and fulfilled wishes.
Anonymous gifts read *"Someone gifted…"* with no address; named ones show a masked
`NQ55…0001`.

### 9. Run the scripted end-to-end pass (optional)

With the dev server running and a **freshly reset** database:

```
npx prisma db push --force-reset
npm run e2e:phase3
```

35 checks covering the creator flow, the public page, messages, validation, rate
limiting, the gifting regression, the dashboard and authorization. It signs in with
the dev wallet, so the database must not already hold a NIMday for it.

### What to look for

- Progress **only** moves after `dev:gift` runs — never when you merely click through.
- Overpaying credits the real amount: `npm run dev:gift 50` on a 12 NIM wish credits 50.
- Running the same gift twice never double-counts (each run makes a new transaction;
  re-crediting the *same* one is what's blocked, and that's covered by the test suite).

---

## Track B — On your phone, inside Nimiq Pay (the real test)

This is where real wallet connection, real signing, and a real NIM transaction happen.
**Use testnet** so no real money moves.

### 1. Point the app at your Wi-Fi address

Edit `.env`:

```
NEXT_PUBLIC_APP_ORIGIN="http://192.168.1.188:3000"
NIMIQ_NETWORK="testalbatross"
```

`192.168.1.188` is this machine's Wi-Fi address. If it changes, run `ipconfig` and
use the Wi-Fi adapter's IPv4 address. (Next also prints a "Network:" URL, but that
one is the WSL adapter — ignore it, use the Wi-Fi one.)

### 2. Restart everything

Stop and restart `npm run dev` so it picks up the new `.env`.
Confirm from the laptop that **http://192.168.1.188:3000** loads.

If your phone can't reach it, allow Node through Windows Firewall on **Private**
networks, and make sure the phone is on the same Wi-Fi (not guest, not cellular).

### 3. Start the verification worker (shell 3, leave it running)

```
cd C:\Users\USER\OneDrive\Desktop\NIMDAY
npm run worker
```

Wait for `[worker] consensus established, head #…`. **Nothing gets credited without
this running** — that's the whole point of the design.

### 4. Put Nimiq Pay on testnet and get free NIM

In Nimiq Pay: open the app menu and **long-press the settings button for ~10 seconds**
to reveal the hidden dev menu → switch to **testnet**. The empty home screen then shows
a **Get free NIM** button — tap it (you get 110,000 test NIM).

### 5. Open NIMday as a mini app

Nimiq Pay → **Mini Apps** → **Custom URL** → enter `http://192.168.1.188:3000`

### 6. Run the creator flow for real

Create a NIMday and at the **Connect** step use the real **Connect Nimiq Wallet**
button. Nimiq Pay will ask you to approve a signature (no fee, no transaction).
Then preview and publish.

### 7. Send a real gift

Open your `/b/<slug>` page inside Nimiq Pay, tap a wish, pick an amount, optionally
tick *Give anonymously*, then **Confirm & send NIM**. Approve in Nimiq Pay.

You should see **"Payment submitted — verifying…"**, and within a few seconds — once
the worker confirms it on-chain — **"Gift confirmed 🎁"**. The wish progress updates.

### 8. Test the shared-link hand-off

Copy your `/b/<slug>` link and open it in your phone's **normal browser** (outside
Nimiq Pay). The card should load fine with no wallet. Tap a wish → choose an amount →
you get **"Open in Nimiq Pay"**. Tap it and confirm the app opens on the *same* gift,
with the amount and wish already filled in.

---

## The three things we still don't know

These are the outstanding device checks. If anything here surprises you, tell me the
exact behaviour — each one is isolated to a single file, so fixing it is a small change.

| # | What to watch | Where it's handled |
|---|---|---|
| 1 | Does **Connect Nimiq Wallet → approve signature** actually log you in? | `src/lib/nimiq/verifySignature.ts` |
| 2 | After approving a gift, does it move to **"verifying"** and then **"Gift confirmed"**? If it sticks on "verifying" forever, the wallet returned something other than a plain transaction hash. | `src/lib/nimiq/txResult.ts` |
| 3 | Does **"Open in Nimiq Pay"** land on the same NIMday *and the same gift*, or does it drop the path and open a bare page? | `src/lib/nimiq/deepLink.ts` |

For #2 specifically: even if the app looks stuck, the worker's reconciliation sweep
should still find and credit the payment within a minute or so. If it does, that tells
us the hash handling is the problem and not the verification.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `Can't reach database server` | shell 1 (`npm run db:dev`) isn't running |
| `PGlite failed to initialize properly` | the `.pglite` folder is half-written (usually from killing shell 1 mid-write, or OneDrive syncing it). Delete `.pglite`, start shell 1 again, re-run `npm run db:push`. |
| `EADDRINUSE :5433` or `:3000` | an old shell is still alive. Close it, or end stray `node.exe` processes in Task Manager. |
| Pages load but nothing saves | run `npm run db:push` once |
| `Dev login is disabled` | `ALLOW_DEV_LOGIN="1"` must be in `.env`, and don't use `npm start` (that's production mode) |
| "Use a test wallet" button missing | `NEXT_PUBLIC_ALLOW_DEV_WALLET="1"` in `.env`, then restart `npm run dev` |
| Gift stays "verifying" on testnet | worker must be running **and** `NIMIQ_NETWORK="testalbatross"` in `.env` |
| Phone can't load the page | Windows Firewall → allow Node on Private networks; same Wi-Fi; use the Wi-Fi IP not the WSL one |
| Want a clean slate | stop shell 1, delete the `.pglite` folder, start again from step 1 |

## Resetting

Stop both servers first (Ctrl+C in shells 1 and 2), then:

```
rmdir /s /q .pglite
```

Then start over: `npm run db:dev` in shell 1, `npm run db:push` and `npm run dev`
in shell 2.
