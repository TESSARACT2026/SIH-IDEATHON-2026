import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  CloudSun,
  CloudRain,
  Sun,
  Cloud,
  Zap,
  Wind,
  Droplets,
  AlertTriangle,
  Radio,
  RefreshCw,
} from 'lucide-react';
import { liveApi } from '../../api/services/liveApi';

interface WeatherWidgetProps {
  lat?: number;
  lon?: number;
  cityName?: string;
  className?: string;
}

const WEATHER_REFRESH_MS = 20 * 60 * 1000;

export const WeatherWidget: React.FC<WeatherWidgetProps> = ({
  lat = 20.2961, // Default Bhubaneswar
  lon = 85.8245,
  cityName = 'Bhubaneswar, Odisha',
  className = '',
}) => {
  const { data: weather, isLoading, isFetching, isError, refetch } = useQuery({
    queryKey: ['weather', lat, lon],
    queryFn: () => liveApi.getLiveWeather(lat, lon),
    staleTime: WEATHER_REFRESH_MS,
    refetchInterval: WEATHER_REFRESH_MS,
  });

  const hasLiveWeather = !!weather && !isError;
  const temp = hasLiveWeather ? weather.temperature_celsius ?? weather.temperature : undefined;
  const condition = hasLiveWeather ? weather.condition || 'clear' : 'unavailable';

  const getWeatherIcon = (cond: string) => {
    switch (cond.toLowerCase()) {
      case 'clear':
        return <Sun className="h-6 w-6 text-amber-500 animate-spin-slow" />;
      case 'rain':
        return <CloudRain className="h-6 w-6 text-blue-500" />;
      case 'thunderstorm':
        return <Zap className="h-6 w-6 text-indigo-500" />;
      case 'cloudy':
        return <Cloud className="h-6 w-6 text-slate-400" />;
      default:
        return <CloudSun className="h-6 w-6 text-orange-500" />;
    }
  };

  return (
    <div
      className={`relative flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 pr-14 bg-gradient-to-r from-sky-50/90 via-white to-orange-50/50 rounded-2xl border border-sky-200/80 shadow-xs gap-3 ${className}`}
    >
      <button
        type="button"
        onClick={() => refetch()}
        disabled={isFetching}
        title="Refresh weather"
        aria-label={`Refresh weather for ${cityName}`}
        className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-lg border border-sky-200 bg-white text-slate-600 shadow-2xs transition hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
      </button>
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-xs border border-sky-100 shrink-0">
          {getWeatherIcon(condition)}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-slate-900">{cityName}</span>
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold border ${hasLiveWeather ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>
              <Radio className={`h-2.5 w-2.5 ${hasLiveWeather ? 'text-emerald-600 animate-pulse' : 'text-slate-400'}`} />
              {hasLiveWeather ? 'Live Ground Weather' : 'Weather Unavailable'}
            </span>
          </div>
          <p className="text-xs text-slate-500 font-medium capitalize mt-0.5">
            {isLoading ? 'Checking ground weather...' : hasLiveWeather ? `${condition} skies • Updated real-time` : 'Live weather could not be loaded'}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4 text-xs text-slate-700 bg-white/80 px-3.5 py-2 rounded-xl border border-slate-100 shadow-2xs">
        <div className="text-left sm:text-right">
          <span className="text-2xl font-black text-slate-900">
            {temp !== undefined ? `${Math.round(temp)}°C` : '--'}
          </span>
        </div>
        <div className="h-8 w-px bg-slate-200" />
        <div className="space-y-0.5 text-[11px]">
          <div className="flex items-center gap-1.5 text-slate-600">
            <Droplets className="h-3.5 w-3.5 text-sky-500" />
            <span>Humidity: <strong>{hasLiveWeather && weather.humidity !== undefined ? `${weather.humidity}%` : '--'}</strong></span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-600">
            <Wind className="h-3.5 w-3.5 text-slate-400" />
            <span>Wind: <strong>{hasLiveWeather && weather.windSpeed !== undefined ? `${weather.windSpeed} km/h` : '--'}</strong></span>
          </div>
        </div>
      </div>

      {weather?.alert && (
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-100/90 border border-amber-300 text-xs font-semibold text-amber-900 rounded-xl">
          <AlertTriangle className="h-4 w-4 text-amber-700 shrink-0" />
          <span>{weather.alert}</span>
        </div>
      )}
    </div>
  );
};
