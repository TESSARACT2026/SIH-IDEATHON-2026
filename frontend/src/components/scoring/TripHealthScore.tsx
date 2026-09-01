/**
 * Feature 2: Trip Health Score Widget
 *
 * Compact, expandable score widget showing 0-100 trip health
 * with color-coded sub-scores. All data comes from the deterministic
 * scoring endpoint — no client-side fabrication.
 */

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { apiClient } from '../../api/client';
import {
  Shield, ChevronDown, ChevronUp, Sun, Users, Lock, Database, Accessibility,
  AlertTriangle, Loader2
} from 'lucide-react';

interface SubScore {
  category: string;
  score: number;
  penalty: number;
  maxPenalty: number;
  factors: Array<{ description: string; source?: string; timestamp?: string }>;
}

interface TripHealthData {
  score: number;
  label: string;
  subScores: SubScore[];
  computedAt: string;
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  weather: <Sun size={16} />,
  crowd: <Users size={16} />,
  closures: <Lock size={16} />,
  data_quality: <Database size={16} />,
  accessibility: <Accessibility size={16} />,
};

const CATEGORY_KEYS: Record<string, string> = {
  weather: 'scoring.weather',
  crowd: 'scoring.crowd',
  closures: 'scoring.closures',
  data_quality: 'scoring.dataQuality',
  accessibility: 'scoring.accessibility',
};

function scoreColor(score: number): string {
  if (score >= 80) return '#22c55e'; // green
  if (score >= 60) return '#eab308'; // yellow
  if (score >= 40) return '#f97316'; // orange
  return '#ef4444'; // red
}

function scoreEmoji(score: number): string {
  if (score >= 80) return '🟢';
  if (score >= 60) return '🟡';
  if (score >= 40) return '🟠';
  return '🔴';
}

export function TripHealthScore({ tripId }: { tripId: string }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['trip-health', tripId],
    queryFn: async () => {
      const res = await apiClient.get<{ data: TripHealthData }>(`/scoring/trip-health/${tripId}`);
      return res.data.data;
    },
    enabled: !!tripId,
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-50 border border-slate-200">
        <Loader2 className="animate-spin text-slate-400" size={16} />
        <span className="text-sm text-slate-500">Computing trip health...</span>
      </div>
    );
  }

  if (error || !data) {
    return null; // Silent fail — don't break the trip page
  }

  const color = scoreColor(data.score);

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg"
            style={{ backgroundColor: color }}
          >
            {data.score}
          </div>
          <div className="text-left">
            <div className="font-semibold text-slate-900 flex items-center gap-2">
              <Shield size={16} />
              {t('scoring.tripHealth')}
            </div>
            <div className="text-sm text-slate-500">
              {scoreEmoji(data.score)} {data.label}
            </div>
          </div>
        </div>
        {expanded ? <ChevronUp size={20} className="text-slate-400" /> : <ChevronDown size={20} className="text-slate-400" />}
      </button>

      {/* Expanded breakdown */}
      {expanded && (
        <div className="border-t border-slate-100 p-4 space-y-3">
          {data.subScores.map((sub) => (
            <div key={sub.category} className="space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  {CATEGORY_ICONS[sub.category]}
                  {t(CATEGORY_KEYS[sub.category] || sub.category)}
                </div>
                <span className="text-sm font-mono" style={{ color: scoreColor(sub.score) }}>
                  {sub.score}/100
                </span>
              </div>
              {/* Progress bar */}
              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${sub.score}%`, backgroundColor: scoreColor(sub.score) }}
                />
              </div>
              {/* Factors */}
              {sub.factors.map((factor, i) => (
                <div key={i} className="text-xs text-slate-500 pl-6 flex items-start gap-1">
                  <span className="text-slate-300 mt-0.5">•</span>
                  <span>{factor.description}</span>
                  {factor.source && (
                    <span className="text-slate-300 ml-1">({factor.source})</span>
                  )}
                </div>
              ))}
            </div>
          ))}

          {data.score < 50 && (
            <div className="flex items-center gap-2 p-3 bg-amber-50 rounded-lg text-amber-700 text-sm">
              <AlertTriangle size={16} />
              {t('scoring.suggestReplan')}
            </div>
          )}

          <div className="text-xs text-slate-400 text-right">
            Computed at {new Date(data.computedAt).toLocaleTimeString()}
          </div>
        </div>
      )}
    </div>
  );
}
