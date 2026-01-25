-- CreateTable (idempotent - only creates if doesn't exist)
CREATE TABLE IF NOT EXISTS "Template" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "pdfUrl" TEXT NOT NULL,
    "pdfHash" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "schema" TEXT NOT NULL,
    "fields" TEXT NOT NULL,
    "submitters" TEXT NOT NULL,
    "folderName" TEXT DEFAULT 'Mes templates',
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Template_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (idempotent)
CREATE UNIQUE INDEX IF NOT EXISTS "Template_slug_key" ON "Template"("slug");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Template_userId_idx" ON "Template"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Template_slug_idx" ON "Template"("slug");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Template_userId_archivedAt_idx" ON "Template"("userId", "archivedAt");

-- AddForeignKey (idempotent - only adds if doesn't exist)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Template_userId_fkey') THEN
        ALTER TABLE "Template" ADD CONSTRAINT "Template_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
