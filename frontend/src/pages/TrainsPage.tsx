import React, { useState, useEffect } from 'react';
import { MainLayout } from '../components/layout/MainLayout';
import {
  MapPin, Calendar, Train, TrainFront, Search,
  Filter, TrendingDown, CheckCircle2, ArrowRight, ArrowRightLeft,
  Clock, Check
} from 'lucide-react';
import { STATIONS } from '../data/trainStations';

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────
interface TrainData {
  id: string;
  name: string;
  number: string;
  departureTime: string;
  arrivalTime: string;
  duration: string;
  status: string; // 'Available', 'WL 12', 'RAC 4'
  statusColor: string;
  basePrice: number;
}

interface PlatformEstimate {
  provider: 'IRCTC' | 'MakeMyTrip' | 'ConfirmTkt';
  logo: string;
  color: string;
  bgColor: string;
  estimatedPrice: number;
  cashback: string;
  features: string[];
  bookingUrl: string;
}

// ──────────────────────────────────────────────
// Mock Data Helpers
// ──────────────────────────────────────────────
function generateTrainsForRoute(from: string, to: string, date: string): TrainData[] {
  const seeds = [
    { name: 'Vande Bharat Exp', number: '22436', dep: '06:00', arr: '14:00', dur: '08h 00m' },
    { name: 'Rajdhani Express', number: '12952', dep: '16:30', arr: '08:30', dur: '16h 00m' },
    { name: 'Shatabdi Exp', number: '12002', dep: '06:00', arr: '12:15', dur: '06h 15m' },
    { name: 'Duronto Express', number: '12273', dep: '22:30', arr: '15:15', dur: '16h 45m' },
    { name: 'Garib Rath Exp', number: '12909', dep: '16:50', arr: '10:15', dur: '17h 25m' },
    { name: 'Sampark Kranti', number: '12217', dep: '13:00', arr: '12:30', dur: '23h 30m' },
    { name: 'Superfast Exp', number: '12627', dep: '20:15', arr: '18:15', dur: '22h 00m' },
  ];

  const statuses = [
    { s: 'Available (0140)', c: 'text-green-600' },
    { s: 'Available (0045)', c: 'text-green-600' },
    { s: 'WL 12', c: 'text-orange-500' },
    { s: 'WL 112', c: 'text-red-500' },
    { s: 'RAC 24', c: 'text-yellow-600' }
  ];

  return seeds.slice(0, 3 + Math.floor(Math.random() * 4)).map((seed, i) => {
    const stat = statuses[Math.floor(Math.random() * statuses.length)];
    return {
      id: `${seed.number}-${i}`,
      name: seed.name,
      number: seed.number,
      departureTime: seed.dep,
      arrivalTime: seed.arr,
      duration: seed.dur,
      status: stat.s,
      statusColor: stat.c,
      basePrice: 500 + Math.floor(Math.random() * 2500)
    };
  });
}

function getPlatformEstimates(basePrice: number): PlatformEstimate[] {
  return [
    {
      provider: 'IRCTC',
      logo: '🚂',
      color: 'text-blue-800',
      bgColor: 'bg-blue-50',
      estimatedPrice: basePrice,
      cashback: 'Zero Convenience Fee (UPI)',
      features: ['Official Partner', 'No Hidden Charges', 'Direct Booking'],
      bookingUrl: 'https://www.irctc.co.in/',
    },
    {
      provider: 'MakeMyTrip',
      logo: '🔴',
      color: 'text-red-700',
      bgColor: 'bg-red-50',
      estimatedPrice: basePrice + 60, // Slight convenience fee
      cashback: 'Free Cancellation',
      features: ['Instant Refund', '24x7 Support', 'Trip Guarantee'],
      bookingUrl: 'https://www.makemytrip.com/railways/',
    },
    {
      provider: 'ConfirmTkt',
      logo: '🎫',
      color: 'text-green-700',
      bgColor: 'bg-green-50',
      estimatedPrice: basePrice + 40,
      cashback: 'Higher Confirmation Chances',
      features: ['Waitlist Prediction', 'Free Cancellation', 'Alternate Routes'],
      bookingUrl: 'https://www.confirmtkt.com/',
    }
  ];
}


// ──────────────────────────────────────────────
// Sub-components
// ──────────────────────────────────────────────
function PriceCard({ estimate, isRecommended }: { estimate: PlatformEstimate; isRecommended: boolean }) {
  return (
    <div className={`relative rounded-2xl border-2 p-5 transition-all duration-300 hover:shadow-lg flex flex-col ${
      isRecommended
        ? 'border-green-400 bg-gradient-to-br from-green-50 to-emerald-50 shadow-md'
        : 'border-gray-100 bg-white hover:border-orange-200'
    }`}>
      {isRecommended && (
        <div className="absolute -top-3 left-4">
          <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-500 text-white text-xs font-bold rounded-full shadow">
            <TrendingDown size={11} /> Best Choice
          </span>
        </div>
      )}

      <div className="flex flex-col gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 shrink-0 rounded-xl ${estimate.bgColor} flex items-center justify-center text-2xl font-black ${estimate.color} shadow-sm border border-white/50`}>
            {estimate.logo}
          </div>
          <div className="min-w-0">
            <p className="font-black text-gray-900 text-base truncate">{estimate.provider}</p>
            <p className="text-xs font-bold text-green-600 truncate">{estimate.cashback}</p>
          </div>
        </div>
        <div className="mt-1 pt-3 border-t border-gray-100">
          <p className="text-2xl font-black text-gray-900">₹{estimate.estimatedPrice}</p>
          <p className="text-xs text-gray-400">per passenger</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-5 flex-1 content-start">
        {estimate.features.map(f => (
          <span key={f} className="px-2 py-1 bg-white text-gray-700 rounded-lg text-[11px] font-semibold border border-gray-200">
            {f === 'Official Partner' ? <CheckCircle2 size={10} className="inline mr-1 text-green-500" /> : null}
            {f}
          </span>
        ))}
      </div>

      <a
        href={estimate.bookingUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-black transition-all shadow-sm ${
          isRecommended
            ? 'bg-green-500 hover:bg-green-600 text-white'
            : 'bg-gray-900 hover:bg-gray-800 text-white'
        }`}
      >
        Book on {estimate.provider} <ArrowRight size={15} />
      </a>
    </div>
  );
}

// ──────────────────────────────────────────────
// Main Page
// ──────────────────────────────────────────────
export const TrainsPage: React.FC = () => {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [date, setDate] = useState('');
  const [travelClass, setTravelClass] = useState('Sleeper (SL)');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [trains, setTrains] = useState<TrainData[]>([]);
  const [selectedTrain, setSelectedTrain] = useState<TrainData | null>(null);
  
  // Autocomplete
  const [openSuggestFrom, setOpenSuggestFrom] = useState(false);
  const [openSuggestTo, setOpenSuggestTo] = useState(false);

  const filteredFrom = STATIONS.filter(s => from && (s.name.toLowerCase().includes(from.toLowerCase()) || s.code.toLowerCase().includes(from.toLowerCase())));
  const filteredTo = STATIONS.filter(s => to && (s.name.toLowerCase().includes(to.toLowerCase()) || s.code.toLowerCase().includes(to.toLowerCase())));

  useEffect(() => {
    const tmrw = new Date();
    tmrw.setDate(tmrw.getDate() + 1);
    setDate(tmrw.toISOString().slice(0, 10));
  }, []);

  function handleSearch() {
    if (!from || !to) {
      setError('Please select both source and destination stations.');
      return;
    }
    if (from.toLowerCase() === to.toLowerCase()) {
      setError('Source and destination cannot be the same.');
      return;
    }
    setError('');
    setLoading(true);
    setSelectedTrain(null);
    setTrains([]);

    setTimeout(() => {
      setTrains(generateTrainsForRoute(from, to, date));
      setLoading(false);
    }, 1200);
  }

  function swapStations() {
    const temp = from;
    setFrom(to);
    setTo(temp);
  }

  return (
    <MainLayout>
      <div className="max-w-6xl mx-auto px-4 pb-20">
        {/* ── Header ── */}
        <div className="mb-8 pt-2">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center text-xl text-orange-600">
              <TrainFront size={22} className="fill-current" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-gray-900">Book your Train</h1>
              <p className="text-sm text-gray-500">Compare train availability and prices across IRCTC, MakeMyTrip & ConfirmTkt</p>
            </div>
          </div>
        </div>

        {/* ── Search Bar ── */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-md p-3 mb-10 flex flex-col lg:flex-row gap-2 relative">
          
          <div className="flex flex-col sm:flex-row flex-[2] relative">
            {/* From */}
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                <MapPin size={18} className="text-gray-400" />
              </div>
              <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-xs font-bold text-gray-400 uppercase">
                From
              </div>
              <input
                type="text"
                value={from}
                onChange={e => { setFrom(e.target.value); setOpenSuggestFrom(true); }}
                onBlur={() => setTimeout(() => setOpenSuggestFrom(false), 200)}
                onFocus={() => setOpenSuggestFrom(true)}
                placeholder="Leaving from"
                className="w-full pl-12 pr-16 py-4 bg-gray-50 border border-transparent rounded-2xl focus:bg-white focus:border-orange-400 focus:ring-4 focus:ring-orange-100 text-gray-900 font-bold transition-all placeholder:font-normal"
              />
              {openSuggestFrom && filteredFrom.length > 0 && (
                <ul className="absolute z-50 mt-2 w-full bg-white border border-gray-100 rounded-2xl shadow-xl max-h-60 overflow-auto py-2">
                  {filteredFrom.map(s => {
                    const label = `${s.name} (${s.code})`;
                    return (
                      <li key={s.code} onMouseDown={() => { setFrom(label); setOpenSuggestFrom(false); }} className="px-5 py-3 hover:bg-orange-50 cursor-pointer flex items-center gap-3 text-gray-700 font-medium transition-colors">
                        <Train size={16} className="text-orange-500 opacity-50" /> {label}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <button onClick={swapStations} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-white border border-gray-200 rounded-full flex items-center justify-center text-orange-500 hover:bg-orange-50 shadow-sm transition-colors hidden sm:flex">
              <ArrowRightLeft size={14} />
            </button>

            {/* To */}
            <div className="relative flex-1 sm:ml-2 mt-2 sm:mt-0">
              <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                <MapPin size={18} className="text-gray-400" />
              </div>
              <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-xs font-bold text-gray-400 uppercase">
                To
              </div>
              <input
                type="text"
                value={to}
                onChange={e => { setTo(e.target.value); setOpenSuggestTo(true); }}
                onBlur={() => setTimeout(() => setOpenSuggestTo(false), 200)}
                onFocus={() => setOpenSuggestTo(true)}
                placeholder="Going to"
                className="w-full pl-12 pr-12 py-4 bg-gray-50 border border-transparent rounded-2xl focus:bg-white focus:border-orange-400 focus:ring-4 focus:ring-orange-100 text-gray-900 font-bold transition-all placeholder:font-normal"
              />
              {openSuggestTo && filteredTo.length > 0 && (
                <ul className="absolute z-50 mt-2 w-full bg-white border border-gray-100 rounded-2xl shadow-xl max-h-60 overflow-auto py-2">
                  {filteredTo.map(s => {
                    const label = `${s.name} (${s.code})`;
                    return (
                      <li key={s.code} onMouseDown={() => { setTo(label); setOpenSuggestTo(false); }} className="px-5 py-3 hover:bg-orange-50 cursor-pointer flex items-center gap-3 text-gray-700 font-medium transition-colors">
                        <Train size={16} className="text-orange-500 opacity-50" /> {label}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row flex-1 gap-2 mt-2 lg:mt-0 lg:ml-2">
            {/* Date */}
            <div className="relative flex-[1.5]">
              <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                <Calendar size={18} className="text-gray-400" />
              </div>
              <input
                type="date"
                value={date}
                min={new Date().toISOString().slice(0, 10)}
                onChange={e => setDate(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-transparent rounded-2xl focus:bg-white focus:border-orange-400 focus:ring-4 focus:ring-orange-100 text-gray-900 font-bold transition-all text-sm"
              />
            </div>
            
            {/* Class */}
            <div className="relative flex-1">
              <select
                value={travelClass}
                onChange={e => setTravelClass(e.target.value)}
                className="w-full px-4 py-4 bg-gray-50 border border-transparent rounded-2xl focus:bg-white focus:border-orange-400 focus:ring-4 focus:ring-orange-100 text-gray-900 font-bold transition-all text-sm appearance-none text-center"
              >
                <option>All Classes</option>
                <option>Sleeper (SL)</option>
                <option>AC 3 Tier (3A)</option>
                <option>AC 2 Tier (2A)</option>
                <option>First AC (1A)</option>
                <option>AC Chair Car (CC)</option>
              </select>
            </div>
          </div>

          <button
            onClick={handleSearch}
            disabled={loading || !from || !to}
            className="mt-2 lg:mt-0 lg:ml-2 py-4 px-8 bg-orange-500 hover:bg-orange-600 text-white font-black rounded-2xl transition-all shadow-lg shadow-orange-200 disabled:opacity-50 disabled:shadow-none whitespace-nowrap flex items-center justify-center gap-2"
          >
            {loading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Search size={18} />}
            {loading ? 'Searching...' : 'Search Trains'}
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-2xl border border-red-100 flex items-center gap-2 text-sm font-bold">
            <TrendingDown size={16} /> {error}
          </div>
        )}

        {/* ── Train List ── */}
        {!selectedTrain && trains.length > 0 && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-black text-gray-900">Available Trains: {from} to {to}</h2>
              <div className="flex gap-2">
                <button className="flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-700 hover:bg-gray-50">
                  <Filter size={14} /> Filter
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              {trains.map(train => (
                <div
                  key={train.id}
                  onClick={() => setSelectedTrain(train)}
                  className="group bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl hover:border-orange-200 transition-all duration-300 cursor-pointer p-5 flex flex-col md:flex-row items-center justify-between gap-6 hover:-translate-y-0.5"
                >
                  <div className="flex items-center gap-4 w-full md:w-auto flex-1">
                    <div className="w-12 h-12 rounded-xl bg-orange-50 flex items-center justify-center text-orange-500 shrink-0">
                      <Train size={24} />
                    </div>
                    <div>
                      <h3 className="font-black text-lg text-gray-900 flex items-center gap-2">
                        {train.name} <span className="text-sm font-semibold text-gray-400 bg-gray-50 px-2 py-0.5 rounded-md border border-gray-200">{train.number}</span>
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs font-bold text-gray-500">{travelClass !== 'All Classes' ? travelClass : 'Multiple Classes'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between w-full md:w-auto md:flex-1 md:justify-center gap-4">
                    <div className="text-right">
                      <p className="font-black text-lg text-gray-900">{train.departureTime}</p>
                      <p className="text-xs font-bold text-gray-500">{from}</p>
                    </div>
                    
                    <div className="flex flex-col items-center flex-1 max-w-[120px]">
                      <span className="text-xs font-bold text-gray-400 mb-1 flex items-center gap-1"><Clock size={12}/> {train.duration}</span>
                      <div className="w-full relative flex items-center justify-center">
                        <div className="absolute w-full h-[2px] bg-gray-200"></div>
                        <div className="w-2 h-2 rounded-full bg-orange-400 z-10 absolute left-0"></div>
                        <div className="w-2 h-2 rounded-full bg-orange-400 z-10 absolute right-0"></div>
                      </div>
                    </div>

                    <div className="text-left">
                      <p className="font-black text-lg text-gray-900">{train.arrivalTime}</p>
                      <p className="text-xs font-bold text-gray-500">{to}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between w-full md:w-auto md:justify-end gap-6 border-t md:border-t-0 pt-4 md:pt-0 border-gray-100">
                    <div className="text-left md:text-right">
                      <p className={`text-sm font-black flex items-center gap-1.5 ${train.statusColor}`}>
                        {train.status.includes('Available') && <CheckCircle2 size={16} />} {train.status}
                      </p>
                      <p className="text-lg font-black text-gray-900 mt-1">₹{train.basePrice} <span className="text-xs font-medium text-gray-400">onwards</span></p>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center group-hover:bg-orange-500 group-hover:text-white transition-colors shrink-0">
                      <ArrowRight size={18} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Selected Train / Comparison ── */}
        {selectedTrain && (() => {
          const estimates = getPlatformEstimates(selectedTrain.basePrice);
          const cheapest = estimates.reduce((a, b) => a.estimatedPrice < b.estimatedPrice ? a : b);
          
          return (
            <div className="animate-in fade-in zoom-in-95 duration-400">
              <button
                onClick={() => setSelectedTrain(null)}
                className="mb-6 flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-orange-600 transition-colors"
              >
                ← Back to train list
              </button>

              <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 mb-8">
                <div className="flex flex-col md:flex-row gap-6 mb-8 items-start border-b border-gray-100 pb-8">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="bg-orange-100 text-orange-700 px-2 py-1 rounded text-xs font-black">{selectedTrain.number}</span>
                      <span className="text-sm font-bold text-gray-500">Train details</span>
                    </div>
                    <h2 className="text-3xl font-black text-gray-900 mb-2">{selectedTrain.name}</h2>
                    <div className="flex items-center gap-3">
                      <p className={`text-sm font-black flex items-center gap-1.5 ${selectedTrain.statusColor}`}>
                        {selectedTrain.status}
                      </p>
                      <span className="text-gray-300">•</span>
                      <p className="text-sm font-bold text-gray-600">Travel Class: {travelClass !== 'All Classes' ? travelClass : 'SL'}</p>
                    </div>
                  </div>
                  
                  <div className="bg-orange-50/50 p-5 rounded-2xl border border-orange-100 shrink-0 w-full md:w-auto">
                    <p className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wider text-center">Journey</p>
                    <div className="flex items-center justify-center gap-4">
                      <div className="text-right">
                        <p className="text-xl font-black text-gray-900">{selectedTrain.departureTime}</p>
                        <p className="text-xs font-bold text-gray-500">{from}</p>
                      </div>
                      <div className="flex flex-col items-center">
                        <span className="text-[10px] font-bold text-gray-400 mb-0.5">{selectedTrain.duration}</span>
                        <div className="w-12 h-0.5 bg-orange-300 relative">
                          <ArrowRight size={10} className="absolute -right-1 -top-[4px] text-orange-400"/>
                        </div>
                      </div>
                      <div className="text-left">
                        <p className="text-xl font-black text-gray-900">{selectedTrain.arrivalTime}</p>
                        <p className="text-xs font-bold text-gray-500">{to}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-xl font-black text-gray-900 mb-6 flex items-center gap-2">
                    <TrendingDown size={22} className="text-green-500" /> Compare Prices & Check Availability
                  </h3>

                  {/* Recommended Banner */}
                  <div className="flex flex-col sm:flex-row items-center gap-4 p-5 rounded-2xl bg-gradient-to-r from-green-500 to-emerald-500 text-white mb-8 shadow-md shadow-green-100">
                    <div className="w-14 h-14 rounded-xl bg-white/20 flex items-center justify-center text-3xl shrink-0 border border-white/30">
                      {cheapest.logo}
                    </div>
                    <div className="flex-1 text-center sm:text-left">
                      <p className="text-xs font-bold opacity-90 uppercase tracking-widest mb-1 flex items-center justify-center sm:justify-start gap-1">
                        <Check size={12} className="fill-current" /> Top Recommendation
                      </p>
                      <p className="text-2xl font-black mb-1">{cheapest.provider} — ₹{cheapest.estimatedPrice}</p>
                      <p className="text-sm font-medium opacity-90">Includes {cheapest.cashback}</p>
                    </div>
                    <div className="flex flex-col items-center gap-2 shrink-0 w-full sm:w-auto">
                      <span className="bg-white/20 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                        <CheckCircle2 size={12} /> Best Choice
                      </span>
                    </div>
                  </div>

                  {/* Grid of platforms */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    {estimates.map(est => (
                      <PriceCard
                        key={est.provider}
                        estimate={est}
                        isRecommended={cheapest.provider === est.provider}
                      />
                    ))}
                  </div>

                </div>
              </div>
            </div>
          );
        })()}

        {/* ── Empty State ── */}
        {trains.length === 0 && !selectedTrain && !loading && (
          <div className="text-center py-20">
            <div className="w-24 h-24 bg-orange-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <Train size={40} className="text-orange-400" />
            </div>
            <h3 className="text-xl font-black text-gray-900 mb-2">Search for Trains</h3>
            <p className="text-sm text-gray-500 max-w-sm mx-auto leading-relaxed">
              Find availability, current waitlist status, and compare prices across IRCTC, MakeMyTrip, and ConfirmTkt.
            </p>
          </div>
        )}
      </div>
    </MainLayout>
  );
};
