import { apiClient } from '../client';

export interface BudgetResponse {
  currency: string;
  travellerType: 'INDIAN' | 'FOREIGN' | 'CHILD';
  travellers: number;
  totalAmount: number;
  includedCount: number;
  unverifiedCount: number;
  lineItems: Array<{
    attractionId: string;
    attractionName: string;
    amountPerTraveller: number | null;
    travellers: number;
    totalAmount: number | null;
    currency: string | null;
    verificationStatus: string;
    note: string | null;
  }>;
  warnings: string[];
}

export const budgetApi = {
  getDestinationBudget: async (id: string, travellerType: BudgetResponse['travellerType'] = 'INDIAN', travellers = 1): Promise<BudgetResponse & { destination: unknown }> => {
    const { data } = await apiClient.get<{ data: BudgetResponse & { destination: unknown } }>(`/budget/destinations/${id}`, {
      params: { travellerType, travellers },
    });
    return data.data;
  },

  estimate: async (attractionIds: string[], travellerType: BudgetResponse['travellerType'] = 'INDIAN', travellers = 1): Promise<BudgetResponse> => {
    const { data } = await apiClient.post<{ data: BudgetResponse }>('/budget/estimate', {
      attractionIds,
      travellerType,
      travellers,
    });
    return data.data;
  },
};
