# NIMday — Product Requirements Document

**Product:** NIMday
**Platform:** Nimiq Pay Mini Apps
**Primary currency:** NIM
**Secondary currency:** USDT
**Tagline:** **Your birthday. Your wishes. One beautiful link.**

> This file is a copy of the PRD provided at project kickoff, kept in-repo for reference.
> The authoritative record of what was built, verified and left open lives in
> `FINAL_READINESS_RESULTS.md`.

---

## 1. What is NIMday?

NIMday is a digital birthday card that also works as a gift wishlist. A person creates their
NIMday, adds things they would like for their birthday, and shares one link with friends and
family. Visitors can view the birthday page without connecting a wallet. If they want to give a
gift, they connect their Nimiq Pay wallet and send NIM directly to the birthday person's wallet.
NIMday verifies the payment and updates the gift's progress. **NIMday never holds user funds.**

## 2. The Problem

Birthday gifting is messy: asking what someone wants, sharing links, sharing payment details,
buying unwanted gifts, coordinating contributions. NIMday puts the birthday, wishes, and gifting
experience in one place. **Create → Share → Choose a wish → Gift → Celebrate.**

## 3. Target Users

- **Birthday Creator** — wants to share wishes, receive useful gifts, give friends an easy way to celebrate them.
- **Gift Giver** — wants to give a gift, doesn't know what to buy, wants to contribute toward something specific.

The product must be useful to the creator even before anyone else visits.

## 4. Core User Flows

**Creator:** Create NIMday → Add birthday details → Add wishes → Connect Nimiq wallet → Preview → Publish → Share link. (< 1 minute for a basic NIMday.)

**Visitor:** Open shared NIMday → View birthday card → Choose a wish → Choose gift amount → Connect wallet → Send NIM → Payment verified → Gift confirmed. (No wallet required just to view.)

## 5. MVP Features

### 5.1 Birthday Card
Creator enters: Name, Birthday, Birthday message, Optional profile photo. Chooses from a small
number of beautiful themes. The public page should feel like a **digital birthday card**, not a
crypto dashboard.

### 5.2 Wishlist
Up to **5 wishes**. Each: Name/title, Image, Description, Target amount, Currency (NIM or USDT), Gift type.

**Gift types:** *Fund this gift* (contribute toward target), *Buy this gift* (creator wants the item), *Either*.

## 6. NIM Gifting
Giver's Nimiq Pay wallet → Birthday creator's wallet → NIMday verifies transaction → Wish progress
updates. NIMday must **not** receive or store the money.

## 7. USDT
Secondary payment option. Must use the network/token configuration currently supported by Nimiq
Pay. Do not assume token addresses or networks. Verify USDT payments the same way as NIM.

## 8. Payment Verification
A payment counts only after NIMday verifies: transaction exists, correct network, correct currency,
correct recipient, correct amount, transaction confirmed, transaction not already used. Only
verified payments update wish progress.

## 9. Anonymous Gifts
A giver can choose *Give anonymously* — NIMday hides their identity from the creator and other
visitors. Anonymous inside NIMday does **not** mean anonymous on the blockchain.

## 10. Wish Progress
Each wish shows current progress (e.g. `80 / 120 NIM`). When target reached: *🎉 Wish fulfilled!*
Progress uses only verified payments. Never encourage spending more than the target.

## 11. Gift Confirmation
After a successful gift: *Gift sent! 🎉* — visitor can return to the card, leave a message, view other wishes.

## 12. Birthday Messages
Visitors can optionally leave a short birthday message. Public or Anonymous.

## 13. Gift Activity
The birthday page can show recent activity (e.g. *🎁 David gifted 20 NIM · Headphones · 5 minutes ago*). Keep it simple.

## 14. Birthday Countdown
Before: *12 days until Sarah's birthday*. On the day: *🎂 Today is Sarah's birthday!*

## 15. Creator Dashboard
A simple **My NIMday** page: card preview, countdown, wishes, wish progress, number of gifts, total
gifted, recent activity. Actions: Edit, Preview, Share, Copy link. No complex analytics.

## 16. Sharing
Every published NIMday gets a unique public link. Copy link + share through supported options.
Works well for WhatsApp. The shared page works without the visitor signing in first.

## 17. Game-Like Elements
Small fun elements only (e.g. a **Birthday Quest**: view the card, choose a wish, send a gift, leave
a message). Not a full game. **Do not reward users for spending more NIM.**

## 18. Design Direction
Premium modern birthday product. Beautiful, warm, personal, modern, playful, mobile-first. Avoid
dark crypto dashboards, neon Web3, excessive gradients, token prices, blockchain jargon, dense
financial tables.

## 19. Wallet Experience
Use the official Nimiq Pay Mini App wallet functionality. Creator connects before publishing
(their wallet receives gifts). Visitor connects only when sending a gift. Never ask for seed
phrases, private keys, or wallet passwords.

## 20. Security
Never store private keys. Never custody funds. Never trust frontend payment claims. Prevent
duplicate transaction crediting. Keep secrets out of the repo. Verify payments before updating
progress.

## 21. Basic Data
**User:** wallet address. **Birthday:** creator, name, birthday, message, theme, image, public
link. **Wish:** birthday, title, image, description, target amount, currency, gift type. **Gift:**
wish, sender, amount, currency, transaction hash, anonymous status, verification status, timestamp.
**Message:** birthday, sender, message, anonymous status, timestamp.

## 22. Growth Loop
Someone creates a NIMday → shares it → friends visit → friends gift / leave messages → friends
discover NIMday → their birthday arrives → they create their own. The birthday is the distribution
mechanism.

## 23. Future Features (NOT MVP)
Gift Memory (a digital memory of gifts given; could become a collectible/NFT). Yearly birthday
history, birthday reminders, more themes, more celebration types (weddings, anniversaries,
graduations, other milestones).

## 24. What Success Looks Like
A real user can Create (birthday page + wishes + connect wallet + publish), Share (send link),
Gift (friend opens link, chooses a wish, connects Nimiq Pay, sends NIM), Verify (NIMday verifies
the transaction), Celebrate (progress updates, creator sees the gift). That complete loop must
work reliably.

## 25. Official Nimiq Resources
- https://nimiq.dev/mini-apps/
- https://nimiq.dev/mini-apps/api-reference/nimiq-provider
- https://nimiq.dev/mini-apps/api-reference/ethereum-provider
- https://nimiq.dev/mini-apps/api-reference/
- https://nimiq.dev/web-client/reference
- https://nimiq.dev/protocol/accounts

Use the official Nimiq documentation as the source of truth. Do not invent APIs. Check current
docs before implementing NIM transfers, USDT transfers, wallet connection, or transaction
verification.

## 26. Product Rule
**NIMday is a birthday product powered by NIM — not a crypto product dressed up as a birthday card.**
