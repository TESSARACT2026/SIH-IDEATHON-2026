import { apiClient } from '../client';

export interface UserPreferences {
  budgetBand?: 'BUDGET' | 'MODERATE' | 'PREMIUM';
  pace?: 'RELAXED' | 'MODERATE' | 'PACKED';
  groupType?: 'SOLO' | 'COUPLE' | 'FAMILY' | 'GROUP';
  interests?: string[];
  foodPreferences?: string[];
  transportPreference?: 'WALKING' | 'PUBLIC_TRANSIT' | 'CAB' | 'OWN_VEHICLE' | 'MIXED';
  accessibilityMobility?: boolean;
  accessibilityVision?: boolean;
  accessibilityHearing?: boolean;
  accessibilityCognitive?: boolean;
  accessibilityNotes?: string;
  walkingToleranceMinutes?: number;
  indoorOutdoorPreference?: 'indoor' | 'outdoor' | 'mixed';
  localBusinessPreference?: boolean;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  preferredLanguage: 'en' | 'hi' | 'or';
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  createdAt?: string;
  updatedAt?: string;
  preferences?: UserPreferences | null;
}

export const usersApi = {
  getMe: async (): Promise<UserProfile> => {
    const { data } = await apiClient.get<{ data: UserProfile }>('/users/me');
    return data.data;
  },

  updateMe: async (payload: Partial<Pick<UserProfile, 'name' | 'preferredLanguage' | 'emergencyContactName' | 'emergencyContactPhone'>>): Promise<UserProfile> => {
    const { data } = await apiClient.patch<{ data: UserProfile }>('/users/me', payload);
    return data.data;
  },

  getPreferences: async (): Promise<UserPreferences> => {
    const { data } = await apiClient.get<{ data: UserPreferences }>('/users/me/preferences');
    return data.data;
  },

  updatePreferences: async (payload: UserPreferences): Promise<UserPreferences> => {
    const { data } = await apiClient.put<{ data: UserPreferences }>('/users/me/preferences', payload);
    return data.data;
  },

  patchPreferences: async (payload: UserPreferences): Promise<UserPreferences> => {
    const { data } = await apiClient.patch<{ data: UserPreferences }>('/users/me/preferences', payload);
    return data.data;
  },
};
