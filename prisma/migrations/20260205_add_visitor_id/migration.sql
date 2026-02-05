-- AlterTable
ALTER TABLE "VideoComment" ADD COLUMN "visitorId" TEXT;

-- CreateIndex
CREATE INDEX "VideoComment_videoId_type_content_visitorId_idx" ON "VideoComment"("videoId", "type", "content", "visitorId");
