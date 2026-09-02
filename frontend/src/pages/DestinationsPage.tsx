import React from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Accessibility, Calendar, Clock, Heart, MapPin, Search, Star, Wallet } from 'lucide-react';
import { MainLayout } from '../components/layout/MainLayout';
import { knowledgeApi } from '../api/services/knowledgeApi';
import { favoritesApi } from '../api/services/favoritesApi';
import { useAuth } from '../lib/AuthContext';
import { useSavedFavorites } from '../hooks/useSavedFavorites';
import { getDestinationVisual } from '../components/dashboard/PopularDestinations';
import type { BudgetBand, DestinationRating } from '../types/domain';

const INTEREST_OPTIONS = [
  'Heritage & Architecture',
  'Temples & Spiritual',
  'Nature & Parks',
  'Local Food & Markets',
  'Museums & Culture',
  'Handicrafts & Art',
];

const ratingTone = (rating?: DestinationRating) => {
  if (!rating) return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300';
  if (rating.score >= 85) return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300';
  if (rating.score >= 70) return 'bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300';
  if (rating.score >= 55) return 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
  return 'bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300';
};

export const DestinationsPage: React.FC = () => {
  const [query, setQuery] = React.useState('');
  const [fitInput, setFitInput] = React.useState({
    startDate: new Date().toISOString().split('T')[0],
    preferredTime: '09:00',
    days: 3,
    budgetBand: 'MODERATE' as BudgetBand,
    accessibilityWheelchair: false,
    interest: '',
  });
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

  const { data: destinationRatings = [] } = useQuery({
    queryKey: ['destination-ratings', destinations.map((destination) => destination.id).join(','), fitInput],
    queryFn: () => knowledgeApi.getDestinationRatings({
      destinationIds: destinations.map((destination) => destination.id),
      startDate: fitInput.startDate,
      preferredTime: fitInput.preferredTime,
      days: fitInput.days,
      budgetBand: fitInput.budgetBand,
      accessibilityWheelchair: fitInput.accessibilityWheelchair,
      interests: fitInput.interest ? [fitInput.interest] : [],
    }),
    enabled: destinations.length > 0,
  });

  const ratingsById = React.useMemo(
    () => Object.fromEntries(destinationRatings.map((rating) => [rating.destinationId, rating])),
    [destinationRatings],
  );

  const filtered = destinations.filter((destination) => {
    const text = `${destination.name} ${destination.region || ''} ${destination.country}`.toLowerCase();
    return text.includes(query.toLowerCase());
  }).sort((a, b) => (ratingsById[b.id]?.score ?? -1) - (ratingsById[a.id]?.score ?? -1));

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

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-white">Destination Fit Rating</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">Scores update from your travel constraints.</p>
            </div>
            <span className="rounded-lg bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
              Sorted by fit
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
            <label className="space-y-1 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              <span className="flex items-center gap-1.5"><Calendar size={14} /> Date</span>
              <input
                type="date"
                value={fitInput.startDate}
                onChange={(event) => setFitInput((prev) => ({ ...prev, startDate: event.target.value }))}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm font-semibold normal-case tracking-normal text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
            </label>

            <label className="space-y-1 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              <span className="flex items-center gap-1.5"><Clock size={14} /> Time</span>
              <input
                type="time"
                value={fitInput.preferredTime}
                onChange={(event) => setFitInput((prev) => ({ ...prev, preferredTime: event.target.value || '09:00' }))}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm font-semibold normal-case tracking-normal text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
            </label>

            <label className="space-y-1 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              <span>Days</span>
              <select
                value={fitInput.days}
                onChange={(event) => setFitInput((prev) => ({ ...prev, days: Number(event.target.value) }))}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm font-semibold normal-case tracking-normal text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              >
                {[1, 2, 3, 5, 7, 10, 14].map((days) => <option key={days} value={days}>{days} days</option>)}
              </select>
            </label>

            <label className="space-y-1 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              <span className="flex items-center gap-1.5"><Wallet size={14} /> Budget</span>
              <select
                value={fitInput.budgetBand}
                onChange={(event) => setFitInput((prev) => ({ ...prev, budgetBand: event.target.value as BudgetBand }))}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm font-semibold normal-case tracking-normal text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              >
                <option value="BUDGET">Budget</option>
                <option value="MODERATE">Moderate</option>
                <option value="PREMIUM">Premium</option>
              </select>
            </label>

            <label className="space-y-1 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              <span>Interest</span>
              <select
                value={fitInput.interest}
                onChange={(event) => setFitInput((prev) => ({ ...prev, interest: event.target.value }))}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm font-semibold normal-case tracking-normal text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              >
                <option value="">Any interest</option>
                {INTEREST_OPTIONS.map((interest) => <option key={interest} value={interest}>{interest}</option>)}
              </select>
            </label>

            <label className="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm font-bold text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200">
              <input
                type="checkbox"
                checked={fitInput.accessibilityWheelchair}
                onChange={(event) => setFitInput((prev) => ({ ...prev, accessibilityWheelchair: event.target.checked }))}
                className="h-4 w-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
              />
              <span className="flex items-center gap-1.5"><Accessibility size={15} /> Wheelchair</span>
            </label>
          </div>
        </div>

        {isLoading ? (
          <div className="py-10 text-gray-500">Loading destinations...</div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((destination, index) => {
              const visual = getDestinationVisual(destination.name, index);
              const isSaved = destinationIds.has(destination.id) || (favoriteMutation.isPending && favoriteMutation.variables === destination.id);
              const rating = ratingsById[destination.id];

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
                  {rating && (
                    <div className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-xs font-black text-emerald-700 shadow-sm">
                      <Star size={14} className="fill-emerald-600 text-emerald-600" />
                      {rating.score} Fit
                    </div>
                  )}
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
                    {rating && (
                      <div className={`mt-4 rounded-xl px-3 py-2 text-sm ${ratingTone(rating)}`}>
                        <p className="font-bold">{rating.label}</p>
                        <p className="mt-0.5 text-xs opacity-90">{rating.summary}</p>
                      </div>
                    )}
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
