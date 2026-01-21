-- Script to fix failed migration state
-- Run this in Neon SQL Editor before redeploying

-- Delete the failed migration record
DELETE FROM "_prisma_migrations"
WHERE migration_name = '20260121_init'
  AND finished_at IS NULL;

-- The migration will be re-applied on next deploy
-- Since it's now idempotent (IF NOT EXISTS), it will work even if tables exist
