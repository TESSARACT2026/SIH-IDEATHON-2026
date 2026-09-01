import React from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Heart, MapPin, Search, Star } from 'lucide-react';
import { MainLayout } from '../components/layout/MainLayout';
import { knowledgeApi } from '../api/services/knowledgeApi';
import { favoritesApi } from '../api/services/favoritesApi';
import { useAuth } from '../lib/AuthContext';
import { useSavedFavorites } from '../hooks/useSavedFavorites';
import { getDestinationVisual } from '../components/dashboard/PopularDestinations';

export const DestinationsPage: React.FC = () => {
  const [query, setQuery] = React.useState('');
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { destinationIds } = useSavedFavorites();
  const { data: destinations = [], isLoading } = useQuery({
    queryKey: ['destinations'],
    queryFn: knowledgeApi.getDestinations,
  });
  const favoriteMutation = useMutation({
    mutationFn: favoritesApi.addDestinationFavorite,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['favorites'] }),
    onError: (error) => alert((error as { message?: string }).message || 'Could not save destination'),
  });

  const filtered = destinations.filter((destination) => {
    const text = `${destination.name} ${destination.region || ''} ${destination.country}`.toLowerCase();
    return text.includes(query.toLowerCase());
  });

  return (
    <MainLayout>
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">All Destinations</h1>
            <p className="mt-2 max-w-2xl text-gray-600 dark:text-gray-400">
              Browse every destination available in the backend knowledge layer.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-lg bg-orange-50 px-4 py-2 font-semibold text-orange-600 dark:bg-orange-900/30 dark:text-orange-400">
            <Star size={18} className="fill-orange-500" />
            <span>{destinations.length} Destinations</span>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search destinations..."
            className="w-full rounded-xl border border-gray-200 bg-white py-3 pl-12 pr-4 text-gray-900 transition-all focus:outline-none focus:ring-2 focus:ring-orange-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          />
        </div>

        {isLoading ? (
          <div className="py-10 text-gray-500">Loading destinations...</div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((destination, index) => {
              const visual = getDestinationVisual(destination.name, index);
              const isSaved = destinationIds.has(destination.id) || (favoriteMutation.isPending && favoriteMutation.variables === destination.id);

              return (
                <div
                  key={destination.id}
                  className="group relative overflow-hidden rounded-2xl border border-gray-200 bg-white transition-all hover:-translate-y-1 hover:shadow-lg dark:border-gray-800 dark:bg-gray-900"
                >
                  <Link to={`/destination/${destination.id}`} className="relative block h-44 overflow-hidden">
                    <img
                      src={visual.image}
                      alt={destination.name}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      onError={(event) => {
                        event.currentTarget.style.display = 'none';
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                  </Link>
                  {user && (
                    <button
                      type="button"
                      onClick={() => favoriteMutation.mutate(destination.id)}
                      disabled={favoriteMutation.isPending || isSaved}
                      className={`absolute right-4 top-4 rounded-full bg-white/90 p-2 shadow-sm transition-colors hover:bg-white disabled:opacity-80 ${isSaved ? 'text-rose-500' : 'text-orange-600'}`}
                      title={isSaved ? 'Saved destination' : 'Save destination'}
                    >
                      <Heart size={17} className={isSaved ? 'fill-current' : ''} />
                    </button>
                  )}
                  <div className="p-5">
                    <Link to={`/destination/${destination.id}`} className="text-lg font-bold text-gray-900 hover:text-orange-600 dark:text-white">
                      {destination.name}
                    </Link>
                    <p className="mt-1 flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
                      <MapPin size={14} />
                      {[destination.region, destination.country].filter(Boolean).join(', ')}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </MainLayout>
  );
};
