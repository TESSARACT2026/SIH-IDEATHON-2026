import React, { useState, useEffect } from 'react';
import { MainLayout } from '../components/layout/MainLayout';
import {
  MapPin, Navigation, Calendar, Clock, Car, ChevronRight,
  Star, Zap, TrendingDown, CheckCircle2, ArrowRight, Search, Filter
} from 'lucide-react';

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────
interface CabEstimate {
  provider: 'Ola' | 'Uber' | 'Rapido';
  logo: string;
  color: string;
  bgColor: string;
  category: string;
  estimatedFare: number;
  eta: number; // minutes
  rating: number;
  features: string[];
  bookingUrl: string;
}

// ──────────────────────────────────────────────
// Fare calculation helpers
// ──────────────────────────────────────────────
const BASE_FARES: Record<string, { ola: number; uber: number; rapido: number }> = {
  mini:    { ola: 9,  uber: 10, rapido: 7 },
  sedan:   { ola: 12, uber: 13, rapido: 10 },
  suv:     { ola: 16, uber: 17, rapido: 14 },
  bike:    { ola: 5,  uber: 6,  rapido: 4  },
};

const NIGHT_SURCHARGE = 1.25; // 25% extra between 11pm–5am
const PEAK_SURCHARGE  = 1.15; // 15% extra 8–10am, 5–8pm

function getSurcharge(dt: Date): number {
  const h = dt.getHours();
  if (h >= 23 || h < 5) return NIGHT_SURCHARGE;
  if ((h >= 8 && h < 10) || (h >= 17 && h < 20)) return PEAK_SURCHARGE;
  return 1;
}

// Haversine distance in km
function haversine(a: [number, number], b: [number, number]): number {
  const R = 6371;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLon = toRad(b[1] - a[1]);
  const sin2 = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(sin2), Math.sqrt(1 - sin2));
}

function estimateFare(
  distKm: number,
  type: string,
  scheduledAt: Date,
): { ola: number; uber: number; rapido: number } {
  const base = BASE_FARES[type] || BASE_FARES.mini;
  const s = getSurcharge(scheduledAt);
  const minFare = 50;
  const calc = (rate: number) => Math.max(minFare, Math.round(rate * distKm * s));
  return {
    ola:    calc(base.ola),
    uber:   calc(base.uber),
    rapido: calc(base.rapido),
  };
}

// ──────────────────────────────────────────────
// Popular Indian cities for autocomplete
// ──────────────────────────────────────────────
const CITIES: { name: string; coords: [number, number] }[] = [
  { name: 'New Delhi', coords: [28.6139, 77.2090] },
  { name: 'Mumbai',    coords: [19.0760, 72.8777] },
  { name: 'Bengaluru', coords: [12.9716, 77.5946] },
  { name: 'Hyderabad', coords: [17.3850, 78.4867] },
  { name: 'Chennai',   coords: [13.0827, 80.2707] },
  { name: 'Kolkata',   coords: [22.5726, 88.3639] },
  { name: 'Jaipur',    coords: [26.9124, 75.7873] },
  { name: 'Pune',      coords: [18.5204, 73.8567] },
  { name: 'Ahmedabad', coords: [23.0225, 72.5714] },
  { name: 'Surat',     coords: [21.1702, 72.8311] },
  { name: 'Agra',      coords: [27.1767, 78.0081] },
  { name: 'Varanasi',  coords: [25.3176, 82.9739] },
  { name: 'Amritsar',  coords: [31.6200, 74.8765] },
  { name: 'Bhubaneswar', coords: [20.2961, 85.8245] },
  { name: 'Guwahati',  coords: [26.1445, 91.7362] },
  { name: 'Chandigarh', coords: [30.7333, 76.7794] },
  { name: 'Kochi',     coords: [9.9312, 76.2673] },
  { name: 'Goa',       coords: [15.2993, 74.1240] },
  { name: 'Srinagar',  coords: [34.0837, 74.7973] },
  { name: 'Leh',       coords: [34.1526, 77.5771] },
];

// ──────────────────────────────────────────────
// Intra-city stops by city (short destinations)
// ──────────────────────────────────────────────
interface CityStop {
  name: string;
  type: string;
  emoji: string;
  coords: [number, number];
  distKm?: number; // filled at runtime
}

const CITY_STOPS: Record<string, CityStop[]> = {
  'Bhubaneswar': [
    { name: 'Lingaraj Temple', type: 'Heritage', emoji: '🛕', coords: [20.2390, 85.8337] },
    { name: 'Udayagiri Caves', type: 'Heritage', emoji: '🏛️', coords: [20.2556, 85.7939] },
    { name: 'Nandankanan Zoo', type: 'Nature', emoji: '🦁', coords: [20.3958, 85.8222] },
    { name: 'ISKCON Temple', type: 'Spiritual', emoji: '🙏', coords: [20.3018, 85.8374] },
    { name: 'Ekamra Haat', type: 'Shopping', emoji: '🛍️', coords: [20.2812, 85.8395] },
    { name: 'Dhauli Peace Pagoda', type: 'Historic', emoji: '☮️', coords: [20.1956, 85.8423] },
    { name: 'Regional Museum', type: 'Culture', emoji: '🏺', coords: [20.2671, 85.8393] },
    { name: 'Bhubaneswar Railway Station', type: 'Transport', emoji: '🚉', coords: [20.2692, 85.8436] },
  ],
  'New Delhi': [
    { name: 'Red Fort', type: 'Heritage', emoji: '🏯', coords: [28.6562, 77.2410] },
    { name: 'Qutub Minar', type: 'Heritage', emoji: '🗼', coords: [28.5245, 77.1855] },
    { name: 'India Gate', type: 'Landmark', emoji: '🏛️', coords: [28.6129, 77.2295] },
    { name: 'Lotus Temple', type: 'Spiritual', emoji: '🌸', coords: [28.5535, 77.2588] },
    { name: 'Humayun\'s Tomb', type: 'Heritage', emoji: '⚰️', coords: [28.5933, 77.2507] },
    { name: 'Connaught Place', type: 'Shopping', emoji: '🛍️', coords: [28.6315, 77.2167] },
    { name: 'IGI Airport T3', type: 'Transport', emoji: '✈️', coords: [28.5562, 77.1000] },
    { name: 'New Delhi Railway Station', type: 'Transport', emoji: '🚉', coords: [28.6431, 77.2194] },
  ],
  'Mumbai': [
    { name: 'Gateway of India', type: 'Landmark', emoji: '🏛️', coords: [18.9220, 72.8347] },
    { name: 'Marine Drive', type: 'Scenic', emoji: '🌊', coords: [18.9438, 72.8236] },
    { name: 'Elephanta Caves', type: 'Heritage', emoji: '🏛️', coords: [18.9633, 72.9315] },
    { name: 'Siddhivinayak Temple', type: 'Spiritual', emoji: '🙏', coords: [19.0168, 72.8302] },
    { name: 'Chhatrapati Shivaji Terminus', type: 'Transport', emoji: '🚉', coords: [18.9400, 72.8347] },
    { name: 'Juhu Beach', type: 'Nature', emoji: '🏖️', coords: [19.0968, 72.8264] },
    { name: 'Dharavi', type: 'Culture', emoji: '🏘️', coords: [19.0432, 72.8535] },
    { name: 'BKC Business District', type: 'Business', emoji: '🏢', coords: [19.0596, 72.8656] },
  ],
  'Bengaluru': [
    { name: 'Lalbagh Botanical Garden', type: 'Nature', emoji: '🌿', coords: [12.9507, 77.5848] },
    { name: 'Cubbon Park', type: 'Nature', emoji: '🌳', coords: [12.9763, 77.5929] },
    { name: 'Bangalore Palace', type: 'Heritage', emoji: '🏰', coords: [12.9987, 77.5921] },
    { name: 'ISKCON Temple Bangalore', type: 'Spiritual', emoji: '🙏', coords: [13.0097, 77.5510] },
    { name: 'MG Road', type: 'Shopping', emoji: '🛍️', coords: [12.9753, 77.6126] },
    { name: 'Kempegowda Airport', type: 'Transport', emoji: '✈️', coords: [13.1986, 77.7066] },
    { name: 'Vidhana Soudha', type: 'Government', emoji: '🏛️', coords: [12.9791, 77.5913] },
    { name: 'Electronic City', type: 'Business', emoji: '💻', coords: [12.8437, 77.6636] },
  ],
  'Jaipur': [
    { name: 'Amber Fort', type: 'Heritage', emoji: '🏰', coords: [26.9855, 75.8513] },
    { name: 'Hawa Mahal', type: 'Heritage', emoji: '🏛️', coords: [26.9239, 75.8267] },
    { name: 'City Palace', type: 'Heritage', emoji: '👑', coords: [26.9258, 75.8237] },
    { name: 'Jantar Mantar', type: 'Science', emoji: '🔭', coords: [26.9247, 75.8242] },
    { name: 'Nahargarh Fort', type: 'Heritage', emoji: '⚔️', coords: [26.9444, 75.8068] },
    { name: 'Johri Bazaar', type: 'Shopping', emoji: '💎', coords: [26.9188, 75.8274] },
    { name: 'Jaipur Junction', type: 'Transport', emoji: '🚉', coords: [26.9197, 75.7889] },
    { name: 'Albert Hall Museum', type: 'Culture', emoji: '🏺', coords: [26.9114, 75.8193] },
  ],
  'Hyderabad': [
    { name: 'Charminar', type: 'Heritage', emoji: '🕌', coords: [17.3616, 78.4747] },
    { name: 'Golconda Fort', type: 'Heritage', emoji: '🏰', coords: [17.3833, 78.4011] },
    { name: 'Hussain Sagar Lake', type: 'Scenic', emoji: '🌊', coords: [17.4239, 78.4738] },
    { name: 'Ramoji Film City', type: 'Entertainment', emoji: '🎬', coords: [17.2543, 78.6808] },
    { name: 'Birla Mandir', type: 'Spiritual', emoji: '🛕', coords: [17.4062, 78.4691] },
    { name: 'HITECH City', type: 'Business', emoji: '💻', coords: [17.4435, 78.3772] },
    { name: 'Rajiv Gandhi Airport', type: 'Transport', emoji: '✈️', coords: [17.2403, 78.4294] },
    { name: 'Laad Bazaar', type: 'Shopping', emoji: '📿', coords: [17.3618, 78.4761] },
  ],
  'Chennai': [
    { name: 'Marina Beach', type: 'Nature', emoji: '🏖️', coords: [13.0500, 80.2824] },
    { name: 'Kapaleeshwarar Temple', type: 'Spiritual', emoji: '🛕', coords: [13.0337, 80.2692] },
    { name: 'Fort St. George', type: 'Heritage', emoji: '🏰', coords: [13.0810, 80.2870] },
    { name: 'Chennai Central Railway', type: 'Transport', emoji: '🚉', coords: [13.0827, 80.2758] },
    { name: 'T Nagar Shopping', type: 'Shopping', emoji: '🛍️', coords: [13.0418, 80.2341] },
    { name: 'Valluvar Kottam', type: 'Culture', emoji: '📜', coords: [13.0584, 80.2453] },
    { name: 'Chennai Airport', type: 'Transport', emoji: '✈️', coords: [12.9900, 80.1693] },
    { name: 'Mahabalipuram', type: 'Heritage', emoji: '🏛️', coords: [12.6269, 80.1927] },
  ],
  'Kolkata': [
    { name: 'Victoria Memorial', type: 'Heritage', emoji: '🏛️', coords: [22.5448, 88.3426] },
    { name: 'Howrah Bridge', type: 'Landmark', emoji: '🌉', coords: [22.5851, 88.3468] },
    { name: 'Dakshineswar Temple', type: 'Spiritual', emoji: '🛕', coords: [22.6545, 88.3579] },
    { name: 'Indian Museum', type: 'Culture', emoji: '🏺', coords: [22.5574, 88.3511] },
    { name: 'Science City', type: 'Science', emoji: '🔬', coords: [22.5369, 88.3948] },
    { name: 'Park Street', type: 'Shopping', emoji: '🛍️', coords: [22.5502, 88.3516] },
    { name: 'Howrah Station', type: 'Transport', emoji: '🚉', coords: [22.5833, 88.3423] },
    { name: 'Kolkata Airport', type: 'Transport', emoji: '✈️', coords: [22.6541, 88.4467] },
  ],
};

// ──────────────────────────────────────────────
// Sub-components
// ──────────────────────────────────────────────
function LocationInput({
  label, placeholder, value, onChange, onCurrentLocation, icon,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  onCurrentLocation?: () => void;
  icon: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const filtered = CITIES.filter(c =>
    value.length > 0 && c.name.toLowerCase().includes(value.toLowerCase())
  );

  return (
    <div className="relative">
      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">{label}</label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-orange-500">{icon}</span>
        <input
          type="text"
          value={value}
          onChange={e => { onChange(e.target.value); setOpen(true); }}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="w-full pl-10 pr-10 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 text-sm bg-white transition-all"
        />
        {onCurrentLocation && (
          <button
            type="button"
            onClick={onCurrentLocation}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-500 hover:text-blue-700 transition-colors"
            title="Use current location"
          >
            <Navigation size={16} />
          </button>
        )}
      </div>
      {open && filtered.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-xl max-h-48 overflow-auto">
          {filtered.map(c => (
            <li
              key={c.name}
              onMouseDown={() => { onChange(c.name); setOpen(false); }}
              className="px-4 py-2.5 text-sm hover:bg-orange-50 cursor-pointer flex items-center gap-2"
            >
              <MapPin size={13} className="text-orange-400 shrink-0" />
              {c.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CabCard({ estimate, isRecommended }: { estimate: CabEstimate; isRecommended: boolean }) {
  return (
    <div className={`relative rounded-2xl border-2 p-5 transition-all duration-300 hover:shadow-lg ${
      isRecommended
        ? 'border-green-400 bg-gradient-to-br from-green-50 to-emerald-50 shadow-md'
        : 'border-gray-100 bg-white hover:border-orange-200'
    }`}>
      {isRecommended && (
        <div className="absolute -top-3 left-4">
          <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-500 text-white text-xs font-bold rounded-full shadow">
            <TrendingDown size={11} /> Best Price
          </span>
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-xl ${estimate.bgColor} flex items-center justify-center text-2xl font-black ${estimate.color} shadow-sm`}>
            {estimate.logo}
          </div>
          <div>
            <p className="font-black text-gray-900 text-base">{estimate.provider}</p>
            <p className="text-xs text-gray-500 font-medium">{estimate.category}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-black text-gray-900">₹{estimate.estimatedFare}</p>
          <p className="text-xs text-gray-400">estimated</p>
        </div>
      </div>

      <div className="flex items-center gap-4 mb-4 text-xs text-gray-600">
        <span className="flex items-center gap-1">
          <Clock size={12} className="text-orange-400" />
          {estimate.eta} min ETA
        </span>
        <span className="flex items-center gap-1">
          <Star size={12} className="text-yellow-400 fill-current" />
          {estimate.rating}
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-4">
        {estimate.features.map(f => (
          <span key={f} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-[11px] font-medium">
            {f}
          </span>
        ))}
      </div>

      <a
        href={estimate.bookingUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all ${
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
export const PreBookedCabsPage: React.FC = () => {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [cabType, setCabType] = useState<'mini' | 'sedan' | 'suv' | 'bike'>('mini');
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [estimates, setEstimates] = useState<CabEstimate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [distance, setDistance] = useState<number | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  // Short destinations state
  const [shortCity, setShortCity] = useState<string>('');
  const [userCoords, setUserCoords] = useState<[number, number] | null>(null);
  const [shortLocating, setShortLocating] = useState(false);
  const [selectedStop, setSelectedStop] = useState<CityStop | null>(null);

  // Pre-fill today's date & current time
  useEffect(() => {
    const now = new Date();
    setScheduleDate(now.toISOString().slice(0, 10));
    setScheduleTime(now.toTimeString().slice(0, 5));
  }, []);

  function useCurrentLocation() {
    setLocationLoading(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        const { latitude, longitude } = pos.coords;
        // Find nearest city
        let nearest = CITIES[0];
        let minDist = Infinity;
        CITIES.forEach(c => {
          const d = haversine([latitude, longitude], c.coords);
          if (d < minDist) { minDist = d; nearest = c; }
        });
        setFrom(`📍 ${nearest.name} (Current)`);
        setLocationLoading(false);
      },
      () => { setFrom('📍 Current Location'); setLocationLoading(false); },
    );
  }

  function buildEstimates(dist: number, dt: Date): CabEstimate[] {
    const fares = estimateFare(dist, cabType, dt);
    return [
      {
        provider: 'Ola',
        logo: '🟢',
        color: 'text-green-700',
        bgColor: 'bg-green-100',
        category: cabType === 'bike' ? 'Ola Bike' : cabType === 'suv' ? 'Ola Prime SUV' : cabType === 'sedan' ? 'Ola Prime Sedan' : 'Ola Mini',
        estimatedFare: fares.ola,
        eta: Math.round(5 + dist * 2.5),
        rating: 4.3,
        features: ['AC', 'GPS Tracked', 'Pre-book', ...(cabType !== 'bike' ? ['4 Seats'] : ['2 Wheeler'])],
        bookingUrl: 'https://www.olacabs.com',
      },
      {
        provider: 'Uber',
        logo: '⚫',
        color: 'text-gray-800',
        bgColor: 'bg-gray-100',
        category: cabType === 'bike' ? 'Uber Moto' : cabType === 'suv' ? 'Uber XL' : cabType === 'sedan' ? 'Uber Go Sedan' : 'Uber Go',
        estimatedFare: fares.uber,
        eta: Math.round(4 + dist * 2.2),
        rating: 4.5,
        features: ['AC', 'Live Tracking', 'Schedule Ride', ...(cabType !== 'bike' ? ['In-app Payment'] : ['Helmet Provided'])],
        bookingUrl: 'https://www.uber.com',
      },
      {
        provider: 'Rapido',
        logo: '🟡',
        color: 'text-yellow-700',
        bgColor: 'bg-yellow-100',
        category: cabType === 'bike' ? 'Rapido Bike' : cabType === 'suv' ? 'Rapido SUV' : cabType === 'sedan' ? 'Rapido Sedan' : 'Rapido Auto',
        estimatedFare: fares.rapido,
        eta: Math.round(3 + dist * 2.0),
        rating: 4.1,
        features: ['Budget Friendly', 'Fast Pickup', 'Pre-book', ...(cabType !== 'bike' ? ['Auto/Cab'] : ['Helmet Included'])],
        bookingUrl: 'https://www.rapido.bike',
      },
    ];
  }

  function handleSearch() {
    const fromCity = CITIES.find(c => from.toLowerCase().includes(c.name.toLowerCase()));
    const toCity   = CITIES.find(c => to.toLowerCase().includes(c.name.toLowerCase()));

    if (!fromCity && !from.includes('Current')) {
      setError('Please select a valid "From" city from the suggestions.'); return;
    }
    if (!toCity) {
      setError('Please select a valid "To" city from the suggestions.'); return;
    }
    setError('');
    setLoading(true);

    const fromCoords: [number, number] = fromCity ? fromCity.coords : (
      estimates.length > 0 ? [0, 0] : [28.6139, 77.2090]
    );
    const dist = haversine(fromCoords, toCity.coords);
    const dt   = new Date(`${scheduleDate}T${scheduleTime}`);

    setTimeout(() => {
      setDistance(dist);
      setEstimates(buildEstimates(dist, dt));
      setLoading(false);
    }, 900);
  }

  const cheapest = estimates.length > 0
    ? estimates.reduce((a, b) => a.estimatedFare < b.estimatedFare ? a : b)
    : null;

  const cabTypes = [
    { key: 'bike',  label: 'Bike',  icon: '🛵' },
    { key: 'mini',  label: 'Mini',  icon: '🚗' },
    { key: 'sedan', label: 'Sedan', icon: '🚙' },
    { key: 'suv',   label: 'SUV',   icon: '🚐' },
  ] as const;

  return (
    <MainLayout>
      <div className="max-w-5xl mx-auto px-4 pb-16">
        {/* ── Header ── */}
        <div className="mb-8 pt-2">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center text-xl">🚕</div>
            <div>
              <h1 className="text-2xl font-black text-gray-900">Pre-Booked Cabs</h1>
              <p className="text-sm text-gray-500">Compare prices and schedule rides across Ola, Uber & Rapido</p>
            </div>
          </div>
        </div>

        {/* ── Search Card ── */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
            <LocationInput
              label="From"
              placeholder="Enter pickup city..."
              value={from}
              onChange={setFrom}
              onCurrentLocation={useCurrentLocation}
              icon={<Navigation size={16} className={locationLoading ? 'animate-pulse' : ''} />}
            />
            <LocationInput
              label="To"
              placeholder="Enter drop-off city..."
              value={to}
              onChange={setTo}
              icon={<MapPin size={16} />}
            />
          </div>

          {/* Cab Type */}
          <div className="mb-5">
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Cab Type</label>
            <div className="grid grid-cols-4 gap-2">
              {cabTypes.map(ct => (
                <button
                  key={ct.key}
                  type="button"
                  onClick={() => setCabType(ct.key)}
                  className={`py-2.5 rounded-xl text-sm font-bold transition-all flex flex-col items-center gap-1 ${
                    cabType === ct.key
                      ? 'bg-orange-500 text-white shadow-md scale-105'
                      : 'bg-gray-50 text-gray-600 hover:bg-orange-50 hover:text-orange-600 border border-gray-200'
                  }`}
                >
                  <span className="text-xl">{ct.icon}</span>
                  {ct.label}
                </button>
              ))}
            </div>
          </div>

          {/* Date + Time + Filter */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                <Calendar size={12} className="inline mr-1" />Schedule Date
              </label>
              <input
                type="date"
                value={scheduleDate}
                min={new Date().toISOString().slice(0, 10)}
                onChange={e => setScheduleDate(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                <Clock size={12} className="inline mr-1" />Pickup Time
              </label>
              <input
                type="time"
                value={scheduleTime}
                onChange={e => setScheduleTime(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all"
              />
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 px-4 py-2 rounded-xl mb-4">
              {error}
            </p>
          )}

          <button
            onClick={handleSearch}
            disabled={loading || !from || !to}
            className="w-full py-3.5 bg-gradient-to-r from-orange-500 to-rose-500 text-white font-black rounded-xl hover:from-orange-600 hover:to-rose-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 text-base shadow-lg shadow-orange-200"
          >
            {loading ? (
              <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Comparing prices...</>
            ) : (
              <><Search size={18} /> Compare Prices</>
            )}
          </button>
        </div>

        {/* ── Results ── */}
        {estimates.length > 0 && (
          <>
            {/* Summary strip */}
            {distance && (
              <div className="flex flex-wrap gap-3 mb-6 items-center">
                <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-100 rounded-xl text-sm font-semibold text-blue-700">
                  <Car size={15} /> {distance.toFixed(1)} km
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-purple-50 border border-purple-100 rounded-xl text-sm font-semibold text-purple-700">
                  <Calendar size={15} /> {new Date(`${scheduleDate}T${scheduleTime}`).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-orange-50 border border-orange-100 rounded-xl text-sm font-semibold text-orange-700">
                  {cabTypes.find(c => c.key === cabType)?.icon} {cabTypes.find(c => c.key === cabType)?.label}
                </div>
              </div>
            )}

            {/* Recommended banner */}
            {cheapest && (
              <div className="flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-r from-green-500 to-emerald-500 text-white mb-6 shadow-lg shadow-green-200">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-xl shrink-0">
                  {cheapest.logo}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold opacity-80 uppercase tracking-wider">⭐ Recommended</p>
                  <p className="font-black text-lg">{cheapest.provider} — ₹{cheapest.estimatedFare}</p>
                  <p className="text-xs opacity-80">{cheapest.category} · {cheapest.eta} min ETA · {cheapest.rating}★</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <CheckCircle2 size={18} className="opacity-80" />
                  <span className="font-bold text-sm hidden sm:block">Cheapest Pick</span>
                </div>
              </div>
            )}

            {/* Price comparison cards */}
            <h2 className="text-base font-black text-gray-800 mb-4 flex items-center gap-2">
              <Filter size={16} className="text-orange-500" /> Price Comparison
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {estimates.map(est => (
                <CabCard
                  key={est.provider}
                  estimate={est}
                  isRecommended={cheapest?.provider === est.provider}
                />
              ))}
            </div>

            {/* Pricing note */}
            <p className="mt-6 text-xs text-gray-400 text-center">
              * Prices are estimates based on per-km rates and time of day. Actual fares may vary due to traffic, surge pricing, and platform policies. Always confirm on the app before booking.
            </p>
          </>
        )}

        {/* ── SHORT DESTINATIONS ── */}
        <div className="mt-12 mb-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center text-lg">📍</div>
            <div>
              <h2 className="text-xl font-black text-gray-900">Short Destinations</h2>
              <p className="text-sm text-gray-500">Explore stops within a city · detect your location for nearby picks</p>
            </div>
          </div>

          {/* City selector + locate me */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6">
            <div className="flex flex-col sm:flex-row gap-3 items-end">
              <div className="flex-1">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Select City</label>
                <select
                  value={shortCity}
                  onChange={e => { setShortCity(e.target.value); setSelectedStop(null); }}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 bg-white transition-all"
                >
                  <option value="">-- Pick a city --</option>
                  {Object.keys(CITY_STOPS).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShortLocating(true);
                  navigator.geolocation.getCurrentPosition(
                    pos => {
                      const { latitude, longitude } = pos.coords;
                      setUserCoords([latitude, longitude]);
                      // find nearest city in CITY_STOPS
                      let nearest = Object.keys(CITY_STOPS)[0];
                      let minD = Infinity;
                      CITIES.forEach(c => {
                        const d = haversine([latitude, longitude], c.coords);
                        if (d < minD && CITY_STOPS[c.name]) { minD = d; nearest = c.name; }
                      });
                      setShortCity(nearest);
                      setSelectedStop(null);
                      setShortLocating(false);
                    },
                    () => setShortLocating(false),
                  );
                }}
                className="flex items-center gap-2 px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl transition-all shrink-0 shadow-sm"
              >
                {shortLocating
                  ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Locating...</>
                  : <><Navigation size={15} /> Use My Location</>
                }
              </button>
            </div>
            {userCoords && shortCity && (
              <p className="mt-2 text-xs text-blue-600 font-medium">
                📍 Located near <strong>{shortCity}</strong> · showing stops sorted by distance from you
              </p>
            )}
          </div>

          {/* Stop cards */}
          {shortCity && CITY_STOPS[shortCity] && (() => {
            const stops = CITY_STOPS[shortCity].map(s => ({
              ...s,
              distKm: userCoords ? haversine(userCoords, s.coords) : haversine(
                CITIES.find(c => c.name === shortCity)?.coords ?? [0, 0], s.coords
              ),
            })).sort((a, b) => a.distKm - b.distKm);

            const typeColors: Record<string, string> = {
              Heritage: 'bg-amber-50 text-amber-700 border-amber-200',
              Nature: 'bg-green-50 text-green-700 border-green-200',
              Spiritual: 'bg-purple-50 text-purple-700 border-purple-200',
              Shopping: 'bg-pink-50 text-pink-700 border-pink-200',
              Transport: 'bg-blue-50 text-blue-700 border-blue-200',
              Culture: 'bg-orange-50 text-orange-700 border-orange-200',
              Business: 'bg-slate-50 text-slate-700 border-slate-200',
              Landmark: 'bg-indigo-50 text-indigo-700 border-indigo-200',
              Scenic: 'bg-cyan-50 text-cyan-700 border-cyan-200',
              Science: 'bg-teal-50 text-teal-700 border-teal-200',
              Government: 'bg-gray-50 text-gray-700 border-gray-200',
              Entertainment: 'bg-rose-50 text-rose-700 border-rose-200',
              Historic: 'bg-yellow-50 text-yellow-700 border-yellow-200',
            };

            return (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {stops.map(stop => {
                    const fare = estimateFare(stop.distKm, 'mini', new Date());
                    const isSelected = selectedStop?.name === stop.name;
                    return (
                      <button
                        key={stop.name}
                        type="button"
                        onClick={() => setSelectedStop(isSelected ? null : stop)}
                        className={`text-left rounded-2xl border-2 p-4 transition-all duration-200 hover:shadow-md ${
                          isSelected
                            ? 'border-blue-500 bg-blue-50 shadow-md'
                            : 'border-gray-100 bg-white hover:border-blue-200'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-2xl">{stop.emoji}</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${typeColors[stop.type] || 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                            {stop.type}
                          </span>
                        </div>
                        <p className="font-bold text-gray-900 text-sm mb-1 leading-tight">{stop.name}</p>
                        <p className="text-xs text-gray-500 mb-3">{stop.distKm.toFixed(1)} km away</p>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-500">Mini ~</span>
                          <span className="font-black text-orange-600 text-sm">₹{fare.ola}</span>
                        </div>
                        <div className="flex gap-1 mt-2 text-[10px] font-semibold">
                          <span className="bg-green-100 text-green-700 px-1.5 py-0.5 rounded-md">Ola ₹{fare.ola}</span>
                          <span className="bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded-md">Uber ₹{fare.uber}</span>
                          <span className="bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded-md">Rapido ₹{fare.rapido}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Selected stop detail */}
                {selectedStop && (() => {
                  const d = selectedStop.distKm ?? 1;
                  const f = estimateFare(d, 'mini', new Date());
                  const best = Math.min(f.ola, f.uber, f.rapido);
                  const bestProvider = f.ola === best ? { name: 'Ola', url: 'https://olacabs.com' }
                    : f.uber === best ? { name: 'Uber', url: 'https://uber.com' }
                    : { name: 'Rapido', url: 'https://rapido.bike' };
                  return (
                    <div className="mt-5 p-5 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg">
                      <div className="flex items-center justify-between flex-wrap gap-4">
                        <div>
                          <p className="text-xs font-bold opacity-70 uppercase tracking-wider mb-1">Selected Stop</p>
                          <p className="text-xl font-black">{selectedStop.emoji} {selectedStop.name}</p>
                          <p className="text-sm opacity-80">{d.toFixed(1)} km · {selectedStop.type} · {shortCity}</p>
                        </div>
                        <div className="flex gap-3 flex-wrap">
                          <div className="text-center">
                            <p className="text-xs opacity-70">Best Price</p>
                            <p className="text-2xl font-black">₹{best}</p>
                            <p className="text-xs opacity-80">via {bestProvider.name}</p>
                          </div>
                          <a
                            href={bestProvider.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="self-center px-5 py-2.5 bg-white text-blue-700 font-black rounded-xl text-sm hover:bg-blue-50 transition-all"
                          >
                            Book Now →
                          </a>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </>
            );
          })()}

          {!shortCity && (
            <div className="text-center py-12 text-gray-400">
              <div className="text-5xl mb-3">🗺️</div>
              <p className="text-sm font-medium">Select a city or use your location to see nearby stops</p>
            </div>
          )}
        </div>

        {/* ── Empty state ── */}
        {estimates.length === 0 && !loading && (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">🚕</div>
            <h3 className="text-lg font-bold text-gray-700 mb-2">Ready to compare cabs?</h3>
            <p className="text-sm text-gray-400 max-w-sm mx-auto">
              Enter your pickup and drop-off locations above to see real-time price comparisons across Ola, Uber, and Rapido — and schedule your cab in advance!
            </p>
          </div>
        )}
      </div>
    </MainLayout>
  );
};
