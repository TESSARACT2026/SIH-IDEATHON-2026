import { cache } from './cache.js';
import { AppError } from '../../shared/middleware/errorHandler.js';

const WEATHER_CACHE_TTL = 20 * 60; // 20 minutes

export interface WeatherData {
  temperature_celsius: number;
  condition: string; // Simplified for MVP (clear, rain, clouds, etc)
  is_day: boolean;
  humidity?: number;
  windSpeed?: number;
  source?: string;
  verifiedAt?: string;
}

export interface WeatherForecastDay {
  date: string;
  maxTemp: number;
  minTemp: number;
  weatherCode: number;
  condition: string;
}

export async function getLiveWeather(lat: number, lon: number): Promise<WeatherData> {
  const cacheKey = `weather:${lat.toFixed(2)}:${lon.toFixed(2)}`;
  
  const cached = cache.get<WeatherData>(cacheKey);
  if (cached) return cached;

  try {
    // Open-Meteo free API (no key required)
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,is_day,weather_code,relative_humidity_2m,wind_speed_10m`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Open-Meteo returned ${response.status}`);
    }

    const data = (await response.json()) as {
      current: {
        temperature_2m: number;
        is_day: number;
        weather_code: number;
        relative_humidity_2m?: number;
        wind_speed_10m?: number;
        time?: string;
      };
    };
    
    const weatherData: WeatherData = {
      temperature_celsius: data.current.temperature_2m,
      is_day: data.current.is_day === 1,
      condition: mapWeatherCode(data.current.weather_code),
      humidity: data.current.relative_humidity_2m,
      windSpeed: data.current.wind_speed_10m,
      source: 'Open-Meteo',
      verifiedAt: data.current.time || new Date().toISOString(),
    };

    cache.set(cacheKey, weatherData, WEATHER_CACHE_TTL);
    return weatherData;
  } catch (error) {
    console.error('Weather API failed:', error);
    throw new AppError('Live weather data unavailable', 503, 'LIVE_DATA_UNAVAILABLE');
  }
}

export async function getWeatherForecast(
  lat: number,
  lon: number,
  startDate: string,
  endDate: string
): Promise<WeatherForecastDay[]> {
  const cacheKey = `weather-forecast:${lat.toFixed(2)}:${lon.toFixed(2)}:${startDate}:${endDate}`;

  const cached = cache.get<WeatherForecastDay[]>(cacheKey);
  if (cached) return cached;

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,weather_code&timezone=auto`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Open-Meteo returned ${response.status}`);
    }

    const data = (await response.json()) as {
      daily?: {
        time?: string[];
        temperature_2m_max?: number[];
        temperature_2m_min?: number[];
        weather_code?: number[];
      };
    };

    const daily = data.daily;
    if (!daily?.time) return [];

    const forecast = daily.time
      .map((date, index) => ({
        date,
        maxTemp: Math.round(daily.temperature_2m_max?.[index] ?? 0),
        minTemp: Math.round(daily.temperature_2m_min?.[index] ?? 0),
        weatherCode: daily.weather_code?.[index] ?? 0,
        condition: mapWeatherCode(daily.weather_code?.[index] ?? 0),
      }))
      .filter((day) => day.date >= startDate && day.date <= endDate);

    cache.set(cacheKey, forecast, WEATHER_CACHE_TTL);
    return forecast;
  } catch (error) {
    console.error('Weather forecast API failed:', error);
    throw new AppError('Weather forecast data unavailable', 503, 'LIVE_DATA_UNAVAILABLE');
  }
}

/**
 * Feature 5: Weather-Aware Warnings
 * Fetches the daily forecast for a location to check for extreme conditions (Temp > 40C or heavy rain)
 */
export async function getWeatherWarnings(lat: number, lon: number, startDate: Date, endDate: Date): Promise<string[]> {
  const cacheKey = `weather-warnings:${lat.toFixed(2)}:${lon.toFixed(2)}:${startDate.toISOString().split('T')[0]}:${endDate.toISOString().split('T')[0]}`;
  
  const cached = cache.get<string[]>(cacheKey);
  if (cached) return cached;

  const warnings: string[] = [];
  try {
    // Get daily maximum temperatures and precipitation sum for up to 16 days ahead
    // Open-Meteo free tier supports 16 days daily forecast
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,precipitation_sum,weather_code&timezone=auto`;
    const response = await fetch(url);
    if (!response.ok) return warnings;

    const data = (await response.json()) as {
      daily?: {
        time?: string[];
        temperature_2m_max?: number[];
        precipitation_sum?: number[];
        weather_code?: number[];
      };
    };
    const daily = data.daily;
    if (!daily || !daily.time) return warnings;

    let hasExtremeHeat = false;
    let hasHeavyRain = false;

    for (let i = 0; i < daily.time.length; i++) {
      const forecastDate = new Date(daily.time[i]);
      // If the forecast date is within our trip window
      if (forecastDate >= startDate && forecastDate <= endDate) {
        if ((daily.temperature_2m_max?.[i] ?? 0) > 40) {
          hasExtremeHeat = true;
        }
        if ((daily.precipitation_sum?.[i] ?? 0) > 20 || [63, 65, 67, 81, 82, 95, 96, 99].includes(daily.weather_code?.[i] ?? 0)) {
          hasHeavyRain = true;
        }
      }
    }

    if (hasExtremeHeat) {
      warnings.push("Extreme Heat Advisory: Temperatures are forecasted to exceed 40°C. Plan outdoor activities early morning or evening and stay hydrated.");
    }
    if (hasHeavyRain) {
      warnings.push("Heavy Rain Advisory: Heavy rainfall is forecasted during your trip. Ensure indoor backups for outdoor activities.");
    }

    cache.set(cacheKey, warnings, 3600 * 12); // Cache for 12 hours
    return warnings;
  } catch (error) {
    console.error('Weather forecast API failed:', error);
    return warnings; // fail silently so planner doesn't break
  }
}

// Simple mapping from WMO Weather codes to readable conditions
function mapWeatherCode(code: number): string {
  if (code === 0) return 'clear';
  if (code >= 1 && code <= 3) return 'cloudy';
  if (code >= 51 && code <= 67) return 'rain';
  if (code >= 71 && code <= 77) return 'snow';
  if (code >= 95 && code <= 99) return 'thunderstorm';
  return 'unknown';
}
