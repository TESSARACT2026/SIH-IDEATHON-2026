import { apiClient } from '../client';
import type { Attraction } from '../../types/domain';

export interface NearbyAttraction extends Attraction {
  destination: { id: string; name: string; region: string | null; country: string };
  distanceKm: number;
}

export const nearbyApi = {
  findAttractions: async (params: {
    lat: number;
    lon: number;
    radiusKm?: number;
    limit?: number;
    destinationId?: string;
  }): Promise<NearbyAttraction[]> => {
    const { data } = await apiClient.get<{ data: NearbyAttraction[] }>('/nearby', { params });
    return data.data;
  },
};
