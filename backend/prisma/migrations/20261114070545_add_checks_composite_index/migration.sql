-- CreateIndex
CREATE INDEX "idx_checks_monitor_time" ON "checks"("monitor_id", "checked_at" DESC);
