import React from 'react';
import { MainLayout } from '../components/layout/MainLayout';

export const NearbyPage: React.FC = () => {
  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto text-center py-20">
        <div className="text-6xl mb-4">📍</div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Nearby Places</h1>
        <p className="text-gray-600 mb-8">Discover interesting spots around you.</p>
        <div className="bg-white rounded-2xl p-8 border border-gray-200 max-w-md mx-auto">
          <p className="text-gray-600">This feature is coming soon!</p>
        </div>
      </div>
    </MainLayout>
  );
};
