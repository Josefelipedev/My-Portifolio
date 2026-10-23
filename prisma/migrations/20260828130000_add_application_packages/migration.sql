-- CreateTable
CREATE TABLE "ApplicationPackage" (
    "id" TEXT NOT NULL,
    "savedJobId" TEXT NOT NULL,
    "applicationId" TEXT,
    "version" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "reviewStatus" TEXT NOT NULL DEFAULT 'pending',
    "atsStatus" TEXT NOT NULL DEFAULT 'pending',
    "model" TEXT,
    "recipient" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApplicationPackage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationArtifact" (
    "id" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "content" TEXT,
    "mimeType" TEXT,
    "sha256" TEXT,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApplicationArtifact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ApplicationPackage_savedJobId_version_key" ON "ApplicationPackage"("savedJobId", "version");
CREATE INDEX "ApplicationPackage_savedJobId_createdAt_idx" ON "ApplicationPackage"("savedJobId", "createdAt");
CREATE INDEX "ApplicationPackage_applicationId_idx" ON "ApplicationPackage"("applicationId");
CREATE INDEX "ApplicationPackage_status_idx" ON "ApplicationPackage"("status");
CREATE INDEX "ApplicationArtifact_packageId_kind_idx" ON "ApplicationArtifact"("packageId", "kind");
CREATE INDEX "ApplicationArtifact_createdAt_idx" ON "ApplicationArtifact"("createdAt");

-- AddForeignKey
ALTER TABLE "ApplicationPackage" ADD CONSTRAINT "ApplicationPackage_savedJobId_fkey" FOREIGN KEY ("savedJobId") REFERENCES "SavedJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ApplicationPackage" ADD CONSTRAINT "ApplicationPackage_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "JobApplication"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ApplicationArtifact" ADD CONSTRAINT "ApplicationArtifact_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "ApplicationPackage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
