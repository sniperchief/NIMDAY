-- CreateEnum
CREATE TYPE "PaymentIntentStatus" AS ENUM ('CREATED', 'SUBMITTED', 'PENDING', 'CONFIRMED', 'FAILED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "GiftStatus" AS ENUM ('CONFIRMED', 'REVERSED');

-- AlterTable
ALTER TABLE "Wish" ADD COLUMN     "raisedLuna" BIGINT NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "PaymentIntent" (
    "id" TEXT NOT NULL,
    "birthdayId" TEXT NOT NULL,
    "wishId" TEXT NOT NULL,
    "recipientAddress" TEXT NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'NIM',
    "expectedAmountLuna" BIGINT NOT NULL,
    "minAmountLuna" BIGINT NOT NULL,
    "shortId" TEXT NOT NULL,
    "memo" TEXT NOT NULL,
    "anonymous" BOOLEAN NOT NULL DEFAULT false,
    "senderAddress" TEXT,
    "txHash" TEXT,
    "status" "PaymentIntentStatus" NOT NULL DEFAULT 'CREATED',
    "failureReason" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentIntent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Gift" (
    "id" TEXT NOT NULL,
    "paymentIntentId" TEXT NOT NULL,
    "birthdayId" TEXT NOT NULL,
    "wishId" TEXT NOT NULL,
    "senderAddress" TEXT NOT NULL,
    "recipientAddress" TEXT NOT NULL,
    "amountLuna" BIGINT NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'NIM',
    "txHash" TEXT NOT NULL,
    "shortId" TEXT NOT NULL,
    "anonymous" BOOLEAN NOT NULL DEFAULT false,
    "status" "GiftStatus" NOT NULL DEFAULT 'CONFIRMED',
    "confirmedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Gift_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcessedTransaction" (
    "txHash" TEXT NOT NULL,
    "chain" TEXT NOT NULL DEFAULT 'nimiq',
    "paymentIntentId" TEXT,
    "giftId" TEXT,
    "creditedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reversedAt" TIMESTAMP(3),

    CONSTRAINT "ProcessedTransaction_pkey" PRIMARY KEY ("txHash")
);

-- CreateTable
CREATE TABLE "WorkerCheckpoint" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "lastScannedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastNote" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkerCheckpoint_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentIntent_shortId_key" ON "PaymentIntent"("shortId");

-- CreateIndex
CREATE INDEX "PaymentIntent_status_idx" ON "PaymentIntent"("status");

-- CreateIndex
CREATE INDEX "PaymentIntent_birthdayId_idx" ON "PaymentIntent"("birthdayId");

-- CreateIndex
CREATE INDEX "PaymentIntent_txHash_idx" ON "PaymentIntent"("txHash");

-- CreateIndex
CREATE UNIQUE INDEX "Gift_paymentIntentId_key" ON "Gift"("paymentIntentId");

-- CreateIndex
CREATE UNIQUE INDEX "Gift_txHash_key" ON "Gift"("txHash");

-- CreateIndex
CREATE INDEX "Gift_birthdayId_idx" ON "Gift"("birthdayId");

-- CreateIndex
CREATE INDEX "Gift_wishId_idx" ON "Gift"("wishId");

-- AddForeignKey
ALTER TABLE "PaymentIntent" ADD CONSTRAINT "PaymentIntent_birthdayId_fkey" FOREIGN KEY ("birthdayId") REFERENCES "Birthday"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentIntent" ADD CONSTRAINT "PaymentIntent_wishId_fkey" FOREIGN KEY ("wishId") REFERENCES "Wish"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Gift" ADD CONSTRAINT "Gift_paymentIntentId_fkey" FOREIGN KEY ("paymentIntentId") REFERENCES "PaymentIntent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Gift" ADD CONSTRAINT "Gift_birthdayId_fkey" FOREIGN KEY ("birthdayId") REFERENCES "Birthday"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Gift" ADD CONSTRAINT "Gift_wishId_fkey" FOREIGN KEY ("wishId") REFERENCES "Wish"("id") ON DELETE CASCADE ON UPDATE CASCADE;

