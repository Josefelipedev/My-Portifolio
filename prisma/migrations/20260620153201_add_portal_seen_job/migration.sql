-- CreateTable
CREATE TABLE "PortalSeenJob" (
    "id" TEXT NOT NULL,
    "portalId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PortalSeenJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PortalSeenJob_portalId_idx" ON "PortalSeenJob"("portalId");

-- CreateIndex
CREATE UNIQUE INDEX "PortalSeenJob_portalId_url_key" ON "PortalSeenJob"("portalId", "url");

-- AddForeignKey
ALTER TABLE "PortalSeenJob" ADD CONSTRAINT "PortalSeenJob_portalId_fkey" FOREIGN KEY ("portalId") REFERENCES "CompanyPortal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
