-- SECURITY: Add token expiration to Signer table
-- This migration adds a tokenExpiresAt column for signing link expiration

ALTER TABLE "Signer" ADD COLUMN "tokenExpiresAt" TIMESTAMP(3);

-- Set default expiration for existing tokens (30 days from now for backward compatibility)
UPDATE "Signer" 
SET "tokenExpiresAt" = NOW() + INTERVAL '30 days' 
WHERE "tokenExpiresAt" IS NULL AND "status" NOT IN ('signed', 'declined');
