import { apiClient } from '../client';
import { PlannerInput, ItineraryPlanResponse, ItineraryItem } from '../../types/domain';
import { DEFAULT_ATTRACTIONS } from './knowledgeApi';

export const plannerApi = {
  generateItinerary: async (input: PlannerInput): Promise<ItineraryPlanResponse> => {
    try {
      const response = await apiClient.post<{ data: ItineraryPlanResponse }>('/planner/generate', input);
      if (response.data?.data && response.data.data.itineraryItems?.length > 0) {
        return response.data.data;
      }
      return generateFallbackPlan(input);
    } catch {
      return generateFallbackPlan(input);
    }
  },
};

function generateFallbackPlan(input: PlannerInput): ItineraryPlanResponse {
  // Use city-specific attractions; do NOT fall back to another city
  const destAttractions = DEFAULT_ATTRACTIONS[input.destinationId] || [];

  // Filter based on wheelchair if requested
  const filtered = input.preferences.accessibilityWheelchair
    ? destAttractions.filter((a) => a.accessibilityWheelchair)
    : destAttractions;

  const pool = filtered.length > 0 ? filtered : destAttractions;

  // Max stops per day based on pace
  const maxStopsPerDay =
    input.preferences.pace === 'RELAXED' ? 2 : input.preferences.pace === 'PACKED' ? 4 : 3;

  const totalCapacity = input.days * maxStopsPerDay;

  // Build a non-repeating ordered list of attractions.
  // If we need more stops than unique attractions, we note it in warnings.
  const orderedPool: typeof pool = [];
  if (pool.length === 0) {
    // Nothing to schedule
  } else if (totalCapacity <= pool.length) {
    // Enough unique attractions — just slice
    orderedPool.push(...pool.slice(0, totalCapacity));
  } else {
    // More days requested than attractions available.
    // Fill only with unique attractions — do not repeat.
    orderedPool.push(...pool);
  }

  const itineraryItems: ItineraryItem[] = [];
  let globalIdx = 0;

  for (let day = 1; day <= input.days; day++) {
    const stopsToday = Math.min(maxStopsPerDay, orderedPool.length - globalIdx);
    if (stopsToday <= 0) break; // No more unique stops to add

    let startHour = 9;

    for (let s = 1; s <= stopsToday; s++) {
      const candidate = orderedPool[globalIdx];
      const startTime = `${String(startHour).padStart(2, '0')}:00`;
      const endTime = `${String(startHour + 2).padStart(2, '0')}:00`;

      itineraryItems.push({
        dayNumber: day,
        sequence: s,
        entityType: 'attraction',
        entityId: candidate.id,
        attractionName: candidate.name,
        startTime,
        endTime,
        travelBufferMinutesBefore: s === 1 ? 0 : 25,
        trustSummary: {
          overall_status: 'UNVERIFIED',
          warnings: ['Demo fallback plan generated while the backend planner was unavailable. Confirm critical details before visiting.'],
          facts: [
            {
              fact_id: `fact-${candidate.id}-hours`,
              fact_key: 'opening_hours',
              fact_value: { open: '08:00', close: '19:00' },
              source_name: 'Demo fallback data',
              source_type: 'AI_INFERENCE',
              verification_status: 'UNVERIFIED',
              confidence: 0.5,
              timestamp: new Date().toISOString(),
              last_checked: new Date().toISOString(),
            },
            {
              fact_id: `fact-${candidate.id}-access`,
              fact_key: 'accessibility',
              fact_value: {
                wheelchair_accessible: candidate.accessibilityWheelchair,
                notes: candidate.accessibilityNotes || 'Demo accessibility note; confirm before visiting',
              },
              source_name: 'Demo fallback data',
              source_type: 'AI_INFERENCE',
              verification_status: 'UNVERIFIED',
              confidence: 0.5,
              timestamp: new Date().toISOString(),
              last_checked: new Date().toISOString(),
            },
          ],
        },
      });

      startHour += 3;
      globalIdx++;
    }
  }

  const warnings: string[] = [
    'Demo fallback plan: backend planner was unavailable, so critical facts are marked unverified. Confirm details before visiting.',
  ];

  if (totalCapacity > pool.length && pool.length > 0) {
    const diff = totalCapacity - pool.length;
    warnings.push(
      `Only ${pool.length} unique demo stops are available for this city. ${diff} slot(s) could not be filled without repeating attractions.`
    );
  }

  if (pool.length === 0) {
    warnings.push('No attractions are available for the selected destination in offline mode.');
  }

  const excluded = input.preferences.accessibilityWheelchair
    ? destAttractions
        .filter((a) => !a.accessibilityWheelchair)
        .map((a) => ({
          entityId: a.id,
          attractionName: a.name,
          reason: 'Excluded due to strict wheelchair accessibility filter (steps/uneven terrain present)',
          verificationStatus: 'UNVERIFIED' as const,
        }))
    : [];

  return {
    destinationId: input.destinationId,
    days: input.days,
    itineraryItems,
    excluded,
    warnings,
  };
}
