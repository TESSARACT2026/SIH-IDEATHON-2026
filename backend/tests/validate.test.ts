import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { validate } from '../src/shared/middleware/validate.js';

describe('validate middleware', () => {
  it('persists coerced query values even when req.query is getter-only', () => {
    const req: any = {};
    Object.defineProperty(req, 'query', {
      configurable: true,
      get: () => ({ lat: '20.2961', limit: '3' }),
    });
    const res: any = {};
    const next = () => {};

    validate(z.object({
      lat: z.coerce.number(),
      limit: z.coerce.number().int().default(20),
    }), 'query')(req, res, next);

    expect(req.query).toEqual({ lat: 20.2961, limit: 3 });
  });
});
