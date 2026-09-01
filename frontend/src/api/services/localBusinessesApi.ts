import { apiClient } from '../client';

export interface LocalBusiness {
  id: string;
  name: string;
  category: string;
  latitude: number;
  longitude: number;
  destinationId: string;
  destination?: { id: string; name: string; region: string | null; country: string };
  isLocallyOwned: boolean;
  ownershipSource?: { id: string; name: string; sourceType: string; url: string | null } | null;
  description?: string | null;
}

export const localBusinessesApi = {
  list: async (params: {
    destinationId?: string;
    category?: string;
    locallyOwned?: boolean;
    search?: string;
    limit?: number;
  } = {}): Promise<LocalBusiness[]> => {
    const { data } = await apiClient.get<{ data: LocalBusiness[] }>('/local-businesses', {
      params: {
        ...params,
        locallyOwned: params.locallyOwned === undefined ? undefined : String(params.locallyOwned),
      },
    });
    return data.data;
  },
};
