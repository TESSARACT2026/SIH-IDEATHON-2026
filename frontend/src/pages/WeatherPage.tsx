import React, { useState } from 'react';
import { MainLayout } from '../components/layout/MainLayout';
import { Cloud, MapPin, Calendar, Search, Loader2, Thermometer, CloudRain, Sun, CloudLightning, CloudSnow, Navigation, RefreshCw } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { knowledgeApi } from '../api/services/knowledgeApi';
import { liveApi } from '../api/services/liveApi';
import type { LiveWeatherData } from '../types/domain';

interface WeatherDay {
  date: string;
  maxTemp: number;
  minTemp: number;
  weatherCode: number;
}

interface CurrentWeatherResult {
  location: string;
  weather: LiveWeatherData;
  lat: number;
  lon: number;
}

const WEATHER_REFRESH_MS = 20 * 60 * 1000;

export const WeatherPage: React.FC = () => {
  const [destinationId, setDestinationId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState<{ location: string; forecast: WeatherDay[] } | null>(null);
  const [currentCoords, setCurrentCoords] = useState<{ lat: number; lon: number } | null>(null);

  const { data: destinations = [] } = useQuery({
    queryKey: ['destinations'],
    queryFn: knowledgeApi.getDestinations,
  });

  const { data: clientWeather, isFetching: isFetchingClientWeather, refetch: refetchClientWeather } = useQuery({
    queryKey: ['client-weather', currentCoords?.lat, currentCoords?.lon],
    queryFn: () => liveApi.getLiveWeather(currentCoords!.lat, currentCoords!.lon),
    enabled: !!currentCoords,
    staleTime: WEATHER_REFRESH_MS,
    refetchInterval: WEATHER_REFRESH_MS,
  });

  React.useEffect(() => {
    if (!destinationId && destinations.length > 0) {
      setDestinationId(destinations[0].id);
    }
  }, [destinationId, destinations]);

  // Weather codes interpretation (WMO Weather interpretation codes)
  const getWeatherInfo = (code: number) => {
    if (code === 0) return { icon: <Sun className="w-8 h-8 text-yellow-500" />, text: 'Clear sky' };
    if ([1, 2, 3].includes(code)) return { icon: <Cloud className="w-8 h-8 text-gray-400" />, text: 'Partly cloudy' };
    if ([45, 48].includes(code)) return { icon: <Cloud className="w-8 h-8 text-gray-400" />, text: 'Foggy' };
    if ([51, 53, 55, 56, 57].includes(code)) return { icon: <CloudRain className="w-8 h-8 text-blue-400" />, text: 'Drizzle' };
    if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return { icon: <CloudRain className="w-8 h-8 text-blue-500" />, text: 'Rain' };
    if ([71, 73, 75, 77, 85, 86].includes(code)) return { icon: <CloudSnow className="w-8 h-8 text-white" />, text: 'Snow' };
    if ([95, 96, 99].includes(code)) return { icon: <CloudLightning className="w-8 h-8 text-purple-500" />, text: 'Thunderstorm' };
    return { icon: <Cloud className="w-8 h-8 text-gray-400" />, text: 'Unknown' };
  };

  const getCodeFromCondition = (condition = '') => {
    const normalized = condition.toLowerCase();
    if (normalized.includes('clear')) return 0;
    if (normalized.includes('rain')) return 61;
    if (normalized.includes('snow')) return 71;
    if (normalized.includes('thunder')) return 95;
    return 2;
  };

  const getCurrentPosition = () =>
    new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 10000,
      });
    });

  const handleUseCurrentLocation = async () => {
    if (!('geolocation' in navigator)) {
      setError('Your browser does not support location access.');
      return;
    }

    setLocationLoading(true);
    setError('');

    try {
      const position = await getCurrentPosition();
      const { latitude, longitude } = position.coords;
      setCurrentCoords({ lat: latitude, lon: longitude });
    } catch (err: any) {
      setError(err.message || 'Could not fetch weather for your current location.');
    } finally {
      setLocationLoading(false);
    }
  };

  const currentWeather: CurrentWeatherResult | null = currentCoords && clientWeather ? {
    location: 'Your current location',
    weather: clientWeather,
    lat: currentCoords.lat,
    lon: currentCoords.lon,
  } : null;

  const loadForecast = async (clearResults = false) => {
    if (!destinationId || !startDate || !endDate) {
      setError('Please fill in all fields');
      return;
    }

    if (new Date(startDate) > new Date(endDate)) {
      setError('Start date must be before end date');
      return;
    }

    // Maximum 16 days forecast supported by open-meteo for free tier
    const diffTime = Math.abs(new Date(endDate).getTime() - new Date(startDate).getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays > 16) {
      setError('Cannot fetch weather for more than 16 days ahead');
      return;
    }

    setLoading(true);
    setError('');
    if (clearResults) setResults(null);

    try {
      const destination = destinations.find((item) => item.id === destinationId);
      if (!destination) throw new Error('Destination not found. Please try another location.');

      const forecast = await liveApi.getWeatherForecast(
        destination.latitude,
        destination.longitude,
        startDate,
        endDate
      );
      if (forecast.length === 0) {
        throw new Error('No forecast data is available for the selected date range.');
      }

      setResults({
        location: `${destination.name}, ${destination.region || destination.country}`,
        forecast,
      });

    } catch (err: any) {
      setError(err.message || 'Failed to fetch weather data');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    await loadForecast(true);
  };

  React.useEffect(() => {
    if (!results) return;

    const intervalId = window.setInterval(() => {
      void loadForecast();
    }, WEATHER_REFRESH_MS);

    return () => window.clearInterval(intervalId);
  }, [destinationId, startDate, endDate, results]);

  return (
    <MainLayout>
      <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-3">
            <Cloud className="text-blue-500 w-8 h-8" />
            Trip Weather Forecaster
          </h1>
          <p className="text-slate-600 dark:text-slate-400">Check weather predictions for your upcoming trip destinations.</p>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 md:p-8 shadow-sm border border-slate-200 dark:border-slate-800 mb-8">
          <form onSubmit={handleSearch} className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="md:col-span-2 relative">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Destination</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                <select
                  value={destinationId}
                  onChange={(e) => setDestinationId(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-slate-900 dark:text-white"
                >
                  {destinations.map((destination) => (
                    <option key={destination.id} value={destination.id}>
                      {destination.name}, {destination.region || destination.country}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="relative">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Start Date</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                <input
                  type="date"
                  value={startDate}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="relative">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">End Date</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                <input
                  type="date"
                  value={endDate}
                  min={startDate || new Date().toISOString().split('T')[0]}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="md:col-span-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              {error ? (
                <div className="text-red-500 text-sm font-medium">{error}</div>
              ) : <div />}

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={handleUseCurrentLocation}
                  disabled={locationLoading || isFetchingClientWeather}
                  className="px-6 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-900 dark:text-white rounded-xl font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {locationLoading || isFetchingClientWeather ? <Loader2 className="w-5 h-5 animate-spin" /> : <Navigation className="w-5 h-5" />}
                  Use My Location
                </button>

                <button
                  type="submit"
                  disabled={loading}
                  className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-all shadow-lg shadow-blue-500/30 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Fetching Forecast...
                    </>
                  ) : (
                    <>
                      <Search className="w-5 h-5" />
                      Get Weather
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>

        {currentWeather && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 mb-8 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-blue-500 mb-1">Real-time weather</p>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">{currentWeather.location}</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {currentWeather.lat.toFixed(3)}, {currentWeather.lon.toFixed(3)}
                  {currentWeather.weather.source ? ` • ${currentWeather.weather.source}` : ''}
                  {currentWeather.weather.verifiedAt ? ` • Updated ${new Date(currentWeather.weather.verifiedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-3 sm:gap-5">
                <button
                  type="button"
                  onClick={() => refetchClientWeather()}
                  disabled={isFetchingClientWeather}
                  title="Refresh weather"
                  aria-label="Refresh current location weather"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                >
                  <RefreshCw className={`h-4 w-4 ${isFetchingClientWeather ? 'animate-spin' : ''}`} />
                </button>
                <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-full">
                  {getWeatherInfo(getCodeFromCondition(currentWeather.weather.condition)).icon}
                </div>
                <div>
                  <p className="text-4xl font-black text-slate-900 dark:text-white">
                    {Math.round(currentWeather.weather.temperature_celsius ?? currentWeather.weather.temperature ?? 0)}°C
                  </p>
                  <p className="capitalize text-sm font-semibold text-slate-600 dark:text-slate-300">
                    {currentWeather.weather.condition}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Humidity {currentWeather.weather.humidity ?? '--'}% • Wind {currentWeather.weather.windSpeed ?? '--'} km/h
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {results && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="mb-6 flex items-center justify-between gap-4">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                Forecast for {results.location}
              </h2>
              <button
                type="button"
                onClick={() => loadForecast()}
                disabled={loading}
                title="Refresh forecast"
                aria-label="Refresh forecast"
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {results.forecast.map((day, i) => {
                const info = getWeatherInfo(day.weatherCode);
                const dateObj = new Date(day.date);
                const dateStr = dateObj.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
                
                return (
                  <div key={day.date} className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 flex flex-col items-center text-center shadow-sm hover:shadow-md transition-all">
                    <div className="text-slate-500 dark:text-slate-400 font-medium mb-3">{dateStr}</div>
                    <div className="mb-4 bg-slate-50 dark:bg-slate-800 p-4 rounded-full">
                      {info.icon}
                    </div>
                    <div className="font-semibold text-slate-800 dark:text-white mb-2">{info.text}</div>
                    <div className="flex items-center gap-4 text-sm mt-auto">
                      <div className="flex items-center gap-1 text-blue-500">
                        <Thermometer className="w-4 h-4" />
                        <span>{day.minTemp}°C</span>
                      </div>
                      <div className="flex items-center gap-1 text-red-500">
                        <Thermometer className="w-4 h-4" />
                        <span>{day.maxTemp}°C</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
};
