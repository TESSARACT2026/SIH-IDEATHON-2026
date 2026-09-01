import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { favoritesApi } from '../api/services/favoritesApi';
import { useAuth } from '../lib/AuthContext';

export function useSavedFavorites() {
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: ['favorites'],
    queryFn: favoritesApi.getFavorites,
    enabled: !!user,
  });

  return useMemo(() => ({
    destinationIds: new Set(data?.destinations.map((item) => item.destinationId) || []),
    attractionIds: new Set(data?.attractions.map((item) => item.attractionId) || []),
  }), [data]);
}
