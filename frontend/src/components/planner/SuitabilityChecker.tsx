/**
 * Feature 3: "Why NOT This Place?" Suitability Checker
 *
 * Search for an attraction, pick a time, and see a deterministic verdict
 * on whether it fits your schedule — with reasons and alternatives.
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { apiClient } from '../../api/client';
import {
  Search, Clock, CheckCircle2, XCircle, Loader2, ArrowRight, MapPin
} from 'lucide-react';
import { TrustBadge } from '../TrustBadge';

interface SuitabilityReason {
  check: string;
  passed: boolean;
  detail: string;
}

interface SuitabilityResult {
  attractionId: string;
  attractionName: string;
  requestedTime: string;
  recommended: boolean;
  reasons: SuitabilityReason[];
  alternatives: Array<{ id: string; name: string; categories: string[] }>;
}

export function SuitabilityChecker({ attractionId }: { attractionId?: string }) {
  const { t } = useTranslation();
  const [id, setId] = useState(attractionId || '');
  const [time, setTime] = useState('10:00');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SuitabilityResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const checkSuitability = async () => {
    if (!id.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await apiClient.get<{ data: SuitabilityResult }>(
        `/attractions/${id}/suitability`,
        { params: { time } }
      );
      setResult(res.data.data);
    } catch (err: any) {
      setError(err.message || 'Check failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
      <div>
        <h3 className="font-semibold text-slate-900 flex items-center gap-2">
          <Search size={18} />
          {t('suitability.title')}
        </h3>
        <p className="text-sm text-slate-500">{t('suitability.subtitle')}</p>
      </div>

      {/* Inputs */}
      <div className="flex gap-2">
        {!attractionId && (
          <input
            type="text"
            value={id}
            onChange={(e) => setId(e.target.value)}
            placeholder="Attraction ID"
            className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
          />
        )}
        <div className="relative">
          <Clock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="pl-8 pr-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
          />
        </div>
        <button
          onClick={checkSuitability}
          disabled={loading || !id.trim()}
          className="px-4 py-2 bg-orange-500 text-white rounded-lg font-medium text-sm hover:bg-orange-600 disabled:opacity-50 transition-colors"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : t('suitability.check')}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="p-3 bg-red-50 rounded-lg text-red-700 text-sm">{error}</div>
      )}

      {/* Result */}
      {result && (
        <div className="space-y-3">
          {/* Verdict */}
          <div className={`flex items-center gap-3 p-4 rounded-xl ${
            result.recommended ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
          }`}>
            {result.recommended
              ? <CheckCircle2 size={24} className="text-green-600" />
              : <XCircle size={24} className="text-red-600" />}
            <div>
              <div className={`font-bold ${result.recommended ? 'text-green-900' : 'text-red-900'}`}>
                {result.attractionName}
              </div>
              <div className={`text-sm ${result.recommended ? 'text-green-700' : 'text-red-700'}`}>
                {result.recommended ? t('suitability.recommended') : t('suitability.notRecommended')}
                {' '}at {result.requestedTime}
              </div>
            </div>
          </div>

          {/* Reasons */}
          <div>
            <h4 className="text-sm font-medium text-slate-700 mb-2">{t('suitability.reasons')}</h4>
            <div className="space-y-1.5">
              {result.reasons.map((reason, i) => (
                <div key={i} className="flex items-start gap-2 text-sm">
                  {reason.passed
                    ? <CheckCircle2 size={14} className="text-green-500 mt-0.5 shrink-0" />
                    : <XCircle size={14} className="text-red-500 mt-0.5 shrink-0" />}
                  <div>
                    <span className="font-medium text-slate-700">{reason.check.replace(/_/g, ' ')}</span>
                    <span className="text-slate-500"> — {reason.detail}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Alternatives */}
          {result.alternatives.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-slate-700 mb-2">{t('suitability.alternatives')}</h4>
              <div className="space-y-1.5">
                {result.alternatives.map((alt) => (
                  <div key={alt.id} className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg text-sm">
                    <MapPin size={14} className="text-orange-500" />
                    <span className="font-medium text-slate-800">{alt.name}</span>
                    <ArrowRight size={12} className="text-slate-300" />
                    <span className="text-xs text-slate-500">{alt.categories.join(', ')}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
