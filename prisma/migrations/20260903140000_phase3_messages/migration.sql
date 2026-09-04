-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "birthdayId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "senderName" TEXT,
    "senderAddress" TEXT,
    "anonymous" BOOLEAN NOT NULL DEFAULT false,
    "giftId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Message_birthdayId_createdAt_idx" ON "Message"("birthdayId", "createdAt");

-- CreateIndex
CREATE INDEX "Message_giftId_idx" ON "Message"("giftId");

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_birthdayId_fkey" FOREIGN KEY ("birthdayId") REFERENCES "Birthday"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_giftId_fkey" FOREIGN KEY ("giftId") REFERENCES "Gift"("id") ON DELETE SET NULL ON UPDATE CASCADE;
