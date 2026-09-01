import { apiClient } from '../client';

interface FavoriteAttraction {
  id: string;
  name: string;
  categories: string[];
  latitude: number;
  longitude: number;
  address: string | null;
  description: string | null;
  indoorOutdoor: string;
  accessibilityWheelchair: boolean;
  accessibilityVisual: boolean;
  accessibilityHearing: boolean;
  accessibilityNotes: string | null;
  destinationId: string;
}

interface FavoriteDestination {
  id: string;
  name: string;
  country: string;
  region: string | null;
  latitude: number;
  longitude: number;
  timezone: string;
}

export interface FavoriteAttractionItem {
  id: string;
  attractionId: string;
  createdAt: string;
  attraction: FavoriteAttraction;
}

export interface FavoriteDestinationItem {
  id: string;
  destinationId: string;
  createdAt: string;
  destination: FavoriteDestination;
}

export interface FavoritesResponse {
  destinations: FavoriteDestinationItem[];
  attractions: FavoriteAttractionItem[];
}

export type FavoriteItem = FavoriteAttractionItem;

export const favoritesApi = {
  getFavorites: async (): Promise<FavoritesResponse> => {
    const { data } = await apiClient.get<{ data: FavoritesResponse | FavoriteAttractionItem[] }>('/favorites');
    return Array.isArray(data.data)
      ? { destinations: [], attractions: data.data }
      : data.data;
  },

  addFavorite: async (attractionId: string): Promise<FavoriteAttractionItem> => {
    const { data } = await apiClient.post<{ data: FavoriteAttractionItem }>('/favorites', {
      attractionId,
    });
    return data.data;
  },

  addDestinationFavorite: async (destinationId: string): Promise<FavoriteDestinationItem> => {
    const { data } = await apiClient.post<{ data: FavoriteDestinationItem }>('/favorites', {
      destinationId,
    });
    return data.data;
  },

  removeFavorite: async (attractionId: string): Promise<boolean> => {
    const { data } = await apiClient.delete<{ data: { success: boolean } }>(
      `/favorites/${attractionId}`
    );
    return data.data.success;
  },

  removeDestinationFavorite: async (destinationId: string): Promise<boolean> => {
    const { data } = await apiClient.delete<{ data: { success: boolean } }>(
      `/favorites/destinations/${destinationId}`
    );
    return data.data.success;
  },
};
