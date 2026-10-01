-- CreateEnum
CREATE TYPE "KnowledgeArticleKind" AS ENUM ('ARTICLE', 'RUNBOOK');

-- CreateEnum
CREATE TYPE "KnowledgeArticleStatus" AS ENUM ('DRAFT', 'REVIEW', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "RunbookUsageOutcome" AS ENUM ('RESOLVED', 'PARTIALLY_RESOLVED', 'NOT_RESOLVED');

-- CreateTable
CREATE TABLE "KnowledgeCategory" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeTag" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KnowledgeTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeTagLink" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "KnowledgeTagLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeArticle" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "kind" "KnowledgeArticleKind" NOT NULL DEFAULT 'ARTICLE',
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "content" TEXT,
    "status" "KnowledgeArticleStatus" NOT NULL DEFAULT 'DRAFT',
    "categoryId" TEXT,
    "authorId" TEXT,
    "authorName" TEXT NOT NULL,
    "currentVersion" INTEGER NOT NULL DEFAULT 1,
    "versionCount" INTEGER NOT NULL DEFAULT 1,
    "views" INTEGER NOT NULL DEFAULT 0,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "resolvedCount" INTEGER NOT NULL DEFAULT 0,
    "incidentCategoryKey" TEXT,
    "incidentSeverity" "IncidentSeverity",
    "assetTypeKey" TEXT,
    "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "problem" TEXT,
    "symptoms" TEXT,
    "diagnosis" TEXT,
    "prerequisites" TEXT,
    "validation" TEXT,
    "rollback" TEXT,
    "escalation" TEXT,
    "references" TEXT,
    "publishedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeArticle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RunbookStep" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "instruction" TEXT NOT NULL,
    "expected" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "warning" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RunbookStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeArticleVersion" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "content" TEXT,
    "steps" JSONB,
    "note" TEXT NOT NULL,
    "authorId" TEXT,
    "authorName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KnowledgeArticleVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RunbookUsage" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "incidentId" TEXT,
    "incidentCode" TEXT,
    "userId" TEXT,
    "userName" TEXT NOT NULL,
    "outcome" "RunbookUsageOutcome" NOT NULL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "stepsCompleted" INTEGER,
    "notes" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RunbookUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeCategory_key_key" ON "KnowledgeCategory"("key");

-- CreateIndex
CREATE INDEX "KnowledgeCategory_active_name_idx" ON "KnowledgeCategory"("active", "name");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeTag_label_key" ON "KnowledgeTag"("label");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeTag_slug_key" ON "KnowledgeTag"("slug");

-- CreateIndex
CREATE INDEX "KnowledgeTag_label_idx" ON "KnowledgeTag"("label");

-- CreateIndex
CREATE INDEX "KnowledgeTagLink_tagId_idx" ON "KnowledgeTagLink"("tagId");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeTagLink_articleId_tagId_key" ON "KnowledgeTagLink"("articleId", "tagId");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeArticle_code_key" ON "KnowledgeArticle"("code");

-- CreateIndex
CREATE INDEX "KnowledgeArticle_kind_status_idx" ON "KnowledgeArticle"("kind", "status");

-- CreateIndex
CREATE INDEX "KnowledgeArticle_status_categoryId_idx" ON "KnowledgeArticle"("status", "categoryId");

-- CreateIndex
CREATE INDEX "KnowledgeArticle_incidentCategoryKey_status_idx" ON "KnowledgeArticle"("incidentCategoryKey", "status");

-- CreateIndex
CREATE INDEX "KnowledgeArticle_incidentSeverity_status_idx" ON "KnowledgeArticle"("incidentSeverity", "status");

-- CreateIndex
CREATE INDEX "KnowledgeArticle_updatedAt_idx" ON "KnowledgeArticle"("updatedAt");

-- CreateIndex
CREATE INDEX "KnowledgeArticle_publishedAt_idx" ON "KnowledgeArticle"("publishedAt");

-- CreateIndex
CREATE INDEX "RunbookStep_articleId_idx" ON "RunbookStep"("articleId");

-- CreateIndex
CREATE UNIQUE INDEX "RunbookStep_articleId_order_key" ON "RunbookStep"("articleId", "order");

-- CreateIndex
CREATE INDEX "KnowledgeArticleVersion_articleId_createdAt_idx" ON "KnowledgeArticleVersion"("articleId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeArticleVersion_articleId_number_key" ON "KnowledgeArticleVersion"("articleId", "number");

-- CreateIndex
CREATE INDEX "RunbookUsage_articleId_createdAt_idx" ON "RunbookUsage"("articleId", "createdAt");

-- CreateIndex
CREATE INDEX "RunbookUsage_incidentId_idx" ON "RunbookUsage"("incidentId");

-- CreateIndex
CREATE INDEX "RunbookUsage_outcome_idx" ON "RunbookUsage"("outcome");

-- CreateIndex
CREATE INDEX "RunbookUsage_userId_createdAt_idx" ON "RunbookUsage"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "KnowledgeTagLink" ADD CONSTRAINT "KnowledgeTagLink_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "KnowledgeArticle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeTagLink" ADD CONSTRAINT "KnowledgeTagLink_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "KnowledgeTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeArticle" ADD CONSTRAINT "KnowledgeArticle_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "KnowledgeCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RunbookStep" ADD CONSTRAINT "RunbookStep_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "KnowledgeArticle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeArticleVersion" ADD CONSTRAINT "KnowledgeArticleVersion_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "KnowledgeArticle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RunbookUsage" ADD CONSTRAINT "RunbookUsage_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "KnowledgeArticle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

