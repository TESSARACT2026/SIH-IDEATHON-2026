import { apiClient } from '../client';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Trip {
  id: string;
  title: string;
  destinationId: string;
  destination: {
    id: string;
    name: string;
    region: string | null;
    country: string;
    latitude?: number;
    longitude?: number;
  };
  startDate: string;
  endDate: string;
  status: 'DRAFT' | 'PLANNED' | 'ACTIVE' | 'COMPLETED';
  isPublic: boolean;
  shareToken: string | null;
  hasSnapshot: boolean;
  hasItinerary: boolean;
  itinerarySnapshot?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTripPayload {
  destinationId: string;
  title?: string;
  startDate: string;
  endDate: string;
  status?: Trip['status'];
}

export interface UpdateTripPayload {
  title?: string;
  startDate?: string;
  endDate?: string;
  status?: Trip['status'];
  isPublic?: boolean;
}

// ─── API Calls ───────────────────────────────────────────────────────────────

export const tripsApi = {
  /** List current user's trips */
  list: async (): Promise<Trip[]> => {
    const res = await apiClient.get('/trips');
    return res.data.data;
  },

  /** Get a single trip by ID */
  get: async (id: string): Promise<Trip> => {
    const res = await apiClient.get(`/trips/${id}`);
    return res.data.data;
  },

  /** Create a new trip */
  create: async (payload: CreateTripPayload): Promise<Trip> => {
    const res = await apiClient.post('/trips', payload);
    return res.data.data;
  },

  /** Update trip metadata */
  update: async (id: string, payload: UpdateTripPayload): Promise<Trip> => {
    const res = await apiClient.patch(`/trips/${id}`, payload);
    return res.data.data;
  },

  /** Save an itinerary snapshot to a trip */
  saveSnapshot: async (
    id: string,
    itinerarySnapshot: Record<string, unknown>,
  ): Promise<{ hasSnapshot: boolean; updatedAt: string; message: string }> => {
    const res = await apiClient.post(
      `/trips/${id}/snapshot`,
      { itinerarySnapshot },
    );
    return res.data.data;
  },

  /** Toggle public sharing. Returns shareToken and shareUrl if made public. */
  setPublic: async (id: string, isPublic: boolean) => {
    const res = await apiClient.patch(
      `/trips/${id}`,
      { isPublic },
    );
    return res.data.data as { isPublic: boolean; shareToken: string | null; shareUrl: string | null };
  },

  /** Delete a trip */
  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/trips/${id}`);
  },

  /** Download authenticated trip PDF export */
  exportPdf: async (id: string): Promise<Blob> => {
    const res = await apiClient.get(`/trips/${id}/export`, { responseType: 'blob' });
    return res.data;
  },

  /** Fetch a publicly shared trip by share token — NO auth required */
  getPublic: async (shareToken: string): Promise<Trip> => {
    const res = await apiClient.get(`/trips/share/${shareToken}`);
    return res.data.data;
  },

  /** Public PDF URL for shared trip */
  exportPublicPdf: (shareToken: string): string => {
    const baseUrl = apiClient.defaults.baseURL ?? '/api/v1';
    return `${baseUrl}/trips/share/${shareToken}/export`;
  },
};
