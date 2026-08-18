import React from 'react';
import { MainLayout } from '../components/layout/MainLayout';

export const AccessibilityPage: React.FC = () => {
  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto text-center py-20">
        <div className="text-6xl mb-4">♿</div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Accessibility Features</h1>
        <p className="text-gray-600 mb-8">Accessible travel options for everyone.</p>
        <div className="bg-white rounded-2xl p-8 border border-gray-200 max-w-md mx-auto">
          <p className="text-gray-600">This feature is coming soon!</p>
        </div>
      </div>
    </MainLayout>
  );
};
