import React, { useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, MapPin, IndianRupee, Clock, Calendar, Info, ShieldCheck, Store, Heart, Star } from 'lucide-react';
import { MainLayout } from '../components/layout/MainLayout';
import { knowledgeApi } from '../api/services/knowledgeApi';
import { guideApi } from '../api/services/guideApi';
import { budgetApi } from '../api/services/budgetApi';
import { emergencyApi } from '../api/services/emergencyApi';
import { localBusinessesApi } from '../api/services/localBusinessesApi';
import { favoritesApi } from '../api/services/favoritesApi';
import { useAuth } from '../lib/AuthContext';
import { useSavedFavorites } from '../hooks/useSavedFavorites';
import { getDestinationVisual } from '../components/dashboard/PopularDestinations';

export const DestinationPage: React.FC = () => {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { destinationIds, attractionIds } = useSavedFavorites();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [id]);

  const { data: destination, isLoading } = useQuery({
    queryKey: ['destination', id],
    queryFn: () => knowledgeApi.getDestination(id),
    enabled: !!id,
  });

  const { data: guide } = useQuery({
    queryKey: ['destination-guide', id],
    queryFn: () => guideApi.getDestinationGuide(id),
    enabled: !!id,
  });

  const { data: budget } = useQuery({
    queryKey: ['destination-budget', id],
    queryFn: () => budgetApi.getDestinationBudget(id, 'INDIAN', 1),
    enabled: !!id,
  });

  const { data: emergency } = useQuery({
    queryKey: ['destination-emergency', id],
    queryFn: () => emergencyApi.getContacts(id),
    enabled: !!id,
  });

  const { data: localBusinesses = [] } = useQuery({
    queryKey: ['destination-local-businesses', id],
    queryFn: () => localBusinessesApi.list({ destinationId: id, locallyOwned: true, limit: 6 }),
    enabled: !!id,
  });

  const { data: destinationRatings = [] } = useQuery({
    queryKey: ['destination-rating-detail', id],
    queryFn: () => knowledgeApi.getDestinationRatings({
      destinationIds: [id],
      startDate: new Date().toISOString(),
      preferredTime: '09:00',
      days: 3,
      budgetBand: 'MODERATE',
      transportPreference: 'MIXED',
    }),
    enabled: !!id,
  });

  const destinationFavoriteMutation = useMutation({
    mutationFn: favoritesApi.addDestinationFavorite,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['favorites'] }),
    onError: (error) => alert((error as { message?: string }).message || 'Could not save destination'),
  });

  const attractionFavoriteMutation = useMutation({
    mutationFn: favoritesApi.addFavorite,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['favorites'] }),
    onError: (error) => alert((error as { message?: string }).message || 'Could not save attraction'),
  });

  if (isLoading) {
    return (
      <MainLayout>
        <div className="max-w-5xl mx-auto py-20 text-gray-500">Loading destination...</div>
      </MainLayout>
    );
  }

  if (!destination) {
    return (
      <MainLayout>
        <div className="max-w-5xl mx-auto py-20 text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Destination not found</h1>
          <button onClick={() => navigate(-1)} className="mt-4 text-orange-600 font-semibold">Go back</button>
        </div>
      </MainLayout>
    );
  }

  const attractions = guide?.attractions || [];
  const budgetLabel = budget ? `${budget.currency} ${budget.totalAmount.toLocaleString()}` : 'Calculating';
  const locationLabel = [destination.region, destination.country].filter(Boolean).join(', ');
  const isDemoData = knowledgeApi.isUsingFallbackData();
  const visual = getDestinationVisual(destination.name, 0);
  const heroImage = visual.image;
  const destinationRating = destinationRatings[0];
  const isDestinationSaved = destinationIds.has(destination.id)
    || (destinationFavoriteMutation.isPending && destinationFavoriteMutation.variables === destination.id);

  return (
    <MainLayout>
      <div className="max-w-5xl mx-auto pb-12">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-gray-600 dark:text-gray-300 hover:text-orange-600 mb-6 transition-colors font-medium"
        >
          <ArrowLeft size={20} />
          Back to Explore
        </button>

        <div className="relative h-80 md:h-96 rounded-3xl overflow-hidden mb-8 shadow-lg">
          <img src={heroImage} alt={destination.name} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent flex flex-col justify-end p-8 md:p-12">
            <div className="flex items-center gap-2 text-white/90 mb-2">
              <MapPin size={18} />
              <span className="font-medium tracking-wide">{locationLabel}</span>
            </div>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <h1 className="text-4xl md:text-6xl font-black text-white">{destination.name}</h1>
              <div className="flex flex-wrap items-center gap-3">
                {destinationRating && (
                  <div className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-black text-emerald-700 shadow-sm">
                    <Star size={17} className="fill-emerald-600 text-emerald-600" />
                    {destinationRating.score}/100 Fit
                  </div>
                )}
                {user && (
                  <button
                    type="button"
                    onClick={() => destinationFavoriteMutation.mutate(destination.id)}
                    disabled={destinationFavoriteMutation.isPending || isDestinationSaved}
                    className={`inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-bold shadow-sm transition-colors hover:bg-orange-50 disabled:opacity-80 ${isDestinationSaved ? 'text-rose-500' : 'text-orange-600'}`}
                  >
                    <Heart size={17} className={isDestinationSaved ? 'fill-current' : ''} />
                    {isDestinationSaved ? 'Saved' : 'Save Destination'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {isDemoData && (
          <div className="mb-8 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-200">
            Demo fallback destination data is shown because the backend returned no live knowledge record.
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-2 space-y-8">
            <div className="bg-white dark:bg-gray-900 rounded-3xl p-8 border border-gray-100 dark:border-gray-800 shadow-sm">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <Info className="text-orange-500" />
                About {destination.name}
              </h2>
              <p className="text-gray-600 dark:text-gray-400 leading-relaxed text-lg">
                Explore {destination.name} with {attractions.length || destination._count?.attractions || 0} attraction records, local businesses, accessibility data, and trust signals from the backend.
              </p>
            </div>

            <div className="bg-white dark:bg-gray-900 rounded-3xl p-8 border border-gray-100 dark:border-gray-800 shadow-sm">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Top Attractions</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {attractions.slice(0, 6).map((attraction) => {
                  const isAttractionSaved = attractionIds.has(attraction.id)
                    || (attractionFavoriteMutation.isPending && attractionFavoriteMutation.variables === attraction.id);

                  return (
                    <div key={attraction.id} className="p-4 rounded-2xl bg-orange-50 dark:bg-orange-900/10 text-orange-700 dark:text-orange-400 font-medium">
                      <div className="flex items-start justify-between gap-3">
                        <Link to="/attractions" className="min-w-0 flex-1">
                          <p className="font-bold">{attraction.name}</p>
                          <p className="text-xs mt-1 text-orange-700/70 dark:text-orange-300/70">
                            {attraction.trustWarnings.length === 0 ? 'Trust essentials available' : `${attraction.trustWarnings.length} trust warning(s)`}
                          </p>
                        </Link>
                        {user && !attraction.id.includes('-suggested-') && (
                          <button
                            type="button"
                            onClick={() => attractionFavoriteMutation.mutate(attraction.id)}
                            disabled={attractionFavoriteMutation.isPending || isAttractionSaved}
                            className={`rounded-lg bg-white/80 p-2 transition-colors hover:bg-white disabled:opacity-80 dark:bg-gray-900/80 ${isAttractionSaved ? 'text-rose-500' : 'text-orange-600'}`}
                            title={isAttractionSaved ? 'Saved attraction' : 'Save attraction'}
                          >
                            <Heart size={16} className={isAttractionSaved ? 'fill-current' : ''} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {localBusinesses.length > 0 && (
              <div className="bg-white dark:bg-gray-900 rounded-3xl p-8 border border-gray-100 dark:border-gray-800 shadow-sm">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <Store className="text-emerald-500" />
                  Local Businesses
                </h2>
                <div className="space-y-3">
                  {localBusinesses.map((business) => (
                    <div key={business.id} className="flex items-start justify-between gap-3 rounded-2xl border border-gray-100 dark:border-gray-800 p-4">
                      <div>
                        <p className="font-bold text-gray-900 dark:text-white">{business.name}</p>
                        <p className="text-sm text-gray-500">{business.category}</p>
                      </div>
                      {business.isLocallyOwned && <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-1 rounded-lg font-bold">Local</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-6">
            {destinationRating && (
              <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6 text-emerald-900 shadow-sm dark:border-emerald-900/50 dark:bg-emerald-900/20 dark:text-emerald-100">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300">Destination Fit</p>
                    <h3 className="mt-1 text-2xl font-black">{destinationRating.score}/100</h3>
                    <p className="mt-1 font-bold">{destinationRating.label}</p>
                  </div>
                  <Star className="h-6 w-6 fill-emerald-600 text-emerald-600" />
                </div>
                <p className="mt-4 text-sm text-emerald-800 dark:text-emerald-200">{destinationRating.summary}</p>
                {destinationRating.topReasons.length > 0 && (
                  <ul className="mt-3 space-y-1 text-xs text-emerald-700 dark:text-emerald-300">
                    {destinationRating.topReasons.slice(0, 2).map((reason) => (
                      <li key={reason}>• {reason}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-3xl p-8 text-white shadow-lg">
              <h3 className="text-xl font-bold mb-6 opacity-90">Trip Estimation</h3>
              <div className="space-y-6">
                <div>
                  <p className="text-orange-100 text-sm font-medium mb-1">Estimated Visit Cost</p>
                  <div className="flex items-center gap-2 text-2xl font-black">
                    <IndianRupee size={24} />
                    {budgetLabel}
                  </div>
                  <p className="text-xs text-orange-200 mt-1">Approximate for listed attractions</p>
                </div>

                <div className="pt-4 border-t border-white/20">
                  <p className="text-orange-100 text-sm font-medium mb-1 flex items-center gap-2">
                    <Clock size={16} /> Timezone
                  </p>
                  <p className="text-lg font-bold">{destination.timezone}</p>
                </div>

                <div className="pt-4 border-t border-white/20">
                  <p className="text-orange-100 text-sm font-medium mb-1 flex items-center gap-2">
                    <Calendar size={16} /> Emergency Contacts
                  </p>
                  <p className="text-lg font-bold">{emergency?.contacts.length || 0} emergency number(s)</p>
                </div>
              </div>

              <button
                onClick={() => navigate('/planner', { state: { destinationId: destination.id } })}
                className="w-full mt-8 bg-white text-orange-600 font-bold py-3 rounded-xl hover:bg-orange-50 transition-colors shadow-sm"
              >
                Plan a Trip Here
              </button>
            </div>

            {guide && (
              <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 border border-gray-100 dark:border-gray-800 shadow-sm">
                <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <ShieldCheck size={18} className="text-emerald-500" />
                  Trust Coverage
                </h3>
                <p className="text-sm text-gray-500 mt-2">{guide.attractions.length} attractions with provenance, crowd, and sensitivity metadata.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  );
};
