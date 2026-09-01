import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Accessibility, Eye, Volume2 } from 'lucide-react';
import { MainLayout } from '../components/layout/MainLayout';
import { knowledgeApi } from '../api/services/knowledgeApi';

export const AccessibilityPage: React.FC = () => {
  const [destinationId, setDestinationId] = useState('');

  const { data: destinations = [] } = useQuery({
    queryKey: ['destinations'],
    queryFn: knowledgeApi.getDestinations,
  });

  useEffect(() => {
    if (!destinationId && destinations.length > 0) setDestinationId(destinations[0].id);
  }, [destinationId, destinations]);

  const { data: attractions = [], isLoading } = useQuery({
    queryKey: ['accessible-attractions', destinationId],
    queryFn: () => knowledgeApi.getAttractionsByDestination(destinationId, { accessibilityWheelchair: true }),
    enabled: !!destinationId,
  });
  const isDemoData = knowledgeApi.isUsingFallbackData();

  return (
    <MainLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Accessibility Features</h1>
            <p className="text-gray-600 dark:text-gray-400">Wheelchair, visual, and hearing support pulled from attraction records.</p>
          </div>
          <select
            value={destinationId}
            onChange={(event) => setDestinationId(event.target.value)}
            className="h-11 px-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
          >
            {destinations.map((destination) => (
              <option key={destination.id} value={destination.id}>
                {destination.name}, {destination.region || destination.country}
              </option>
            ))}
          </select>
        </div>

        {isDemoData && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-200">
            Demo fallback accessibility records are shown because the backend knowledge layer returned no live data.
          </div>
        )}

        {isLoading ? (
          <div className="text-gray-500 py-10">Loading accessible attractions...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {attractions.map((attraction) => (
              <div key={attraction.id} className="bg-white dark:bg-gray-900 rounded-2xl p-5 border border-gray-200 dark:border-gray-800">
                <h2 className="font-bold text-gray-900 dark:text-white">{attraction.name}</h2>
                {attraction.accessibilityNotes && <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">{attraction.accessibilityNotes}</p>}
                <div className="flex flex-wrap gap-2 mt-4 text-xs font-semibold">
                  {attraction.accessibilityWheelchair && <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 px-2 py-1 rounded-lg"><Accessibility size={14} /> Wheelchair</span>}
                  {attraction.accessibilityVisual && <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-1 rounded-lg"><Eye size={14} /> Visual</span>}
                  {attraction.accessibilityHearing && <span className="inline-flex items-center gap-1 bg-purple-50 text-purple-700 px-2 py-1 rounded-lg"><Volume2 size={14} /> Hearing</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </MainLayout>
  );
};
