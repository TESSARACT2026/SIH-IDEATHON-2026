import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Phone, ShieldAlert, MapPin, UserRound } from 'lucide-react';
import { MainLayout } from '../components/layout/MainLayout';
import { knowledgeApi } from '../api/services/knowledgeApi';
import { emergencyApi } from '../api/services/emergencyApi';
import { usersApi } from '../api/services/usersApi';
import { useAuth } from '../lib/AuthContext';

export const EmergencyPage: React.FC = () => {
  const { user } = useAuth();
  const [destinationId, setDestinationId] = useState('');

  const { data: destinations = [] } = useQuery({
    queryKey: ['destinations'],
    queryFn: knowledgeApi.getDestinations,
  });

  useEffect(() => {
    if (!destinationId && destinations.length > 0) setDestinationId(destinations[0].id);
  }, [destinationId, destinations]);

  const { data: emergency } = useQuery({
    queryKey: ['emergency', destinationId],
    queryFn: () => emergencyApi.getContacts(destinationId),
    enabled: !!destinationId,
  });

  const { data: profile } = useQuery({
    queryKey: ['me'],
    queryFn: usersApi.getMe,
    enabled: !!user,
  });

  return (
    <MainLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
              <ShieldAlert className="text-red-500" />
              Emergency Help
            </h1>
            <p className="text-gray-600 dark:text-gray-400">Verified national and regional contacts from the backend emergency module.</p>
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

        {profile?.emergencyContactPhone && (
          <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-2xl p-5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <UserRound className="text-red-600" />
              <div>
                <p className="font-bold text-gray-900 dark:text-white">{profile.emergencyContactName || 'Saved emergency contact'}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">{profile.emergencyContactPhone}</p>
              </div>
            </div>
            <a href={`tel:${profile.emergencyContactPhone}`} className="px-4 py-2 rounded-xl bg-red-600 text-white font-bold text-sm">Call</a>
          </div>
        )}

        {emergency?.destination && (
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <MapPin size={16} />
            Showing contacts for {emergency.destination.name}, {emergency.destination.region || emergency.destination.country}. Last verified {emergency.lastVerified}.
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(emergency?.contacts || []).map((contact) => (
            <div key={`${contact.category}-${contact.phone}`} className="bg-white dark:bg-gray-900 rounded-2xl p-5 border border-gray-200 dark:border-gray-800">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-wide text-red-500 font-bold">{contact.category}</p>
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white mt-1">{contact.label}</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">{contact.description}</p>
                  <p className="text-xs text-gray-400 mt-3">Source: {contact.sourceName}</p>
                </div>
                {contact.available24x7 && <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-1 rounded-lg font-bold">24x7</span>}
              </div>
              <a href={`tel:${contact.phone}`} className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 text-white font-bold text-sm">
                <Phone size={16} />
                {contact.phone}
              </a>
            </div>
          ))}
        </div>
      </div>
    </MainLayout>
  );
};
