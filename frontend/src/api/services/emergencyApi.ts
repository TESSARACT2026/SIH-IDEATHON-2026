import { apiClient } from '../client';

export interface EmergencyContact {
  category: string;
  label: string;
  phone: string;
  available24x7: boolean;
  description: string;
  sourceName: string;
  sourceUrl: string;
}

export interface EmergencyContactsResponse {
  countryCode: string;
  destination: { id: string; name: string; region: string | null; country: string } | null;
  contacts: EmergencyContact[];
  lastVerified: string;
}

export const emergencyApi = {
  getContacts: async (destinationId?: string, countryCode = 'IN'): Promise<EmergencyContactsResponse> => {
    const { data } = await apiClient.get<{ data: EmergencyContactsResponse }>('/emergency', {
      params: { countryCode, ...(destinationId ? { destinationId } : {}) },
    });
    return data.data;
  },
};
