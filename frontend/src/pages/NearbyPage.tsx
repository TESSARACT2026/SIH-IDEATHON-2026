import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MapPin, Navigation, Loader2 } from 'lucide-react';
import { MainLayout } from '../components/layout/MainLayout';
import { knowledgeApi } from '../api/services/knowledgeApi';
import { nearbyApi } from '../api/services/nearbyApi';

export const NearbyPage: React.FC = () => {
  const [selectedDestinationId, setSelectedDestinationId] = useState('');
  const [radiusKm, setRadiusKm] = useState(10);
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);

  const { data: destinations = [] } = useQuery({
    queryKey: ['destinations'],
    queryFn: knowledgeApi.getDestinations,
  });

  useEffect(() => {
    if (!selectedDestinationId && destinations.length > 0) {
      const first = destinations[0];
      setSelectedDestinationId(first.id);
      setCoords({ lat: first.latitude, lon: first.longitude });
    }
  }, [destinations, selectedDestinationId]);

  const selectedDestination = destinations.find((destination) => destination.id === selectedDestinationId);

  const { data: nearby = [], isLoading } = useQuery({
    queryKey: ['nearby', coords?.lat, coords?.lon, radiusKm, selectedDestinationId],
    queryFn: () => nearbyApi.findAttractions({
      lat: coords!.lat,
      lon: coords!.lon,
      radiusKm,
      limit: 20,
      destinationId: selectedDestinationId,
    }),
    enabled: !!coords && !!selectedDestinationId,
  });

  const useCurrentLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((position) => {
      setCoords({ lat: position.coords.latitude, lon: position.coords.longitude });
    });
  };

  const useDestinationCenter = (id: string) => {
    const destination = destinations.find((item) => item.id === id);
    setSelectedDestinationId(id);
    if (destination) setCoords({ lat: destination.latitude, lon: destination.longitude });
  };

  return (
    <MainLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Nearby Places</h1>
          <p className="text-gray-600 dark:text-gray-400">Discover backend-ranked attractions around your location or a destination center.</p>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 border border-gray-200 dark:border-gray-800 flex flex-col md:flex-row gap-4">
          <select
            value={selectedDestinationId}
            onChange={(event) => useDestinationCenter(event.target.value)}
            className="h-11 px-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white"
          >
            {destinations.map((destination) => (
              <option key={destination.id} value={destination.id}>
                {destination.name}, {destination.region || destination.country}
              </option>
            ))}
          </select>

          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
            Radius
            <input
              type="range"
              min={1}
              max={50}
              value={radiusKm}
              onChange={(event) => setRadiusKm(Number(event.target.value))}
            />
            <span className="font-bold">{radiusKm} km</span>
          </label>

          <button
            onClick={useCurrentLocation}
            className="inline-flex items-center justify-center gap-2 h-11 px-4 rounded-xl bg-orange-500 text-white font-semibold"
          >
            <Navigation size={16} />
            Use My Location
          </button>
        </div>

        {selectedDestination && (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Searching near {selectedDestination.name} at {coords?.lat.toFixed(4)}, {coords?.lon.toFixed(4)}
          </p>
        )}

        {isLoading ? (
          <div className="flex items-center gap-2 text-gray-500 py-10">
            <Loader2 className="animate-spin" size={18} />
            Loading nearby attractions...
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {nearby.map((attraction) => (
              <div key={attraction.id} className="bg-white dark:bg-gray-900 rounded-2xl p-5 border border-gray-200 dark:border-gray-800">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-bold text-gray-900 dark:text-white">{attraction.name}</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-1">
                      <MapPin size={14} />
                      {attraction.destination.name} · {attraction.distanceKm} km
                    </p>
                  </div>
                  <span className="text-xs font-bold text-orange-600 bg-orange-50 px-2 py-1 rounded-lg">{attraction.indoorOutdoor}</span>
                </div>
                {attraction.description && <p className="text-sm text-gray-600 dark:text-gray-400 mt-3 line-clamp-2">{attraction.description}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </MainLayout>
  );
};
