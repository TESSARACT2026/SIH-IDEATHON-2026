/**
 * Feature 1: "What If?" Dynamic Itinerary Simulator
 *
 * Quick-action buttons + free-text input for exploring how the itinerary
 * changes under different constraints. Calls the deterministic replan
 * endpoint and shows a before/after diff.
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { apiClient } from '../../api/client';
import {
  CloudRain, Clock, Wallet, Users, Sparkles, Loader2,
  Plus, Minus, Send, ChevronDown, ChevronUp
} from 'lucide-react';

interface DiffItem {
  name: string;
  day?: number;
  time?: string;
  entityId?: string;
}

interface ReplanResult {
  oldItemCount: number;
  newPlan: {
    itineraryItems: Array<{
      dayNumber: number;
      attractionName: string;
      startTime: string;
      endTime: string;
    }>;
    warnings: string[];
  };
  diff: {
    added: DiffItem[];
    removed: DiffItem[];
    deltaApplied: { type: string };
  };
}

type DeltaType = 'weather_change' | 'time_reduced' | 'crowd_increase' | 'budget_change';

const QUICK_ACTIONS: Array<{
  key: DeltaType;
  icon: React.ReactNode;
  i18nKey: string;
  delta: object;
}> = [
  {
    key: 'weather_change',
    icon: <CloudRain size={18} />,
    i18nKey: 'whatif.rain',
    delta: { type: 'weather_change', payload: { condition: 'rain' } },
  },
  {
    key: 'time_reduced',
    icon: <Clock size={18} />,
    i18nKey: 'whatif.lessTime',
    delta: { type: 'time_reduced', payload: { newDayEnd: '15:00' } },
  },
  {
    key: 'budget_change',
    icon: <Wallet size={18} />,
    i18nKey: 'whatif.budgetCut',
    delta: { type: 'budget_change', payload: { maxBudgetPerPerson: 500 } },
  },
  {
    key: 'crowd_increase',
    icon: <Users size={18} />,
    i18nKey: 'whatif.crowding',
    delta: { type: 'crowd_increase', payload: { strictFilter: true } },
  },
];

export function WhatIfPanel({ tripId, onApply }: { tripId: string; onApply?: () => void }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [freeText, setFreeText] = useState('');
  const [result, setResult] = useState<ReplanResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runReplan = async (delta: object) => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await apiClient.post<{ data: ReplanResult }>(
        `/trips/${tripId}/itinerary/replan`,
        { delta }
      );
      setResult(res.data.data);
    } catch (err: any) {
      setError(err.message || 'Replan failed');
    } finally {
      setLoading(false);
    }
  };

  const handleFreeText = async () => {
    if (!freeText.trim()) return;
    setLoading(true);
    setError(null);
    try {
      // Step 1: Extract delta from free text via NLU
      const nluRes = await apiClient.post<{ data: { delta: object } }>('/nlu/extract-delta', {
        query: freeText,
      });
      // Step 2: Run replan with extracted delta
      await runReplan(nluRes.data.data.delta);
    } catch (err: any) {
      setError(err.message || 'Failed to process query');
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white">
            <Sparkles size={20} />
          </div>
          <div className="text-left">
            <div className="font-semibold text-slate-900">{t('whatif.title')}</div>
            <div className="text-sm text-slate-500">{t('whatif.subtitle')}</div>
          </div>
        </div>
        {expanded ? <ChevronUp size={20} className="text-slate-400" /> : <ChevronDown size={20} className="text-slate-400" />}
      </button>

      {expanded && (
        <div className="border-t border-slate-100 p-4 space-y-4">
          {/* Quick action buttons */}
          <div className="grid grid-cols-2 gap-2">
            {QUICK_ACTIONS.map((action) => (
              <button
                key={action.key}
                onClick={() => runReplan(action.delta)}
                disabled={loading}
                className="flex items-center gap-2 p-3 rounded-xl border border-slate-200 hover:border-violet-300 hover:bg-violet-50 transition-all text-sm font-medium text-slate-700 disabled:opacity-50"
              >
                {action.icon}
                {t(action.i18nKey)}
              </button>
            ))}
          </div>

          {/* Free text input */}
          <div className="flex gap-2">
            <input
              type="text"
              value={freeText}
              onChange={(e) => setFreeText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleFreeText()}
              placeholder={t('whatif.freeTextPlaceholder')}
              className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
              disabled={loading}
            />
            <button
              onClick={handleFreeText}
              disabled={loading || !freeText.trim()}
              className="px-4 py-2.5 bg-violet-600 text-white rounded-xl font-medium text-sm hover:bg-violet-700 disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              {t('whatif.simulate')}
            </button>
          </div>

          {/* Loading state */}
          {loading && (
            <div className="flex items-center gap-2 p-3 bg-violet-50 rounded-lg text-violet-700 text-sm">
              <Loader2 className="animate-spin" size={16} />
              {t('whatif.simulating')}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="p-3 bg-red-50 rounded-lg text-red-700 text-sm">{error}</div>
          )}

          {/* Result diff */}
          {result && (
            <div className="space-y-3">
              <h4 className="font-semibold text-slate-900 text-sm">{t('whatif.diffTitle')}</h4>

              {result.diff.added.length === 0 && result.diff.removed.length === 0 ? (
                <div className="p-3 bg-green-50 rounded-lg text-green-700 text-sm">
                  {t('whatif.noChanges')}
                </div>
              ) : (
                <>
                  {/* Added items */}
                  {result.diff.added.length > 0 && (
                    <div className="space-y-1">
                      <div className="text-xs font-medium text-green-600 uppercase tracking-wide">
                        {t('whatif.added')}
                      </div>
                      {result.diff.added.map((item, i) => (
                        <div key={i} className="flex items-center gap-2 p-2 bg-green-50 rounded-lg text-sm">
                          <Plus size={14} className="text-green-600" />
                          <span className="font-medium text-green-900">{item.name}</span>
                          {item.day && <span className="text-green-600">Day {item.day}</span>}
                          {item.time && <span className="text-green-500 text-xs">{item.time}</span>}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Removed items */}
                  {result.diff.removed.length > 0 && (
                    <div className="space-y-1">
                      <div className="text-xs font-medium text-red-600 uppercase tracking-wide">
                        {t('whatif.removed')}
                      </div>
                      {result.diff.removed.map((item, i) => (
                        <div key={i} className="flex items-center gap-2 p-2 bg-red-50 rounded-lg text-sm">
                          <Minus size={14} className="text-red-600" />
                          <span className="font-medium text-red-900">{item.name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              <div className="text-xs text-slate-400">
                {t('whatif.appliedDelta')}: {result.diff.deltaApplied.type.replace('_', ' ')}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
