/**
 * Feature 10: Trip Trust Score Widget
 *
 * Displays the trust score as a percentage with expandable breakdown
 * showing fact verification status distribution and freshness.
 */

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { apiClient } from '../../api/client';
import { ShieldCheck, ChevronDown, ChevronUp, Loader2, AlertCircle } from 'lucide-react';

interface TrustBreakdown {
  verified: number;
  live: number;
  community: number;
  inferred: number;
  unverified: number;
  outdated: number;
  disputed: number;
  needs_review: number;
}

interface TripTrustData {
  score: number;
  label: string;
  breakdown: TrustBreakdown;
  totalFacts: number;
  unresolvedConflicts: number;
  avgFreshnessHours: number;
  freshnessFactor: number;
  computedAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  verified: '#22c55e',
  live: '#3b82f6',
  community: '#8b5cf6',
  inferred: '#f59e0b',
  unverified: '#94a3b8',
  outdated: '#6b7280',
  disputed: '#ef4444',
  needs_review: '#f97316',
};

export function TripTrustScore({ tripId }: { tripId: string }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['trip-trust', tripId],
    queryFn: async () => {
      const res = await apiClient.get<{ data: TripTrustData }>(`/scoring/trip-trust/${tripId}`);
      return res.data.data;
    },
    enabled: !!tripId,
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-50 border border-slate-200">
        <Loader2 className="animate-spin text-slate-400" size={16} />
        <span className="text-sm text-slate-500">Computing trust score...</span>
      </div>
    );
  }

  if (error || !data) return null;

  const trustColor = data.score >= 75 ? '#22c55e' : data.score >= 50 ? '#eab308' : '#ef4444';

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg"
            style={{ backgroundColor: trustColor }}
          >
            {data.score}%
          </div>
          <div className="text-left">
            <div className="font-semibold text-slate-900 flex items-center gap-2">
              <ShieldCheck size={16} />
              {t('scoring.tripTrust')}
            </div>
            <div className="text-sm text-slate-500">{data.label}</div>
          </div>
        </div>
        {expanded ? <ChevronUp size={20} className="text-slate-400" /> : <ChevronDown size={20} className="text-slate-400" />}
      </button>

      {expanded && (
        <div className="border-t border-slate-100 p-4 space-y-4">
          {/* Breakdown bar */}
          <div>
            <div className="text-sm font-medium text-slate-700 mb-2">
              {t('scoring.totalFacts')}: {data.totalFacts}
            </div>
            <div className="h-4 bg-slate-100 rounded-full overflow-hidden flex">
              {Object.entries(data.breakdown)
                .filter(([, count]) => count > 0)
                .map(([status, count]) => (
                  <div
                    key={status}
                    className="h-full transition-all"
                    style={{
                      width: `${(count / Math.max(1, data.totalFacts)) * 100}%`,
                      backgroundColor: STATUS_COLORS[status] || '#94a3b8',
                    }}
                    title={`${status}: ${count}`}
                  />
                ))}
            </div>
            {/* Legend */}
            <div className="flex flex-wrap gap-3 mt-2">
              {Object.entries(data.breakdown)
                .filter(([, count]) => count > 0)
                .map(([status, count]) => (
                  <div key={status} className="flex items-center gap-1 text-xs text-slate-600">
                    <div
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: STATUS_COLORS[status] }}
                    />
                    {status}: {count}
                  </div>
                ))}
            </div>
          </div>

          {/* Freshness & conflicts */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-slate-50 rounded-lg">
              <div className="text-xs text-slate-500">{t('scoring.freshness')}</div>
              <div className="text-sm font-medium text-slate-900">
                {data.avgFreshnessHours < 24
                  ? `${data.avgFreshnessHours}h ago`
                  : `${Math.round(data.avgFreshnessHours / 24)}d ago`}
              </div>
              <div className="text-xs text-slate-400">Factor: {data.freshnessFactor}</div>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg">
              <div className="text-xs text-slate-500">{t('scoring.conflicts')}</div>
              <div className="flex items-center gap-1">
                <span className="text-sm font-medium text-slate-900">{data.unresolvedConflicts}</span>
                {data.unresolvedConflicts > 0 && <AlertCircle size={14} className="text-amber-500" />}
              </div>
            </div>
          </div>

          <div className="text-xs text-slate-400 text-right">
            Computed at {new Date(data.computedAt).toLocaleTimeString()}
          </div>
        </div>
      )}
    </div>
  );
}
