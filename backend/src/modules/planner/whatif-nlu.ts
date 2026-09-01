/**
 * What-If NLU — Maps free-text "what if" queries to structured constraint deltas.
 *
 * Routes through Gemini for intelligent extraction with a keyword-based fallback.
 * The output is a structured delta object that the replan endpoint accepts —
 * the LLM extracts structure, it does NOT decide the new schedule.
 */

import { Router } from 'express';
import { z } from 'zod';
import { env } from '../../shared/config/index.js';
import { sanitizeBody } from '../../shared/middleware/sanitize.js';

const router = Router();

type ConstraintDelta =
  | { type: 'weather_change'; payload: { condition: 'rain' | 'extreme_heat' | 'storm'; affectedDays?: number[] } }
  | { type: 'time_reduced'; payload: { newDayEnd?: string; reduceDays?: number } }
  | { type: 'crowd_increase'; payload: { strictFilter: boolean } }
  | { type: 'budget_change'; payload: { maxBudgetPerPerson: number } };

const extractDeltaSchema = z.object({
  query: z.string().min(3).max(500),
}).strict();

// ─── Keyword-based fallback ─────────────────────────────────────────────────

function keywordExtractDelta(query: string): ConstraintDelta {
  const q = query.toLowerCase();

  // Weather
  if (q.includes('rain') || q.includes('baarish') || q.includes('barish') || q.includes('monsoon')) {
    return { type: 'weather_change', payload: { condition: 'rain' } };
  }
  if (q.includes('heat') || q.includes('hot') || q.includes('garmi') || q.includes('sun')) {
    return { type: 'weather_change', payload: { condition: 'extreme_heat' } };
  }
  if (q.includes('storm') || q.includes('thunder') || q.includes('toofan')) {
    return { type: 'weather_change', payload: { condition: 'storm' } };
  }

  // Time
  if (q.includes('less time') || q.includes('shorter') || q.includes('reduce day') || q.includes('half day') || q.includes('kam samay')) {
    const dayMatch = q.match(/(\d+)\s*day/);
    return {
      type: 'time_reduced',
      payload: dayMatch ? { reduceDays: parseInt(dayMatch[1]) } : { newDayEnd: '15:00' },
    };
  }

  // Crowd
  if (q.includes('crowd') || q.includes('busy') || q.includes('bheed') || q.includes('rush') || q.includes('packed')) {
    return { type: 'crowd_increase', payload: { strictFilter: true } };
  }

  // Budget
  const budgetMatch = q.match(/(?:budget|reduce|cut|save|kam)[^₹\d]*[₹]?\s*(\d+)/i);
  if (budgetMatch || q.includes('budget') || q.includes('cheap') || q.includes('sasta')) {
    const amount = budgetMatch ? parseInt(budgetMatch[1]) : 500;
    return { type: 'budget_change', payload: { maxBudgetPerPerson: amount } };
  }

  // Default to crowd if nothing matches
  return { type: 'crowd_increase', payload: { strictFilter: true } };
}

// ─── Gemini extraction ──────────────────────────────────────────────────────

async function geminiExtractDelta(query: string): Promise<ConstraintDelta> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${env.GEMINI_MODEL}:generateContent?key=${env.GEMINI_API_KEY}`;

  const systemInstruction = `You are a travel constraint extraction engine for an Indian travel planner.
Given a "what if" query from a user, extract a structured constraint delta.
Return ONLY a valid JSON object with one of these exact shapes:

1. Weather: { "type": "weather_change", "payload": { "condition": "rain" | "extreme_heat" | "storm" } }
2. Time: { "type": "time_reduced", "payload": { "newDayEnd": "HH:MM" } } or { "type": "time_reduced", "payload": { "reduceDays": N } }
3. Crowd: { "type": "crowd_increase", "payload": { "strictFilter": true } }
4. Budget: { "type": "budget_change", "payload": { "maxBudgetPerPerson": N } }

Support Hindi, Hinglish, and English queries. Respond with ONLY the JSON, no explanation.`;

  const body = {
    system_instruction: { parts: [{ text: systemInstruction }] },
    contents: [{ role: 'user', parts: [{ text: query }] }],
    generationConfig: { temperature: 0.1, maxOutputTokens: 256, responseMimeType: 'application/json' },
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) throw new Error(`Gemini API error ${response.status}`);

  const data = await response.json() as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Empty Gemini response');

  const parsed = JSON.parse(text.replace(/```json\n?|\n?```/g, '').trim());

  // Validate the response has an expected type
  const validTypes = ['weather_change', 'time_reduced', 'crowd_increase', 'budget_change'];
  if (!validTypes.includes(parsed.type)) {
    throw new Error(`Invalid delta type: ${parsed.type}`);
  }

  return parsed as ConstraintDelta;
}

// ─── POST /nlu/extract-delta ────────────────────────────────────────────────

router.post('/extract-delta', sanitizeBody, async (req, res, next) => {
  try {
    const { query } = extractDeltaSchema.parse(req.body);
    let delta: ConstraintDelta;
    let usedFallback = false;

    try {
      delta = await geminiExtractDelta(query);
    } catch (err) {
      console.warn('[WhatIf-NLU] Gemini extraction failed, using keyword fallback:', (err as Error).message);
      delta = keywordExtractDelta(query);
      usedFallback = true;
    }

    res.json({
      data: { delta },
      ...(usedFallback && { meta: { fallback_used: true, reason: 'Gemini API unavailable' } }),
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Invalid query', details: err.flatten().fieldErrors },
      });
      return;
    }
    next(err);
  }
});

export default router;
