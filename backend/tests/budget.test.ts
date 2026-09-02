import { describe, expect, it } from 'vitest';
import {
  ticketTotalPerTravellerFromSnapshot,
  transparentBudgetBreakdown,
} from '../src/modules/budget/index.js';

describe('transparent budget helpers', () => {
  it('sums only verified/live ticket prices from a trip snapshot', () => {
    expect(ticketTotalPerTravellerFromSnapshot({
      itineraryItems: [
        {
          trustSummary: {
            facts: [
              {
                fact_key: 'ticket_price',
                fact_value: { amount: 250, currency: 'INR' },
                verification_status: 'VERIFIED',
              },
            ],
          },
        },
        {
          trustSummary: {
            facts: [
              {
                fact_key: 'ticket_price',
                fact_value: { amount: 999, currency: 'INR' },
                verification_status: 'COMMUNITY',
              },
            ],
          },
        },
      ],
    } as any)).toBe(250);
  });

  it('breaks a saved trip budget into visible travel categories', () => {
    const budget = transparentBudgetBreakdown({
      days: 2,
      travellers: 2,
      travellerType: 'INDIAN',
      ticketTotalPerTraveller: 300,
      stopCount: 3,
      budgetBand: 'MODERATE',
      transportPreference: 'CAB',
    });

    expect(budget.breakdown.map((item) => item.category)).toEqual([
      'TRANSPORTATION',
      'ENTRY_TICKETS',
      'FOOD',
      'LOCAL_EXPERIENCES',
      'BUFFER',
    ]);
    expect(budget.breakdown.find((item) => item.category === 'ENTRY_TICKETS')?.amount).toBe(600);
    expect(budget.totalAmount).toBeGreaterThan(600);
  });

  it('includes accommodation only from selected hotel snapshot pricing', () => {
    const budget = transparentBudgetBreakdown({
      days: 2,
      travellers: 2,
      travellerType: 'INDIAN',
      ticketTotalPerTraveller: 300,
      stopCount: 3,
      budgetBand: 'MODERATE',
      transportPreference: 'CAB',
      accommodationAmount: 3600,
      hasSelectedHotel: true,
    });

    expect(budget.breakdown.find((item) => item.category === 'ACCOMMODATION')).toMatchObject({
      amount: 3600,
      confidence: 'LIVE_OR_SAVED_PROVIDER',
    });
  });
});
