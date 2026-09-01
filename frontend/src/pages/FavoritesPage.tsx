import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Heart, MapPin, Star, Trash2 } from 'lucide-react';
import { MainLayout } from '../components/layout/MainLayout';
import { favoritesApi } from '../api/services/favoritesApi';

export const FavoritesPage: React.FC = () => {
  const queryClient = useQueryClient();

  const { data: favorites = { destinations: [], attractions: [] }, isLoading } = useQuery({
    queryKey: ['favorites'],
    queryFn: favoritesApi.getFavorites,
  });

  const removeAttractionMutation = useMutation({
    mutationFn: favoritesApi.removeFavorite,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['favorites'] }),
  });

  const removeDestinationMutation = useMutation({
    mutationFn: favoritesApi.removeDestinationFavorite,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['favorites'] }),
  });

  return (
    <MainLayout>
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Favorites</h1>
          <p className="text-gray-600 dark:text-gray-400">Your saved destinations and attractions.</p>
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-gray-500">Loading favorites...</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <section>
              <div className="mb-5 border-b border-gray-200 pb-3 dark:border-gray-800">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Destinations</h2>
              </div>

              {favorites.destinations.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-gray-200 p-8 text-center text-gray-500 dark:border-gray-800">
                  <MapPin size={36} className="mx-auto mb-3 text-gray-300" />
                  No destination favorites yet.
                </div>
              ) : (
                <div className="space-y-4">
                  {favorites.destinations.map((favorite) => (
                    <div
                      key={favorite.id}
                      className="rounded-2xl border border-gray-200 bg-white p-5 transition-all hover:shadow-lg dark:border-gray-800 dark:bg-gray-900"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h3 className="font-bold text-lg text-gray-900 dark:text-white">{favorite.destination.name}</h3>
                          <p className="mt-1 flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
                            <MapPin size={15} />
                            {[favorite.destination.region, favorite.destination.country].filter(Boolean).join(', ')}
                          </p>
                          <p className="mt-3 text-xs text-gray-500">
                            Saved {new Date(favorite.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeDestinationMutation.mutate(favorite.destinationId)}
                          disabled={removeDestinationMutation.isPending}
                          className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                          title="Remove destination"
                        >
                          <Trash2 size={17} />
                        </button>
                      </div>

                      <Link
                        to={`/destination/${favorite.destinationId}`}
                        className="mt-4 inline-flex rounded-lg border border-orange-200 px-4 py-2 text-sm font-semibold text-orange-600 transition-colors hover:bg-orange-50"
                      >
                        View Destination
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section>
              <div className="mb-5 border-b border-gray-200 pb-3 dark:border-gray-800">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Attractions</h2>
              </div>

              {favorites.attractions.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-gray-200 p-8 text-center text-gray-500 dark:border-gray-800">
                  <Heart size={36} className="mx-auto mb-3 text-gray-300" />
                  No attraction favorites yet.
                </div>
              ) : (
                <div className="space-y-4">
                  {favorites.attractions.map((favorite) => (
                    <div
                      key={favorite.id}
                      className="rounded-2xl border border-gray-200 bg-white p-5 transition-all hover:shadow-lg dark:border-gray-800 dark:bg-gray-900"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h3 className="font-bold text-lg text-gray-900 dark:text-white">{favorite.attraction.name}</h3>
                          <p className="mt-1 flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
                            <MapPin size={15} />
                            {favorite.attraction.address || 'India'}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeAttractionMutation.mutate(favorite.attractionId)}
                          disabled={removeAttractionMutation.isPending}
                          className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                          title="Remove attraction"
                        >
                          <Trash2 size={17} />
                        </button>
                      </div>

                      <div className="mt-4 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-1 text-sm">
                          <Star size={15} className="fill-yellow-400 text-yellow-400" />
                          <span className="font-bold text-gray-900 dark:text-white">4.5</span>
                        </div>
                        {favorite.attraction.categories[0] && (
                          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-600">
                            {favorite.attraction.categories[0]}
                          </span>
                        )}
                      </div>

                      <div className="mt-4 flex items-center justify-between gap-3">
                        <p className="text-xs text-gray-500">
                          Saved {new Date(favorite.createdAt).toLocaleDateString()}
                        </p>
                        <Link
                          to="/attractions"
                          className="rounded-lg border border-orange-200 px-4 py-2 text-sm font-semibold text-orange-600 transition-colors hover:bg-orange-50"
                        >
                          View Details
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </MainLayout>
  );
};
