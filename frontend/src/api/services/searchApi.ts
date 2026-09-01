import { apiClient } from '../client';

export interface SearchResult {
  type: 'destination' | 'attraction';
  id: string;
  title: string;
  subtitle: string;
  latitude: number;
  longitude: number;
  destinationId?: string;
  categories?: string[];
  address?: string | null;
}

export const searchApi = {
  search: async (q: string, type: 'all' | 'destination' | 'attraction' = 'all', limit = 10): Promise<SearchResult[]> => {
    const { data } = await apiClient.get<{ data: SearchResult[] }>('/search', {
      params: { q, type, limit },
    });
    return data.data;
  },
};
