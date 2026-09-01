/**
 * Feature 9: Transparent Budget Engine
 * 
 * Shows a line-item breakdown of the budget based on verified facts,
 * explicitly highlighting unverified or approximate costs. Includes a
 * "What if I reduce my budget?" simulation action.
 */

import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { apiClient } from '../../api/client';
import { Wallet, Loader2, AlertTriangle, ShieldCheck, CheckCircle2, Calculator, Info, ExternalLink } from 'lucide-react';
import { TrustBadge } from '../TrustBadge';

interface BudgetLineItem {
  attractionId: string;
  attractionName: string;
  amountPerTraveller: number;
  travellers: number;
  totalAmount: number;
  currency: string;
  verificationStatus: 'VERIFIED' | 'INFERRED' | 'OUTDATED' | 'DISPUTED' | 'UNVERIFIED';
  source: {
    id: string;
    name: string;
    url: string | null;
  } | null;
  note: string | null;
}

interface BudgetEstimate {
  currency: string;
  travellerType: string;
  travellers: number;
  totalAmount: number;
  includedCount: number;
  unverifiedCount: number;
  lineItems: BudgetLineItem[];
  warnings: string[];
}

export function TransparentBudget({ attractionIds }: { attractionIds: string[] }) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [estimate, setEstimate] = useState<BudgetEstimate | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Local state for "reduce by" action
  const [reduceAmount, setReduceAmount] = useState<string>('');
  
  useEffect(() => {
    if (!attractionIds.length) return;
    
    let isMounted = true;
    const fetchBudget = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await apiClient.post<{ data: BudgetEstimate }>('/budget/estimate', {
          attractionIds,
          travellers: 1,
          travellerType: 'INDIAN'
        });
        if (isMounted) setEstimate(res.data.data);
      } catch (err: any) {
        if (isMounted) setError(err.message || 'Failed to compute transparent budget');
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    
    fetchBudget();
    return () => { isMounted = false; };
  }, [attractionIds]);

  if (!attractionIds.length) {
    return (
      <div className="text-center p-8 bg-slate-50 rounded-xl text-slate-500">
        No attractions in itinerary to estimate budget.
      </div>
    );
  }

  if (loading && !estimate) {
    return (
      <div className="flex items-center justify-center p-12 bg-white rounded-2xl border border-slate-100">
        <Loader2 className="animate-spin text-emerald-500" size={32} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 text-red-700 rounded-xl flex items-center gap-2">
        <AlertTriangle size={20} />
        {error}
      </div>
    );
  }

  if (!estimate) return null;

  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-6 text-white shadow-md">
        <div className="flex items-center gap-3 mb-2 opacity-90">
          <Wallet size={24} />
          <h2 className="font-semibold text-lg">{t('budget.title', 'Transparent Budget Engine')}</h2>
        </div>
        <div className="text-4xl font-bold mb-4">
          ₹{estimate.totalAmount.toLocaleString('en-IN')}
        </div>
        
        <div className="flex flex-wrap gap-4 text-sm opacity-90">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 size={16} />
            <span>{estimate.includedCount} Verified Items</span>
          </div>
          {estimate.unverifiedCount > 0 && (
            <div className="flex items-center gap-1.5 text-orange-200">
              <AlertTriangle size={16} />
              <span>{estimate.unverifiedCount} Estimated Items</span>
            </div>
          )}
        </div>
      </div>

      {/* Constraints Warning */}
      {estimate.warnings.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <h4 className="flex items-center gap-2 text-sm font-semibold text-amber-800 mb-2">
            <Info size={16} /> {t('budget.estimatesUsed', 'Estimates Used')}
          </h4>
          <ul className="text-sm text-amber-700 space-y-1 list-disc pl-5">
            {estimate.warnings.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        </div>
      )}

      {/* Line Items */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 font-semibold text-slate-700">
          {t('budget.lineItems', 'Line-Item Breakdown')}
        </div>
        <div className="divide-y divide-slate-100">
          {estimate.lineItems.map((item) => (
            <div key={item.attractionId} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50 transition-colors">
              <div className="flex-1">
                <div className="font-medium text-slate-900 mb-1">{item.attractionName}</div>
                <div className="flex items-center gap-2 text-xs">
                  <TrustBadge status={item.verificationStatus} />
                  {item.source && (
                    <span className="text-slate-500 flex items-center gap-1">
                      via {item.source.name}
                      {item.source.url && (
                        <a href={item.source.url} target="_blank" rel="noreferrer" className="text-emerald-600 hover:underline">
                          <ExternalLink size={12} />
                        </a>
                      )}
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right">
                <div className="font-semibold text-slate-900 text-lg">
                  ₹{item.totalAmount.toLocaleString('en-IN')}
                </div>
                {item.amountPerTraveller !== item.totalAmount && (
                  <div className="text-xs text-slate-500">
                    ₹{item.amountPerTraveller} × {item.travellers}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Simulator Action */}
      <div className="bg-slate-50 rounded-2xl border border-slate-200 p-6 flex flex-col md:flex-row gap-6 items-center justify-between">
        <div className="flex-1">
          <h3 className="font-semibold text-slate-900 flex items-center gap-2 mb-2">
            <Calculator size={18} className="text-indigo-500" />
            {t('budget.reduceAction', 'Need to cut costs?')}
          </h3>
          <p className="text-sm text-slate-500">
            Tell the AI how much you want to save, and it will safely recalculate your itinerary.
          </p>
        </div>
        <div className="flex w-full md:w-auto gap-2">
          <input
            type="number"
            value={reduceAmount}
            onChange={(e) => setReduceAmount(e.target.value)}
            placeholder="e.g. 500"
            className="flex-1 md:w-32 px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            onClick={() => {
              if (reduceAmount) {
                // This would typically tie into the What-If Simulator state
                alert(`In a full implementation, this would trigger the What-If Simulator with constraint: reduce budget by ${reduceAmount}`);
              }
            }}
            disabled={!reduceAmount}
            className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {t('budget.simulateCut', 'Simulate Cut')}
          </button>
        </div>
      </div>
    </div>
  );
}
