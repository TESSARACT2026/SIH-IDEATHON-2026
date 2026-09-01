/**
 * Feature 8: Group Trip Planner Page
 *
 * Create a group trip → share join code → each participant fills preferences
 * → generate a blended itinerary that transparently shows the allocation.
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { apiClient } from '../api/client';
import {
  Users, Copy, Check, Plus, Loader2, ArrowRight, Sparkles,
  ChevronRight, AlertCircle
} from 'lucide-react';

type Step = 'create' | 'share' | 'join' | 'result';

interface GroupInfo {
  id: string;
  joinCode: string;
  title: string;
  participantCount: number;
  participants: Array<{ name: string; interests: string[]; pace: string }>;
}

interface BlendedResult {
  plan: {
    itineraryItems: Array<{
      dayNumber: number;
      sequence: number;
      attractionName: string;
      startTime: string;
      endTime: string;
    }>;
    warnings: string[];
  };
  interestAllocation: Record<string, number>;
  constraints: string[];
  participantCount: number;
}

export function GroupPlanPage() {
  const { t } = useTranslation();
  const [step, setStep] = useState<Step>('create');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Create form
  const [destinationId, setDestinationId] = useState('bhubaneswar');
  const [startDate, setStartDate] = useState('');
  const [days, setDays] = useState(2);
  const [title, setTitle] = useState('');

  // Group state
  const [groupInfo, setGroupInfo] = useState<GroupInfo | null>(null);
  const [joinCode, setJoinCode] = useState('');

  // Join form
  const [name, setName] = useState('');
  const [pace, setPace] = useState<'RELAXED' | 'MODERATE' | 'PACKED'>('MODERATE');
  const [interests, setInterests] = useState<string[]>([]);

  // Result
  const [result, setResult] = useState<BlendedResult | null>(null);

  const interestOptions = [
    'Heritage', 'Temples', 'Nature', 'Food', 'Adventure',
    'Art & Culture', 'Shopping', 'Photography', 'Nightlife', 'Museums',
  ];

  const createGroup = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.post<{ data: { joinCode: string; id: string; title: string } }>('/groups', {
        destinationId,
        startDate: new Date(startDate).toISOString(),
        days,
        title: title || 'Group Trip',
      });
      setGroupInfo({
        ...res.data.data,
        participantCount: 0,
        participants: [],
      });
      setJoinCode(res.data.data.joinCode);
      setStep('share');
    } catch (err: any) {
      setError(err.message || 'Failed to create group');
    } finally {
      setLoading(false);
    }
  };

  const joinGroup = async () => {
    setLoading(true);
    setError(null);
    try {
      await apiClient.post(`/groups/${joinCode}/join`, {
        name,
        preferences: {
          pace,
          interests,
          accessibilityWheelchair: false,
          accessibilityVision: false,
          accessibilityHearing: false,
          accessibilityCognitive: false,
          transportPreference: 'MIXED',
        },
      });
      // Refresh group info
      const res = await apiClient.get<{ data: GroupInfo }>(`/groups/${joinCode}`);
      setGroupInfo(res.data.data);
      setStep('share');
    } catch (err: any) {
      setError(err.message || 'Failed to join group');
    } finally {
      setLoading(false);
    }
  };

  const generateBlended = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.post<{ data: BlendedResult }>(`/groups/${joinCode}/generate`);
      setResult(res.data.data);
      setStep('result');
    } catch (err: any) {
      setError(err.message || 'Failed to generate itinerary');
    } finally {
      setLoading(false);
    }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(joinCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white">
            <Users size={32} />
          </div>
          <h1 className="text-3xl font-bold text-slate-900">{t('group.title')}</h1>
          <p className="text-slate-500 mt-2">{t('group.subtitle')}</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 rounded-xl text-red-700 text-sm flex items-center gap-2">
            <AlertCircle size={16} /> {error}
          </div>
        )}

        {/* Step: Create */}
        {step === 'create' && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-5">
            <h2 className="font-semibold text-lg text-slate-900">{t('group.create')}</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Trip Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Weekend Getaway"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Destination ID</label>
                <input
                  type="text"
                  value={destinationId}
                  onChange={(e) => setDestinationId(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Days</label>
                  <input
                    type="number"
                    value={days}
                    onChange={(e) => setDays(parseInt(e.target.value) || 1)}
                    min={1}
                    max={14}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={createGroup}
                disabled={loading || !startDate}
                className="flex-1 py-3 bg-violet-600 text-white rounded-xl font-semibold hover:bg-violet-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="animate-spin" size={18} /> : <Plus size={18} />}
                {t('group.create')}
              </button>
              <button
                onClick={() => setStep('join')}
                className="px-6 py-3 border border-slate-200 rounded-xl font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                {t('group.join')}
              </button>
            </div>
          </div>
        )}

        {/* Step: Join */}
        {step === 'join' && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-5">
            <h2 className="font-semibold text-lg text-slate-900">{t('group.join')}</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('group.joinCode')}</label>
                <input
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder={t('group.joinPlaceholder')}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-mono tracking-widest text-center focus:outline-none focus:ring-2 focus:ring-violet-300"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('group.yourName')}</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Pace</label>
                <div className="flex gap-2">
                  {(['RELAXED', 'MODERATE', 'PACKED'] as const).map((p) => (
                    <button
                      key={p}
                      onClick={() => setPace(p)}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${pace === p ? 'bg-violet-100 text-violet-700 border-violet-300 border' : 'border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Interests</label>
                <div className="flex flex-wrap gap-2">
                  {interestOptions.map((interest) => (
                    <button
                      key={interest}
                      onClick={() => setInterests((prev) => prev.includes(interest) ? prev.filter((i) => i !== interest) : [...prev, interest])}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${interests.includes(interest) ? 'bg-violet-100 text-violet-700 border-violet-300 border' : 'border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                    >
                      {interest}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button
              onClick={joinGroup}
              disabled={loading || !joinCode || !name}
              className="w-full py-3 bg-violet-600 text-white rounded-xl font-semibold hover:bg-violet-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="animate-spin" size={18} /> : <ArrowRight size={18} />}
              {t('group.submitPrefs')}
            </button>
          </div>
        )}

        {/* Step: Share & Wait */}
        {step === 'share' && groupInfo && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-5">
            <h2 className="font-semibold text-lg text-slate-900">{groupInfo.title || 'Group Trip'}</h2>

            {/* Join code */}
            <div className="text-center py-6 bg-violet-50 rounded-xl">
              <div className="text-xs text-violet-600 font-medium uppercase tracking-wide mb-2">{t('group.joinCode')}</div>
              <div className="text-4xl font-mono font-bold text-violet-900 tracking-[0.3em]">{joinCode}</div>
              <button
                onClick={copyCode}
                className="mt-3 px-4 py-1.5 text-sm font-medium text-violet-700 hover:bg-violet-100 rounded-lg transition-colors flex items-center gap-1.5 mx-auto"
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? 'Copied!' : t('group.copyCode')}
              </button>
            </div>

            {/* Participants */}
            <div>
              <h3 className="text-sm font-medium text-slate-700 mb-2">
                {t('group.participants')} ({groupInfo.participantCount})
              </h3>
              {groupInfo.participants.length > 0 ? (
                <div className="space-y-2">
                  {groupInfo.participants.map((p, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg text-sm">
                      <span className="font-medium text-slate-900">{p.name}</span>
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span>{p.pace}</span>
                        <span>•</span>
                        <span>{p.interests.slice(0, 3).join(', ')}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-400">Waiting for participants to join...</p>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep('join')}
                className="flex-1 py-3 border border-slate-200 rounded-xl font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Add My Preferences
              </button>
              <button
                onClick={generateBlended}
                disabled={loading || (groupInfo.participantCount < 2)}
                className="flex-1 py-3 bg-violet-600 text-white rounded-xl font-semibold hover:bg-violet-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />}
                {t('group.generate')}
              </button>
            </div>

            {groupInfo.participantCount < 2 && (
              <p className="text-xs text-amber-600 text-center">{t('group.minParticipants')}</p>
            )}
          </div>
        )}

        {/* Step: Result */}
        {step === 'result' && result && (
          <div className="space-y-6">
            {/* Constraints applied */}
            {result.constraints.length > 0 && (
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
                <h3 className="font-semibold text-slate-900 mb-3">{t('group.constraints')}</h3>
                <div className="space-y-2">
                  {result.constraints.map((c, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm text-slate-700">
                      <ChevronRight size={14} className="text-violet-500 mt-0.5 shrink-0" />
                      {c}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Interest allocation */}
            {Object.keys(result.interestAllocation).length > 0 && (
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
                <h3 className="font-semibold text-slate-900 mb-3">{t('group.interestAllocation')}</h3>
                <div className="space-y-2">
                  {Object.entries(result.interestAllocation)
                    .sort(([, a], [, b]) => b - a)
                    .map(([interest, pct]) => (
                      <div key={interest} className="flex items-center gap-3">
                        <span className="text-sm text-slate-700 w-28 shrink-0">{interest}</span>
                        <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-violet-500 rounded-full"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs font-mono text-slate-500 w-10 text-right">{pct}%</span>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Itinerary */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
              <h3 className="font-semibold text-slate-900 mb-3">Blended Itinerary</h3>
              {result.plan.itineraryItems.map((item, i) => (
                <div key={i} className="flex items-center gap-3 py-3 border-b border-slate-100 last:border-0">
                  <div className="w-8 h-8 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center text-xs font-bold">
                    D{item.dayNumber}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-slate-900 text-sm">{item.attractionName}</div>
                    <div className="text-xs text-slate-500">{item.startTime} – {item.endTime}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
