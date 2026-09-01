import { apiClient } from '../client';

export interface ExchangeRates {
  date?: string;
  inr: Record<string, number>;
}

export interface Holiday {
  date: string;
  localName: string;
  name: string;
}

export interface SafetyPulse {
  score?: number;
  level?: string;
  description?: string;
  incidents?: unknown[];
}

export const servicesApi = {
  getExchangeRates: async (): Promise<ExchangeRates> => {
    const { data } = await apiClient.get<{ data: ExchangeRates }>('/services/exchange-rates');
    return data.data;
  },

  getHolidays: async (countryCode = 'IN', year = new Date().getFullYear()): Promise<Holiday[]> => {
    const { data } = await apiClient.get<{ data: Holiday[] }>('/services/holidays', {
      params: { countryCode, year },
    });
    return data.data;
  },

  getCountryInfo: async (code = 'IN'): Promise<Record<string, any>> => {
    const { data } = await apiClient.get<{ data: Record<string, any> }>(`/services/country-info/${code}`);
    return data.data;
  },

  getSafetyPulse: async (): Promise<SafetyPulse> => {
    const { data } = await apiClient.get<{ data: SafetyPulse }>('/services/safety-pulse');
    return data.data;
  },
};
