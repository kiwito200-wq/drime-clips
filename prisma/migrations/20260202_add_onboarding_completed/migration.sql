-- Add onboardingCompletedAt field to User table
-- This tracks when a user completed the onboarding tour (persists across browsers)

ALTER TABLE "User" ADD COLUMN "onboardingCompletedAt" TIMESTAMP(3);
