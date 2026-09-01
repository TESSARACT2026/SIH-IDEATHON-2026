import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { IndianRupee, Car, Ticket, ShieldCheck } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import { ItineraryItem, TransportPreference } from '../../types/domain';
import { budgetApi } from '../../api/services/budgetApi';

interface BudgetSummaryWidgetProps {
  items: ItineraryItem[];
  transportMode: TransportPreference;
}

export const BudgetSummaryWidget: React.FC<BudgetSummaryWidgetProps> = ({ items, transportMode }) => {
  const attractionIds = items.map((item) => item.entityId);
  const { data: budget } = useQuery({
    queryKey: ['budget-estimate', attractionIds],
    queryFn: () => budgetApi.estimate(attractionIds),
    enabled: attractionIds.length > 0,
    retry: false,
  });

  if (items.length === 0) return null;

  // Calculate estimated ticket fees based on facts
  let totalTicketEst = 0;
  let recordedTicketsCount = 0;

  items.forEach((item) => {
    const priceFact = item.trustSummary.facts.find((f) => f.fact_key === 'ticket_price');
    if (priceFact && typeof priceFact.fact_value === 'object' && priceFact.fact_value !== null) {
      const val = priceFact.fact_value as any;
      if (typeof val.inr === 'number') {
        totalTicketEst += val.inr;
        recordedTicketsCount++;
      } else if (typeof val.adult === 'number') {
        totalTicketEst += val.adult;
        recordedTicketsCount++;
      }
    } else {
      // Default estimate for heritage monument if not recorded
      totalTicketEst += 25;
    }
  });

  const transitPerStop =
    transportMode === 'WALKING'
      ? 0
      : transportMode === 'PUBLIC_TRANSIT'
      ? 20
      : transportMode === 'CAB'
      ? 150
      : 80;

  const totalTransitEst = items.length * transitPerStop;
  const backendTicketTotal = budget?.totalAmount;
  const grandTotal = (backendTicketTotal ?? totalTicketEst) + totalTransitEst;

  return (
    <Card className="border-slate-200">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2 text-slate-800">
          <IndianRupee className="h-4 w-4 text-emerald-600" />
          <CardTitle className="text-sm font-bold">Estimated Cost & Fare Breakdown</CardTitle>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
            <div className="flex items-center gap-1.5 text-slate-600">
              <Ticket className="h-3.5 w-3.5 text-orange-600" />
              <span>Attraction Tickets</span>
            </div>
            <p className="text-sm font-bold text-slate-900">₹{backendTicketTotal ?? totalTicketEst}</p>
            <span className="text-[10px] text-slate-400">
              {budget ? `${budget.includedCount} backend priced rates` : recordedTicketsCount > 0 ? `${recordedTicketsCount} recorded rates` : 'Estimated entries'}
            </span>
          </div>

          <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
            <div className="flex items-center gap-1.5 text-slate-600">
              <Car className="h-3.5 w-3.5 text-blue-600" />
              <span>Transit ({transportMode.replace('_', ' ')})</span>
            </div>
            <p className="text-sm font-bold text-slate-900">₹{totalTransitEst}</p>
            <span className="text-[10px] text-slate-400">{items.length} transit legs</span>
          </div>
        </div>

        <div className="flex items-center justify-between p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl">
          <div className="flex items-center gap-1.5 text-xs text-emerald-900 font-semibold">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            <span>Estimated Total / Person</span>
          </div>
          <span className="text-base font-extrabold text-emerald-900">₹{grandTotal}</span>
        </div>
      </CardContent>
    </Card>
  );
};
