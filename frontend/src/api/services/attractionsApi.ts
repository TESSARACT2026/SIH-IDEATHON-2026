import { apiClient } from '../client';
import { Attraction, FactProvenance } from '../../types/domain';

const DEFAULT_FACTS: Record<string, FactProvenance[]> = {
  'lingaraj-temple': [
    {
      fact_id: 'fact-lingaraj-hours',
      fact_key: 'opening_hours',
      fact_value: { open: '06:00', close: '21:00' },
      source_name: 'Odisha Tourism Development Corporation (OTDC)',
      source_type: 'OFFICIAL_TOURISM',
      verification_status: 'VERIFIED',
      confidence: 0.98,
      timestamp: new Date().toISOString(),
      last_checked: new Date().toISOString(),
    },
    {
      fact_id: 'fact-lingaraj-ticket',
      fact_key: 'ticket_price',
      fact_value: { inr: 0, note: 'Free general darshan' },
      source_name: 'Temple Administration Board',
      source_type: 'GOVERNMENT',
      verification_status: 'VERIFIED',
      confidence: 1.0,
      timestamp: new Date().toISOString(),
      last_checked: new Date().toISOString(),
    },
    {
      fact_id: 'fact-lingaraj-access',
      fact_key: 'accessibility',
      fact_value: { wheelchair_accessible: false, ramps: 'Not available at inner sanctum' },
      source_name: 'Archaeological Survey of India (ASI)',
      source_type: 'GOVERNMENT',
      verification_status: 'VERIFIED',
      confidence: 0.95,
      timestamp: new Date().toISOString(),
      last_checked: new Date().toISOString(),
    },
  ],
  'odisha-state-museum': [
    {
      fact_id: 'fact-museum-hours',
      fact_key: 'opening_hours',
      fact_value: { open: '10:00', close: '17:00', closed_on: 'Monday' },
      source_name: 'Odisha State Department of Culture',
      source_type: 'GOVERNMENT',
      verification_status: 'VERIFIED',
      confidence: 1.0,
      timestamp: new Date().toISOString(),
      last_checked: new Date().toISOString(),
    },
    {
      fact_id: 'fact-museum-ticket',
      fact_key: 'ticket_price',
      fact_value: { adult: 20, child: 10, foreign_national: 100 },
      source_name: 'Official Museum Registry',
      source_type: 'OFFICIAL_TOURISM',
      verification_status: 'VERIFIED',
      confidence: 0.99,
      timestamp: new Date().toISOString(),
      last_checked: new Date().toISOString(),
    },
    {
      fact_id: 'fact-museum-access',
      fact_key: 'accessibility',
      fact_value: { wheelchair_accessible: true, ramps: 'Available at main gate and east wing' },
      source_name: 'State Accessibility Audit Directorate',
      source_type: 'GOVERNMENT',
      verification_status: 'VERIFIED',
      confidence: 0.99,
      timestamp: new Date().toISOString(),
      last_checked: new Date().toISOString(),
    },
  ],
  'dhauli-shanti-stupa': [
    {
      fact_id: 'fact-dhauli-hours',
      fact_key: 'opening_hours',
      fact_value: { open: '06:00', close: '19:00', light_and_sound: '19:00 - 20:00' },
      source_name: 'Odisha Tourism Official',
      source_type: 'OFFICIAL_TOURISM',
      verification_status: 'VERIFIED',
      confidence: 0.97,
      timestamp: new Date().toISOString(),
      last_checked: new Date().toISOString(),
    },
    {
      fact_id: 'fact-dhauli-access',
      fact_key: 'accessibility',
      fact_value: { wheelchair_accessible: true, parking: 'Step-free access from top parking' },
      source_name: 'National Tourism Infrastructure Assessment',
      source_type: 'GOVERNMENT',
      verification_status: 'VERIFIED',
      confidence: 0.96,
      timestamp: new Date().toISOString(),
      last_checked: new Date().toISOString(),
    },
  ],
};

function asDemoFacts(facts: FactProvenance[]): FactProvenance[] {
  return facts.map((fact) => ({
    ...fact,
    source_name: `Demo fallback: ${fact.source_name}`,
    source_type: 'AI_INFERENCE',
    verification_status: 'UNVERIFIED',
    confidence: Math.min(fact.confidence, 0.5),
  }));
}

export const attractionsApi = {
  getAttractionFacts: async (attractionId: string): Promise<FactProvenance[]> => {
    try {
      const response = await apiClient.get<{ data: FactProvenance[] }>(`/attractions/${attractionId}/facts`);
      if (response.data?.data && response.data.data.length > 0) {
        return response.data.data;
      }
      return asDemoFacts(DEFAULT_FACTS[attractionId] || [
        {
          fact_id: `fact-${attractionId}-hours`,
          fact_key: 'opening_hours',
          fact_value: { open: '09:00', close: '18:00' },
          source_name: 'Demo fallback data',
          source_type: 'AI_INFERENCE',
          verification_status: 'UNVERIFIED',
          confidence: 0.5,
          timestamp: new Date().toISOString(),
          last_checked: new Date().toISOString(),
        },
      ]);
    } catch {
      return asDemoFacts(DEFAULT_FACTS[attractionId] || [
        {
          fact_id: `fact-${attractionId}-hours`,
          fact_key: 'opening_hours',
          fact_value: { open: '09:00', close: '18:00' },
          source_name: 'Demo fallback data',
          source_type: 'AI_INFERENCE',
          verification_status: 'UNVERIFIED',
          confidence: 0.5,
          timestamp: new Date().toISOString(),
          last_checked: new Date().toISOString(),
        },
      ]);
    }
  },

  getAlternatives: async (attractionId: string): Promise<Attraction[]> => {
    const response = await apiClient.get<{ data: Attraction[] }>(`/attractions/${attractionId}/alternatives`);
    return response.data.data;
  },
};
