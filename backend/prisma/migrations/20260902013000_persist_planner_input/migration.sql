-- Persist the normalized planner request that produced a saved itinerary.
-- Loaded by trip id, so no JSONB index is needed yet.
ALTER TABLE "trips" ADD COLUMN "planner_input" JSONB;
ALTER TABLE "itineraries" ADD COLUMN "planner_input" JSONB;
