import axios from 'axios';

// Mutable token store — updated by AuthContext, read by every request
export const tokenStore = { current: '' };

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

// Always attach the latest token — no stale closure issues
apiClient.interceptors.request.use((config) => {
  if (tokenStore.current) {
    config.headers.Authorization = `Bearer ${tokenStore.current}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const customError = {
      message: error.response?.data?.error?.message || error.message || 'An unexpected error occurred',
      code: error.response?.data?.error?.code || 'UNKNOWN_ERROR',
      status: error.response?.status,
    };
    return Promise.reject(customError);
  }
);
