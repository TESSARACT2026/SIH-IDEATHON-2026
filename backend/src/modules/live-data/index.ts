import { Router } from 'express';
import { getLiveWeather, getWeatherForecast } from './weather.js';
import { getRoute } from './routing.js';
import { z } from 'zod';
import { validate } from '../../shared/middleware/validate.js';

const router = Router();

const coordSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
}).strict();

const forecastSchema = coordSchema.extend({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
}).refine((value) => value.startDate <= value.endDate, {
  message: 'startDate must be before or equal to endDate',
  path: ['endDate'],
});

const routeSchema = z.object({
  startLat: z.coerce.number().min(-90).max(90),
  startLon: z.coerce.number().min(-180).max(180),
  endLat: z.coerce.number().min(-90).max(90),
  endLon: z.coerce.number().min(-180).max(180),
  profile: z.enum(['driving-car', 'foot-walking']).default('driving-car'),
}).strict();

router.get('/weather', async (req, res, next) => {
  try {
    const { lat, lon } = coordSchema.parse(req.query);
    const data = await getLiveWeather(lat, lon);
    res.json({ data });
  } catch (err) {
    next(err);
  }
});

router.get('/forecast', async (req, res, next) => {
  try {
    const { lat, lon, startDate, endDate } = forecastSchema.parse(req.query);
    const data = await getWeatherForecast(lat, lon, startDate, endDate);
    res.json({ data });
  } catch (err) {
    next(err);
  }
});

router.get('/route', async (req, res, next) => {
  try {
    const { startLat, startLon, endLat, endLon, profile } = routeSchema.parse(req.query);
    const data = await getRoute(startLat, startLon, endLat, endLon, profile);
    res.json({ data });
  } catch (err) {
    next(err);
  }
});

export default router;
