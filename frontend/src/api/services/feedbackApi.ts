import { apiClient } from '../client';
import { FeedbackPayload } from '../../types/domain';

export interface FeedbackReviewItem {
  id: string;
  entityType: 'ATTRACTION' | 'FACT' | 'CROWD_RECORD';
  entityId: string;
  feedbackType: 'INACCURATE' | 'OUTDATED' | 'OTHER';
  note?: string | null;
  status: 'PENDING' | 'REVIEWED' | 'ACCEPTED' | 'REJECTED';
  createdAt: string;
  user?: { id: string; email: string; name: string | null };
  fact: {
    id: string;
    factKey: string;
    verificationStatus: string;
    confidence: number;
    lastChecked: string;
  } | null;
}

export const feedbackApi = {
  submitFeedback: async (payload: FeedbackPayload): Promise<{ success: boolean; message: string }> => {
    const response = await apiClient.post<{ data: { success: boolean; message: string } }>('/feedback', payload);
    return response.data.data;
  },

  getReviewQueue: async (status: FeedbackReviewItem['status'] = 'PENDING', limit = 20): Promise<FeedbackReviewItem[]> => {
    const response = await apiClient.get<{ data: FeedbackReviewItem[] }>('/feedback/admin/review-queue', {
      params: { status, limit },
    });
    return response.data.data;
  },

  review: async (
    id: string,
    payload: { status: 'REVIEWED' | 'ACCEPTED' | 'REJECTED'; factVerificationStatus?: string; notes?: string },
  ): Promise<unknown> => {
    const response = await apiClient.patch<{ data: unknown }>(`/feedback/admin/${id}/review`, payload);
    return response.data.data;
  },

  reverifyFact: async (factId: string, verificationStatus: string, notes?: string): Promise<unknown> => {
    const response = await apiClient.post<{ data: unknown }>(`/feedback/admin/facts/${factId}/reverify`, {
      verificationStatus,
      notes,
    });
    return response.data.data;
  },
};
