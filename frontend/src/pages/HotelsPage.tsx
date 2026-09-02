import React, { useState, useEffect } from 'react';
import { MainLayout } from '../components/layout/MainLayout';
import {
  MapPin, Calendar, Users, Star, Bed, Coffee, Wifi, Search,
  Filter, TrendingDown, CheckCircle2, ArrowRight, Building2, Map
} from 'lucide-react';

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────
interface Hotel {
  id: string;
  name: string;
  stars: number;
  image: string;
  rating: number;
  reviews: number;
  amenities: string[];
  basePrice: number;
}

interface PlatformEstimate {
  provider: 'MakeMyTrip' | 'Goibibo' | 'Booking.com' | 'Agoda';
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
const HOTEL_IMAGES = [
  'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=600&h=400&fit=crop',
  'https://images.unsplash.com/photo-1551882547-ff40c0d509af?w=600&h=400&fit=crop',
  'https://images.unsplash.com/photo-1542314831-c6a4d27ce66f?w=600&h=400&fit=crop',
  'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=600&h=400&fit=crop',
  'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=600&h=400&fit=crop',
  'https://images.unsplash.com/photo-1496417263034-38ec4f0b665a?w=600&h=400&fit=crop'
];

function generateHotelsForCity(city: string): Hotel[] {
  const seeds = [
    { name: 'Taj', stars: 5, base: 12000, amenities: ['Pool', 'Spa', 'Gym', 'Bar'] },
    { name: 'Marriott', stars: 5, base: 9500, amenities: ['Pool', 'Gym', 'Breakfast', 'Wifi'] },
    { name: 'Radisson', stars: 4, base: 6500, amenities: ['Gym', 'Breakfast', 'Wifi', 'Restaurant'] },
    { name: 'Lemon Tree', stars: 4, base: 4500, amenities: ['Breakfast', 'Wifi', 'AC', 'TV'] },
    { name: 'Ibis', stars: 3, base: 3200, amenities: ['Wifi', 'AC', 'Restaurant'] },
    { name: 'Ginger', stars: 3, base: 2500, amenities: ['Wifi', 'AC', 'TV'] },
    { name: 'Royal Residency', stars: 3, base: 1800, amenities: ['Wifi', 'AC', 'Room Service'] },
    { name: 'Boutique Stay', stars: 4, base: 5500, amenities: ['Pool', 'Wifi', 'AC', 'Breakfast'] }
  ];

  return seeds.map((seed, i) => ({
    id: `${city.toLowerCase()}-${i}`,
    name: `${seed.name} ${city}`,
    stars: seed.stars,
    image: HOTEL_IMAGES[i % HOTEL_IMAGES.length],
    rating: Number((3.8 + Math.random() * 1.0).toFixed(1)), // 3.8 to 4.8
    reviews: Math.floor(Math.random() * 1500) + 100,
    amenities: seed.amenities,
    basePrice: seed.base + Math.floor(Math.random() * 1000) - 500, // +/- 500
  })).sort((a, b) => b.stars - a.stars);
}

function getPlatformEstimates(basePrice: number): PlatformEstimate[] {
  // Slight variations in price across platforms
  const mmtPrice = basePrice + Math.floor(Math.random() * 400) - 100;
  const goibiboPrice = basePrice + Math.floor(Math.random() * 300) - 150;
  const bookingPrice = basePrice + Math.floor(Math.random() * 500) - 50;
  const agodaPrice = basePrice + Math.floor(Math.random() * 350) - 200;

  return [
    {
      provider: 'MakeMyTrip',
      logo: '🔴',
      color: 'text-red-700',
      bgColor: 'bg-red-50',
      estimatedPrice: mmtPrice,
      cashback: '₹200 Wallet Cash',
      features: ['Free Cancellation', 'Pay at Hotel', 'Breakfast Included'],
      bookingUrl: 'https://www.makemytrip.com/hotels/',
    },
    {
      provider: 'Goibibo',
      logo: '🟠',
      color: 'text-orange-700',
      bgColor: 'bg-orange-50',
      estimatedPrice: goibiboPrice,
      cashback: '10% goCash+',
      features: ['Free Cancellation', 'Couple Friendly', 'Breakfast Included'],
      bookingUrl: 'https://www.goibibo.com/hotels/',
    },
    {
      provider: 'Booking.com',
      logo: '🔵',
      color: 'text-blue-800',
      bgColor: 'bg-blue-50',
      estimatedPrice: bookingPrice,
      cashback: 'Genius Discount',
      features: ['No Prepayment', 'Pay at Hotel', 'Genius Level 2'],
      bookingUrl: 'https://www.booking.com/',
    },
    {
      provider: 'Agoda',
      logo: '🟣',
      color: 'text-purple-700',
      bgColor: 'bg-purple-50',
      estimatedPrice: agodaPrice,
      cashback: 'AgodaVIP 5%',
      features: ['Best Price Guarantee', 'Breakfast Included', 'Pay Now & Save'],
      bookingUrl: 'https://www.agoda.com/',
    },
  ];
}

const CITIES = [
  'New Delhi', 'Mumbai', 'Bengaluru', 'Hyderabad', 'Chennai', 'Kolkata', 'Jaipur',
  'Pune', 'Ahmedabad', 'Surat', 'Agra', 'Varanasi', 'Amritsar', 'Bhubaneswar',
  'Guwahati', 'Chandigarh', 'Kochi', 'Goa', 'Srinagar', 'Leh'
];

// ──────────────────────────────────────────────
// Sub-components
// ──────────────────────────────────────────────
function PriceCard({ estimate, isRecommended }: { estimate: PlatformEstimate; isRecommended: boolean }) {
  return (
    <div className={`relative rounded-2xl border-2 p-5 transition-all duration-300 hover:shadow-lg ${
      isRecommended
        ? 'border-green-400 bg-gradient-to-br from-green-50 to-emerald-50 shadow-md'
        : 'border-gray-100 bg-white hover:border-blue-200'
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
          <div className={`w-12 h-12 rounded-xl ${estimate.bgColor} flex items-center justify-center text-2xl font-black ${estimate.color} shadow-sm border border-white/50`}>
            {estimate.logo}
          </div>
          <div>
            <p className="font-black text-gray-900 text-base">{estimate.provider}</p>
            <p className="text-xs font-bold text-green-600">{estimate.cashback}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-black text-gray-900">₹{estimate.estimatedPrice}</p>
          <p className="text-xs text-gray-400">per night / incl. taxes</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-5">
        {estimate.features.map(f => (
          <span key={f} className="px-2 py-1 bg-gray-100 text-gray-700 rounded-lg text-[11px] font-semibold border border-gray-200">
            {f === 'Free Cancellation' ? <CheckCircle2 size={10} className="inline mr-1 text-green-500" /> : null}
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
export const HotelsPage: React.FC = () => {
  const [location, setLocation] = useState('');
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [guests, setGuests] = useState('2 Guests, 1 Room');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [selectedHotel, setSelectedHotel] = useState<Hotel | null>(null);
  
  // Autocomplete state
  const [openSuggest, setOpenSuggest] = useState(false);
  const filteredCities = CITIES.filter(c =>
    location.length > 0 && c.toLowerCase().includes(location.toLowerCase())
  );

  // Pre-fill dates
  useEffect(() => {
    const today = new Date();
    const tmrw = new Date();
    tmrw.setDate(today.getDate() + 1);
    
    setCheckIn(today.toISOString().slice(0, 10));
    setCheckOut(tmrw.toISOString().slice(0, 10));
  }, []);

  function handleSearch() {
    const cityMatch = CITIES.find(c => location.toLowerCase().includes(c.toLowerCase()));
    if (!cityMatch) {
      setError('Please select a valid city from the suggestions (e.g. Goa, Mumbai, Delhi).');
      return;
    }
    setError('');
    setLoading(true);
    setSelectedHotel(null);
    setHotels([]);

    // Simulate API call
    setTimeout(() => {
      setHotels(generateHotelsForCity(cityMatch));
      setLoading(false);
    }, 1200);
  }

  return (
    <MainLayout>
      <div className="max-w-6xl mx-auto px-4 pb-20">
        {/* ── Header ── */}
        <div className="mb-8 pt-2">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-xl text-blue-600">
              <Building2 size={22} className="fill-current" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-gray-900">Compare Hotels</h1>
              <p className="text-sm text-gray-500">Find the best prices across MakeMyTrip, Goibibo, Booking.com & more</p>
            </div>
          </div>
        </div>

        {/* ── Search Bar ── */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-md p-3 mb-10 flex flex-col lg:flex-row gap-2">
          
          {/* Location */}
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
              <MapPin size={18} className="text-gray-400" />
            </div>
            <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-xs font-bold text-gray-400 uppercase">
              Location
            </div>
            <input
              type="text"
              value={location}
              onChange={e => { setLocation(e.target.value); setOpenSuggest(true); }}
              onBlur={() => setTimeout(() => setOpenSuggest(false), 200)}
              onFocus={() => setOpenSuggest(true)}
              placeholder="e.g. Goa, Mumbai, Jaipur"
              className="w-full pl-12 pr-20 py-4 bg-gray-50 border border-transparent rounded-2xl focus:bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-100 text-gray-900 font-bold transition-all placeholder:font-normal"
            />
            {openSuggest && filteredCities.length > 0 && (
              <ul className="absolute z-50 mt-2 w-full bg-white border border-gray-100 rounded-2xl shadow-xl max-h-60 overflow-auto py-2">
                {filteredCities.map(c => (
                  <li
                    key={c}
                    onMouseDown={() => { setLocation(c); setOpenSuggest(false); }}
                    className="px-5 py-3 hover:bg-blue-50 cursor-pointer flex items-center gap-3 text-gray-700 font-medium transition-colors"
                  >
                    <Map size={16} className="text-blue-500 opacity-50" />
                    {c}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-2 flex-1">
            {/* Check In */}
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                <Calendar size={18} className="text-gray-400" />
              </div>
              <input
                type="date"
                value={checkIn}
                min={new Date().toISOString().slice(0, 10)}
                onChange={e => setCheckIn(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-transparent rounded-2xl focus:bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-100 text-gray-900 font-bold transition-all text-sm"
              />
            </div>
            {/* Check Out */}
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                <Calendar size={18} className="text-gray-400" />
              </div>
              <input
                type="date"
                value={checkOut}
                min={checkIn || new Date().toISOString().slice(0, 10)}
                onChange={e => setCheckOut(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-transparent rounded-2xl focus:bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-100 text-gray-900 font-bold transition-all text-sm"
              />
            </div>
          </div>

          {/* Guests */}
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
              <Users size={18} className="text-gray-400" />
            </div>
            <select
              value={guests}
              onChange={e => setGuests(e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-transparent rounded-2xl focus:bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-100 text-gray-900 font-bold transition-all text-sm appearance-none"
            >
              <option>1 Guest, 1 Room</option>
              <option>2 Guests, 1 Room</option>
              <option>3 Guests, 1 Room</option>
              <option>4 Guests, 2 Rooms</option>
            </select>
          </div>

          <button
            onClick={handleSearch}
            disabled={loading || !location}
            className="py-4 px-8 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-2xl transition-all shadow-lg shadow-blue-200 disabled:opacity-50 disabled:shadow-none whitespace-nowrap flex items-center justify-center gap-2"
          >
            {loading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Search size={18} />}
            {loading ? 'Searching...' : 'Search Hotels'}
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-2xl border border-red-100 flex items-center gap-2 text-sm font-bold">
            <TrendingDown size={16} /> {error}
          </div>
        )}

        {/* ── Hotel List ── */}
        {!selectedHotel && hotels.length > 0 && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-black text-gray-900">Top stays in {location}</h2>
              <div className="flex gap-2">
                <button className="flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-700 hover:bg-gray-50">
                  <Filter size={14} /> Filter
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {hotels.map(hotel => (
                <div
                  key={hotel.id}
                  onClick={() => setSelectedHotel(hotel)}
                  className="group bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 cursor-pointer flex flex-col hover:-translate-y-1"
                >
                  <div className="relative h-48 overflow-hidden">
                    <img src={hotel.image} alt={hotel.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                    <div className="absolute top-3 left-3 flex gap-1">
                      {Array.from({ length: hotel.stars }).map((_, i) => (
                        <Star key={i} size={14} className="text-yellow-400 fill-yellow-400 drop-shadow-sm" />
                      ))}
                    </div>
                  </div>
                  <div className="p-5 flex flex-col flex-1">
                    <h3 className="font-black text-lg text-gray-900 mb-1 leading-tight group-hover:text-blue-600 transition-colors">{hotel.name}</h3>
                    <div className="flex items-center gap-1.5 mb-3 text-sm">
                      <span className="bg-blue-600 text-white px-1.5 py-0.5 rounded font-black text-[11px]">{hotel.rating}</span>
                      <span className="text-gray-500 font-medium text-xs">({hotel.reviews} reviews)</span>
                    </div>
                    
                    <div className="flex flex-wrap gap-2 mb-4">
                      {hotel.amenities.slice(0, 3).map(am => (
                        <span key={am} className="text-[10px] font-bold text-gray-500 bg-gray-50 px-2 py-1 rounded-md border border-gray-100">
                          {am === 'Wifi' ? <Wifi size={10} className="inline mr-1" /> : null}
                          {am === 'Breakfast' ? <Coffee size={10} className="inline mr-1" /> : null}
                          {am === 'Room Service' ? <Bed size={10} className="inline mr-1" /> : null}
                          {am}
                        </span>
                      ))}
                    </div>

                    <div className="mt-auto pt-4 border-t border-gray-100 flex items-end justify-between">
                      <div>
                        <p className="text-xs text-gray-400 font-medium mb-0.5">Starts from</p>
                        <p className="text-xl font-black text-gray-900 leading-none">₹{hotel.basePrice}</p>
                      </div>
                      <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors">
                        <ArrowRight size={14} />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Price Comparison (Selected Hotel) ── */}
        {selectedHotel && (() => {
          const estimates = getPlatformEstimates(selectedHotel.basePrice);
          const cheapest = estimates.reduce((a, b) => a.estimatedPrice < b.estimatedPrice ? a : b);
          
          return (
            <div className="animate-in fade-in zoom-in-95 duration-400">
              <button
                onClick={() => setSelectedHotel(null)}
                className="mb-6 flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-blue-600 transition-colors"
              >
                ← Back to all hotels in {location}
              </button>

              <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 mb-8">
                <div className="flex flex-col md:flex-row gap-6 mb-8 items-start">
                  <img src={selectedHotel.image} alt={selectedHotel.name} className="w-full md:w-64 h-48 object-cover rounded-2xl shadow-sm" />
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-1 mb-2">
                      {Array.from({ length: selectedHotel.stars }).map((_, i) => (
                        <Star key={i} size={16} className="text-yellow-400 fill-yellow-400" />
                      ))}
                    </div>
                    <h2 className="text-3xl font-black text-gray-900 mb-2">{selectedHotel.name}</h2>
                    <div className="flex items-center gap-2 mb-4">
                      <span className="bg-blue-600 text-white px-2 py-1 rounded text-xs font-black">{selectedHotel.rating} / 5</span>
                      <span className="text-sm font-bold text-gray-600">{selectedHotel.reviews} Verified Reviews</span>
                      <span className="text-gray-300">•</span>
                      <span className="text-sm font-bold text-gray-600 flex items-center gap-1">
                        <MapPin size={14} /> {location}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {selectedHotel.amenities.map(am => (
                        <span key={am} className="px-3 py-1.5 bg-gray-50 text-gray-700 rounded-lg text-xs font-bold border border-gray-200">
                          {am}
                        </span>
                      ))}
                    </div>
                  </div>
                  
                  <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 min-w-[200px] text-center shrink-0">
                    <p className="text-xs font-bold text-gray-500 mb-1 uppercase tracking-wider">Your Stay</p>
                    <p className="text-sm font-black text-gray-900">{checkIn} to {checkOut}</p>
                    <p className="text-xs text-gray-600 mt-1">{guests}</p>
                  </div>
                </div>

                <div className="border-t border-gray-100 pt-8">
                  <h3 className="text-xl font-black text-gray-900 mb-6 flex items-center gap-2">
                    <TrendingDown size={22} className="text-green-500" /> Compare Prices & Book
                  </h3>

                  {/* Recommended Banner */}
                  <div className="flex flex-col sm:flex-row items-center gap-4 p-5 rounded-2xl bg-gradient-to-r from-green-500 to-emerald-500 text-white mb-8 shadow-md shadow-green-100">
                    <div className="w-14 h-14 rounded-xl bg-white/20 flex items-center justify-center text-3xl shrink-0 border border-white/30">
                      {cheapest.logo}
                    </div>
                    <div className="flex-1 text-center sm:text-left">
                      <p className="text-xs font-bold opacity-90 uppercase tracking-widest mb-1 flex items-center justify-center sm:justify-start gap-1">
                        <Star size={12} className="fill-current" /> Top Recommendation
                      </p>
                      <p className="text-2xl font-black mb-1">{cheapest.provider} — ₹{cheapest.estimatedPrice}</p>
                      <p className="text-sm font-medium opacity-90">Includes {cheapest.cashback}</p>
                    </div>
                    <div className="flex flex-col items-center gap-2 shrink-0 w-full sm:w-auto">
                      <span className="bg-white/20 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                        <CheckCircle2 size={12} /> Cheapest Pick
                      </span>
                    </div>
                  </div>

                  {/* Grid of platforms */}
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
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
        {hotels.length === 0 && !selectedHotel && !loading && (
          <div className="text-center py-20">
            <div className="w-24 h-24 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <Building2 size={40} className="text-blue-400" />
            </div>
            <h3 className="text-xl font-black text-gray-900 mb-2">Find the perfect stay</h3>
            <p className="text-sm text-gray-500 max-w-sm mx-auto leading-relaxed">
              Search across thousands of hotels in India and instantly compare prices from all major booking platforms to get the best deal.
            </p>
          </div>
        )}
      </div>
    </MainLayout>
  );
};
