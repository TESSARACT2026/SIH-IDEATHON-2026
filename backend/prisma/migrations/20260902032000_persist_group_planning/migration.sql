-- CreateTable
CREATE TABLE "group_sessions" (
  "id" TEXT NOT NULL,
  "join_code" TEXT NOT NULL,
  "creator_id" TEXT NOT NULL,
  "destination_id" TEXT NOT NULL,
  "start_date" TIMESTAMP(3) NOT NULL,
  "days" INTEGER NOT NULL,
  "title" TEXT NOT NULL DEFAULT 'Group Trip',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "group_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "group_participants" (
  "id" TEXT NOT NULL,
  "group_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "preferences" JSONB NOT NULL,
  "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "group_participants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "group_sessions_join_code_key" ON "group_sessions"("join_code");

-- CreateIndex
CREATE INDEX "group_sessions_creator_id_idx" ON "group_sessions"("creator_id");

-- CreateIndex
CREATE INDEX "group_sessions_destination_id_idx" ON "group_sessions"("destination_id");

-- CreateIndex
CREATE INDEX "group_participants_group_id_submitted_at_idx" ON "group_participants"("group_id", "submitted_at");

-- AddForeignKey
ALTER TABLE "group_sessions" ADD CONSTRAINT "group_sessions_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_sessions" ADD CONSTRAINT "group_sessions_destination_id_fkey" FOREIGN KEY ("destination_id") REFERENCES "destinations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_participants" ADD CONSTRAINT "group_participants_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "group_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
