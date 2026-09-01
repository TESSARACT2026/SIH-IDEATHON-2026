-- CreateIndex
CREATE INDEX "attractions_destination_id_idx" ON "attractions"("destination_id");

-- CreateIndex
CREATE INDEX "facts_source_id_idx" ON "facts"("source_id");

-- CreateIndex
CREATE INDEX "verification_records_fact_id_idx" ON "verification_records"("fact_id");

-- CreateIndex
CREATE INDEX "verification_records_source_id_idx" ON "verification_records"("source_id");

-- CreateIndex
CREATE INDEX "crowd_capacity_records_attraction_id_timestamp_idx" ON "crowd_capacity_records"("attraction_id", "timestamp");

-- CreateIndex
CREATE INDEX "crowd_capacity_records_source_id_idx" ON "crowd_capacity_records"("source_id");

-- CreateIndex
CREATE INDEX "sensitivity_flags_attraction_id_idx" ON "sensitivity_flags"("attraction_id");

-- CreateIndex
CREATE INDEX "sensitivity_flags_source_id_idx" ON "sensitivity_flags"("source_id");

-- CreateIndex
CREATE INDEX "local_businesses_destination_id_idx" ON "local_businesses"("destination_id");

-- CreateIndex
CREATE INDEX "local_businesses_ownership_evidence_source_id_idx" ON "local_businesses"("ownership_evidence_source_id");

-- CreateIndex
CREATE INDEX "trips_user_id_start_date_idx" ON "trips"("user_id", "start_date");

-- CreateIndex
CREATE INDEX "trips_destination_id_idx" ON "trips"("destination_id");

-- CreateIndex
CREATE INDEX "itineraries_trip_id_generated_at_idx" ON "itineraries"("trip_id", "generated_at");

-- CreateIndex
CREATE INDEX "itinerary_items_itinerary_id_day_number_sequence_idx" ON "itinerary_items"("itinerary_id", "day_number", "sequence");

-- CreateIndex
CREATE INDEX "itinerary_items_entity_id_idx" ON "itinerary_items"("entity_id");

-- CreateIndex
CREATE INDEX "feedback_user_id_idx" ON "feedback"("user_id");

-- CreateIndex
CREATE INDEX "feedback_fact_id_idx" ON "feedback"("fact_id");

-- CreateIndex
CREATE INDEX "feedback_status_created_at_idx" ON "feedback"("status", "created_at");

-- CreateIndex
CREATE INDEX "favorites_attraction_id_idx" ON "favorites"("attraction_id");
