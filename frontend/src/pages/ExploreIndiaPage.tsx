import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, Star, MapPin, Tag, Accessibility } from 'lucide-react';
import { MainLayout } from '../components/layout/MainLayout';
import { knowledgeApi } from '../api/services/knowledgeApi';
import { searchApi } from '../api/services/searchApi';
import type { Attraction } from '../types/domain';

export const ExploreIndia: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDestinationId, setSelectedDestinationId] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [wheelchairOnly, setWheelchairOnly] = useState(false);

  const { data: destinations = [] } = useQuery({
    queryKey: ['destinations'],
    queryFn: knowledgeApi.getDestinations,
  });

  useEffect(() => {
    setSearchQuery(searchParams.get('q') || '');
  }, [searchParams]);

  const { data: attractions = [], isLoading } = useQuery({
    queryKey: ['explore-attractions', selectedDestinationId, selectedCategory, wheelchairOnly, searchQuery, destinations.map((item) => item.id).join(',')],
    queryFn: async () => {
      const filters = {
        categories: selectedCategory || undefined,
        accessibilityWheelchair: wheelchairOnly || undefined,
        search: searchQuery || undefined,
      };
      if (selectedDestinationId) return knowledgeApi.getAttractionsByDestination(selectedDestinationId, filters);

      const groups = await Promise.all(
        destinations.map((destination) => knowledgeApi.getAttractionsByDestination(destination.id, filters))
      );
      return groups.flat();
    },
    enabled: destinations.length > 0 && searchQuery.trim().length < 2,
  });

  const { data: searchResults = [] } = useQuery({
    queryKey: ['global-search', searchQuery],
    queryFn: () => searchApi.search(searchQuery, 'all', 18),
    enabled: searchQuery.trim().length >= 2,
  });

  const categories = useMemo(() => {
    const set = new Set<string>();
    attractions.forEach((attraction) => attraction.categories.forEach((category) => set.add(category)));
    return Array.from(set).sort();
  }, [attractions]);

  const resultAttractions: Attraction[] = searchQuery.trim().length >= 2
    ? searchResults
        .filter((result) => result.type === 'attraction')
        .map((result) => ({
          id: result.id,
          destinationId: result.destinationId || '',
          name: result.title,
          categories: result.categories || [],
          latitude: result.latitude,
          longitude: result.longitude,
          address: result.address,
          description: result.subtitle,
          indoorOutdoor: 'mixed',
          accessibilityWheelchair: false,
          accessibilityVisual: false,
          accessibilityHearing: false,
        }))
    : attractions;
  const isDemoData = knowledgeApi.isUsingFallbackData();

  return (
    <MainLayout>
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Explore Incredible India</h1>
            <p className="text-gray-600 dark:text-gray-400 max-w-2xl">
              Discover destinations, attractions, and accessibility signals from the backend knowledge layer.
            </p>
          </div>
          <div className="bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 px-4 py-2 rounded-lg font-semibold flex items-center gap-2">
            <Star size={18} className="fill-orange-500" />
            <span>{destinations.length} Destinations</span>
          </div>
        </div>

        {isDemoData && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-200">
            Demo fallback data is shown because the backend returned no live knowledge records.
          </div>
        )}

        <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative md:col-span-2">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Search destinations or attractions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all text-gray-900 dark:text-white"
              />
            </div>
            <select
              value={selectedDestinationId}
              onChange={(e) => setSelectedDestinationId(e.target.value)}
              className="px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white"
            >
              <option value="">Select destination (showing all)</option>
              {destinations.map((destination) => (
                <option key={destination.id} value={destination.id}>
                  {destination.name}, {destination.region || destination.country}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-3 overflow-x-auto pb-1">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`whitespace-nowrap px-4 py-2 rounded-lg font-semibold transition-colors ${selectedCategory === null ? 'bg-orange-500 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'}`}
            >
              All Types
            </button>
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`whitespace-nowrap px-4 py-2 rounded-lg font-semibold transition-colors ${selectedCategory === category ? 'bg-orange-500 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'}`}
              >
                {category}
              </button>
            ))}
          </div>

          <label className="flex items-center gap-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              checked={wheelchairOnly}
              onChange={(e) => setWheelchairOnly(e.target.checked)}
              className="w-5 h-5 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
            />
            Wheelchair Accessible Only
          </label>
        </div>

        {isLoading ? (
          <div className="text-gray-500 py-10">Loading attractions...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {resultAttractions.map((attraction) => (
              <Link
                to={`/destination/${attraction.destinationId || selectedDestinationId}`}
                key={attraction.id}
                className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 hover:shadow-xl transition-all p-5 flex flex-col gap-4"
              >
                <div>
                  <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-1">{attraction.name}</h3>
	                  <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 text-sm">
	                    <MapPin size={14} />
	                    {attraction.address || attraction.description || 'Attraction record'}
	                  </div>
                </div>

                <div className="flex flex-wrap gap-2 mt-auto">
                  {attraction.categories.slice(0, 3).map((category) => (
                    <span key={category} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-orange-50 text-orange-700 text-xs font-semibold">
                      <Tag size={12} />
                      {category}
                    </span>
                  ))}
                  {attraction.accessibilityWheelchair && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-semibold">
                      <Accessibility size={12} />
                      Wheelchair
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </MainLayout>
  );
};
