/**
 * Feature 4: Tourism Impact Score — Side-by-side comparison card
 *
 * Shows Popular vs Responsible route with real computed deltas.
 * Metrics that can't be computed show "not available".
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { apiClient } from '../../api/client';
import {
  TreePine, Users, Store, Loader2, ArrowRight, ChevronDown, ChevronUp
} from 'lucide-react';

interface ImpactMetrics {
  popularRoute: {
    itemCount: number;
    avgCrowdLevel: string;
    highCrowdStops: number;
  };
  responsibleRoute: {
    itemCount: number;
    avgCrowdLevel: string;
    highCrowdStops: number;
    localBusinessStops: number;
  };
  comparison: {
    crowdPressureDelta: string;
    localBusinessDelta: number;
    message: string;
  };
}

interface ImpactResult {
  metrics: ImpactMetrics;
  computedAt: string;
}

export function TourismImpactScore({
  destinationId,
  startDate,
  days,
  preferences,
}: {
  destinationId: string;
  startDate: string;
  days: number;
  preferences: Record<string, unknown>;
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImpactResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const computeImpact = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.post<{ data: ImpactResult }>('/scoring/tourism-impact', {
        destinationId,
        startDate,
        days,
        preferences,
      });
      setResult(res.data.data);
      setExpanded(true);
    } catch (err: any) {
      setError(err.message || 'Impact computation failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
      <button
        onClick={result ? () => setExpanded(!expanded) : computeImpact}
        disabled={loading}
        className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white">
            <TreePine size={20} />
          </div>
          <div className="text-left">
            <div className="font-semibold text-slate-900">{t('scoring.tourismImpact')}</div>
            <div className="text-sm text-slate-500">{t('scoring.tourismImpactDesc')}</div>
          </div>
        </div>
        {loading ? (
          <Loader2 size={20} className="animate-spin text-slate-400" />
        ) : expanded ? (
          <ChevronUp size={20} className="text-slate-400" />
        ) : (
          <ChevronDown size={20} className="text-slate-400" />
        )}
      </button>

      {error && (
        <div className="px-4 pb-3">
          <div className="p-3 bg-red-50 rounded-lg text-red-700 text-sm">{error}</div>
        </div>
      )}

      {expanded && result && (
        <div className="border-t border-slate-100 p-4 space-y-4">
          {/* Side-by-side comparison */}
          <div className="grid grid-cols-2 gap-3">
            {/* Popular Route */}
            <div className="p-4 bg-orange-50 rounded-xl border border-orange-100">
              <div className="font-semibold text-orange-900 text-sm mb-3">{t('scoring.popularRoute')}</div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600">Stops</span>
                  <span className="font-medium">{result.metrics.popularRoute.itemCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600 flex items-center gap-1"><Users size={12} /> Crowd</span>
                  <span className="font-medium">{result.metrics.popularRoute.avgCrowdLevel}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">{t('scoring.highCrowdStops')}</span>
                  <span className="font-medium text-orange-600">{result.metrics.popularRoute.highCrowdStops}</span>
                </div>
              </div>
            </div>

            {/* Responsible Route */}
            <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
              <div className="font-semibold text-emerald-900 text-sm mb-3">{t('scoring.responsibleRoute')}</div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600">Stops</span>
                  <span className="font-medium">{result.metrics.responsibleRoute.itemCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600 flex items-center gap-1"><Users size={12} /> Crowd</span>
                  <span className="font-medium">{result.metrics.responsibleRoute.avgCrowdLevel}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600 flex items-center gap-1"><Store size={12} /> Local</span>
                  <span className="font-medium text-emerald-600">{result.metrics.responsibleRoute.localBusinessStops}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Comparison summary */}
          <div className="p-3 bg-slate-50 rounded-xl space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <ArrowRight size={14} className="text-emerald-600" />
              <span className="text-slate-700">{result.metrics.comparison.crowdPressureDelta}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Store size={14} className="text-emerald-600" />
              <span className="text-slate-700">{result.metrics.comparison.message}</span>
            </div>
          </div>

          <div className="text-xs text-slate-400 text-right">
            Computed at {new Date(result.computedAt).toLocaleTimeString()}
          </div>
        </div>
      )}
    </div>
  );
}
