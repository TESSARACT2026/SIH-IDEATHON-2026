import { apiClient } from '../client';

export interface AnalyticsDashboard {
  totalTrips: number;
  totalUsers: number;
  uniqueDestinations: number;
  factAccuracy: number;
  totalFacts: number;
}

export const analyticsApi = {
  getDashboard: async (): Promise<AnalyticsDashboard> => {
    const { data } = await apiClient.get<{ data: AnalyticsDashboard }>('/analytics/dashboard');
    return data.data;
  },
};
