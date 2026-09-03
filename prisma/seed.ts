/**
 * Optional local seed — one published demo NIMday so `/b/<slug>` has something
 * to show without walking the creator flow. Safe to run repeatedly.
 *
 *   npm run db:seed
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const address = "NQ07 DEMO 0000 0000 0000 0000 0000 0000 0000";

  const user = await prisma.user.upsert({
    where: { walletAddress: address },
    update: {},
    create: { walletAddress: address },
  });

  const nextMonth = new Date();
  nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1, 12);

  await prisma.birthday.upsert({
    where: { creatorId: user.id },
    update: {},
    create: {
      creatorId: user.id,
      slug: "demo-nimday",
      name: "Alex",
      birthday: new Date(
        Date.UTC(1996, nextMonth.getUTCMonth(), nextMonth.getUTCDate()),
      ),
      message: "Thanks for stopping by — a few things I'd genuinely love this year 💛",
      theme: "goldenHour",
      published: true,
      publishedAt: new Date(),
      wishes: {
        create: [
          {
            title: "Good headphones",
            description: "Over-ear, the ones that actually block out the office",
            targetAmount: 120,
            currency: "NIM",
            giftType: "FUND",
            sortOrder: 0,
          },
          {
            title: "A pottery class",
            targetAmount: 45,
            currency: "NIM",
            giftType: "EITHER",
            sortOrder: 1,
          },
        ],
      },
    },
  });

  console.log("Seeded /b/demo-nimday");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
