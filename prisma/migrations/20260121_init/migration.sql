-- CreateTable (idempotent - only creates if doesn't exist)
CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "avatarUrl" TEXT,
    "passwordHash" TEXT,
    "drimeUserId" TEXT,
    "drimeToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable (idempotent - only creates if doesn't exist)
CREATE TABLE IF NOT EXISTS "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable (idempotent - only creates if doesn't exist)
CREATE TABLE IF NOT EXISTS "Envelope" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "message" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "pdfUrl" TEXT NOT NULL,
    "pdfHash" TEXT NOT NULL,
    "finalPdfUrl" TEXT,
    "finalPdfHash" TEXT,
    "signingOrder" TEXT NOT NULL DEFAULT 'parallel',
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "Envelope_pkey" PRIMARY KEY ("id")
);

-- CreateTable (idempotent - only creates if doesn't exist)
CREATE TABLE IF NOT EXISTS "Signer" (
    "id" TEXT NOT NULL,
    "envelopeId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "color" TEXT NOT NULL DEFAULT '#EF4444',
    "order" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "token" TEXT NOT NULL,
    "signedAt" TIMESTAMP(3),
    "viewedAt" TIMESTAMP(3),
    "declinedAt" TIMESTAMP(3),
    "declineReason" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Signer_pkey" PRIMARY KEY ("id")
);

-- CreateTable (idempotent - only creates if doesn't exist)
CREATE TABLE IF NOT EXISTS "Field" (
    "id" TEXT NOT NULL,
    "envelopeId" TEXT NOT NULL,
    "signerId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "label" TEXT,
    "placeholder" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "page" INTEGER NOT NULL,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,
    "width" DOUBLE PRECISION NOT NULL,
    "height" DOUBLE PRECISION NOT NULL,
    "value" TEXT,
    "filledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Field_pkey" PRIMARY KEY ("id")
);

-- CreateTable (idempotent - only creates if doesn't exist)
CREATE TABLE IF NOT EXISTS "AuditLog" (
    "id" TEXT NOT NULL,
    "envelopeId" TEXT NOT NULL,
    "signerId" TEXT,
    "action" TEXT NOT NULL,
    "details" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (idempotent)
CREATE UNIQUE INDEX IF NOT EXISTS IF NOT EXISTS "User_email_key" ON "User"("email");

-- CreateIndex (idempotent)
CREATE UNIQUE INDEX IF NOT EXISTS IF NOT EXISTS "User_drimeUserId_key" ON "User"("drimeUserId");

-- CreateIndex (idempotent)
CREATE INDEX IF NOT EXISTS IF NOT EXISTS "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "User_drimeUserId_idx" ON "User"("drimeUserId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Session_token_key" ON "Session"("token");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Session_token_idx" ON "Session"("token");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Envelope_slug_key" ON "Envelope"("slug");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Envelope_userId_idx" ON "Envelope"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Envelope_status_idx" ON "Envelope"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Envelope_slug_idx" ON "Envelope"("slug");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Signer_token_key" ON "Signer"("token");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Signer_envelopeId_idx" ON "Signer"("envelopeId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Signer_token_idx" ON "Signer"("token");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Signer_email_idx" ON "Signer"("email");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Field_envelopeId_idx" ON "Field"("envelopeId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Field_signerId_idx" ON "Field"("signerId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AuditLog_envelopeId_idx" ON "AuditLog"("envelopeId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AuditLog_action_idx" ON "AuditLog"("action");

-- AddForeignKey (idempotent - only adds if doesn't exist)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Session_userId_fkey') THEN
        ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Envelope_userId_fkey') THEN
        ALTER TABLE "Envelope" ADD CONSTRAINT "Envelope_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Signer_envelopeId_fkey') THEN
        ALTER TABLE "Signer" ADD CONSTRAINT "Signer_envelopeId_fkey" FOREIGN KEY ("envelopeId") REFERENCES "Envelope"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Field_envelopeId_fkey') THEN
        ALTER TABLE "Field" ADD CONSTRAINT "Field_envelopeId_fkey" FOREIGN KEY ("envelopeId") REFERENCES "Envelope"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Field_signerId_fkey') THEN
        ALTER TABLE "Field" ADD CONSTRAINT "Field_signerId_fkey" FOREIGN KEY ("signerId") REFERENCES "Signer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AuditLog_envelopeId_fkey') THEN
        ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_envelopeId_fkey" FOREIGN KEY ("envelopeId") REFERENCES "Envelope"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AuditLog_signerId_fkey') THEN
        ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_signerId_fkey" FOREIGN KEY ("signerId") REFERENCES "Signer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
