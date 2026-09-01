import { apiClient } from '../client';
import type { CrowdLevel } from '../../types/domain';

export interface CrowdRecord {
  id: string;
  attractionId: string;
  currentCrowdLevel: CrowdLevel;
  capacityValue: number | null;
  verificationStatus: string;
  timestamp: string;
  source: { id: string; name: string; sourceType: string } | null;
}

export interface CrowdLookup {
  attractionId: string;
  attraction: { id: string; name: string };
  latest: CrowdRecord | null;
}

export const crowdApi = {
  getAttractionCrowd: async (attractionId: string): Promise<CrowdLookup> => {
    const { data } = await apiClient.get<{ data: CrowdLookup }>(`/crowd/attractions/${attractionId}`);
    return data.data;
  },

  report: async (payload: {
    attractionId: string;
    currentCrowdLevel: CrowdLevel;
    capacityValue?: number;
  }): Promise<CrowdRecord> => {
    const { data } = await apiClient.post<{ data: CrowdRecord }>('/crowd/reports', payload);
    return data.data;
  },
};
