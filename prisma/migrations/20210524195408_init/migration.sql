-- CreateTable
CREATE TABLE "VerificationCode" (
    "code" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userSub" TEXT NOT NULL,

    PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "User" (
    "sub" TEXT NOT NULL,
    "twitterUserId" TEXT NOT NULL,
    "twitterAccessToken" TEXT NOT NULL,
    "twitterTokenSecret" TEXT NOT NULL,
    "email" TEXT,
    "isEmailVerified" BOOLEAN,
    "isActive" BOOLEAN NOT NULL DEFAULT false,

    PRIMARY KEY ("sub")
);

-- CreateTable
CREATE TABLE "GeneratedTweets" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "text" TEXT NOT NULL,
    "liked" BOOLEAN NOT NULL DEFAULT false,
    "settingsTemperature" DOUBLE PRECISION NOT NULL,
    "settingsPresencePenalty" DOUBLE PRECISION NOT NULL,
    "settingsFrequencyPenalty" DOUBLE PRECISION NOT NULL,
    "userSub" TEXT NOT NULL,

    PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VerificationCode_userSub_unique" ON "VerificationCode"("userSub");

-- AddForeignKey
ALTER TABLE "VerificationCode" ADD FOREIGN KEY ("userSub") REFERENCES "User"("sub") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedTweets" ADD FOREIGN KEY ("userSub") REFERENCES "User"("sub") ON DELETE CASCADE ON UPDATE CASCADE;
