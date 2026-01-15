-- AlterTable
ALTER TABLE "PageView" ADD COLUMN     "browser" TEXT,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "device" TEXT,
ADD COLUMN     "ipAddress" TEXT,
ADD COLUMN     "os" TEXT;

-- CreateIndex
CREATE INDEX "PageView_ipAddress_idx" ON "PageView"("ipAddress");
