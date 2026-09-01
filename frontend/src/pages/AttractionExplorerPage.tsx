import React, { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  MapPin,
  Accessibility,
  ShieldCheck,
  Eye,
  Volume2,
  ChevronRight,
  Filter,
  Search,
  Heart,
} from 'lucide-react';
import { knowledgeApi } from '../api/services/knowledgeApi';
import { attractionsApi } from '../api/services/attractionsApi';
import { crowdApi } from '../api/services/crowdApi';
import { guideApi } from '../api/services/guideApi';
import { favoritesApi } from '../api/services/favoritesApi';
import { useAuth } from '../lib/AuthContext';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { FactProvenanceDrawer } from '../components/trust/FactProvenanceDrawer';
import { WeatherWidget } from '../components/map/WeatherWidget';
import { Attraction, FactProvenance } from '../types/domain';

export const AttractionExplorerPage: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [selectedDestinationId, setSelectedDestinationId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [wheelchairOnly, setWheelchairOnly] = useState(false);
  const [activeAttractionForAudit, setActiveAttractionForAudit] = useState<Attraction | null>(null);

  const { data: destinations = [] } = useQuery({
    queryKey: ['destinations'],
    queryFn: knowledgeApi.getDestinations,
  });

  // Default to first destination
  React.useEffect(() => {
    if (destinations.length > 0 && !selectedDestinationId) {
      setSelectedDestinationId(destinations[0].id);
    }
  }, [destinations, selectedDestinationId]);

  const { data: attractions = [], isLoading } = useQuery({
    queryKey: ['attractions', selectedDestinationId],
    queryFn: () => knowledgeApi.getAttractionsByDestination(selectedDestinationId),
    enabled: !!selectedDestinationId,
  });

  // Query facts when an attraction is clicked for audit
  const { data: attractionFacts = [] } = useQuery<FactProvenance[]>({
    queryKey: ['attraction-facts', activeAttractionForAudit?.id],
    queryFn: () =>
      activeAttractionForAudit ? attractionsApi.getAttractionFacts(activeAttractionForAudit.id) : [],
    enabled: !!activeAttractionForAudit,
  });

  const { data: crowd } = useQuery({
    queryKey: ['crowd', activeAttractionForAudit?.id],
    queryFn: () => crowdApi.getAttractionCrowd(activeAttractionForAudit!.id),
    enabled: !!activeAttractionForAudit,
  });

  const { data: attractionGuide } = useQuery({
    queryKey: ['attraction-guide', activeAttractionForAudit?.id],
    queryFn: () => guideApi.getAttractionGuide(activeAttractionForAudit!.id),
    enabled: !!activeAttractionForAudit,
  });

  const { data: alternatives = [] } = useQuery({
    queryKey: ['alternatives', activeAttractionForAudit?.id],
    queryFn: () => attractionsApi.getAlternatives(activeAttractionForAudit!.id),
    enabled: !!activeAttractionForAudit,
  });

  const favoriteMutation = useMutation({
    mutationFn: (attractionId: string) => favoritesApi.addFavorite(attractionId),
  });

  const crowdMutation = useMutation({
    mutationFn: (currentCrowdLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'SEVERE') =>
      crowdApi.report({ attractionId: activeAttractionForAudit!.id, currentCrowdLevel }),
  });

  const filteredAttractions = attractions.filter((a) => {
    const matchesSearch =
      a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.categories.some((c) => c.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesAccessibility = !wheelchairOnly || a.accessibilityWheelchair;
    return matchesSearch && matchesAccessibility;
  });

  const currentDest = destinations.find((d) => d.id === selectedDestinationId);
  const isDemoData = knowledgeApi.isUsingFallbackData();

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
	          <h1 className="text-2xl font-bold text-slate-900">Explore Heritage & Attractions</h1>
	          <p className="text-sm text-slate-500 mt-1">
	            Browse tourist attractions with accessibility details, provenance, and ground facts.
	          </p>
	        </div>

        {/* Destination Selector */}
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-orange-600 shrink-0" />
          <select
            value={selectedDestinationId}
            onChange={(e) => setSelectedDestinationId(e.target.value)}
            className="h-10 px-3 border border-slate-200 rounded-xl text-sm bg-white font-medium focus:ring-2 focus:ring-orange-500"
          >
            {destinations.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}, {d.country}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Live Destination Weather */}
	      {currentDest && (
	        <WeatherWidget
          lat={currentDest.latitude}
          lon={currentDest.longitude}
          cityName={`${currentDest.name}, ${currentDest.region || currentDest.country}`}
	        />
	      )}

      {isDemoData && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
          Demo fallback attraction records are shown because the backend knowledge layer returned no live data.
        </div>
      )}

	      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search attractions by name or tag..."
            className="w-full h-10 pl-9 pr-3 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer bg-slate-50 px-3 py-2 rounded-xl border border-slate-200">
            <Accessibility className="h-4 w-4 text-emerald-600" />
            <span>Wheelchair Accessible Only</span>
            <input
              type="checkbox"
              checked={wheelchairOnly}
              onChange={(e) => setWheelchairOnly(e.target.checked)}
              className="h-4 w-4 rounded text-orange-600 focus:ring-orange-500 border-slate-300"
            />
          </label>
        </div>
      </div>

      {/* Attractions Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="h-60 bg-slate-100 animate-pulse rounded-2xl" />
          ))}
        </div>
      ) : filteredAttractions.length === 0 ? (
        <Card className="p-12 text-center border-dashed border-slate-300">
          <p className="text-sm font-medium text-slate-600">
            No attractions match your active filters.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAttractions.map((attraction) => (
            <Card
              key={attraction.id}
              className="group border-slate-200 hover:shadow-lg transition-all flex flex-col justify-between"
            >
              <CardContent className="p-6 space-y-4">
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-lg font-bold text-slate-900 group-hover:text-orange-600 transition-colors">
                      {attraction.name}
                    </h3>
                    <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                      {attraction.indoorOutdoor}
                    </span>
                  </div>

                  {attraction.description && (
                    <p className="text-xs text-slate-600 mt-2 line-clamp-3 leading-relaxed">
                      {attraction.description}
                    </p>
                  )}
                </div>

                {/* Categories */}
                <div className="flex flex-wrap gap-1">
                  {attraction.categories.map((cat, i) => (
                    <span
                      key={i}
                      className="text-[11px] font-medium bg-orange-50 text-orange-700 px-2 py-0.5 rounded-md border border-orange-100"
                    >
                      {cat}
                    </span>
                  ))}
                </div>

                {/* Accessibility Badges */}
                <div className="flex items-center gap-2 pt-2 text-xs border-t border-slate-100">
                  {attraction.accessibilityWheelchair && (
                    <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                      <Accessibility className="h-3 w-3" />
                      Wheelchair
                    </span>
                  )}
                  {attraction.accessibilityVisual && (
                    <span className="flex items-center gap-1 text-[11px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md">
                      <Eye className="h-3 w-3" />
                      Visual Support
                    </span>
                  )}
                  {attraction.accessibilityHearing && (
                    <span className="flex items-center gap-1 text-[11px] font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md">
                      <Volume2 className="h-3 w-3" />
                      Hearing Support
                    </span>
                  )}
                </div>

                {/* Action: View Provenance Audit */}
                <div className="pt-2">
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 text-xs font-semibold h-9 rounded-xl justify-between border-slate-200 hover:border-orange-500 hover:text-orange-600"
                      onClick={() => setActiveAttractionForAudit(attraction)}
                    >
	                      <div className="flex items-center gap-1.5">
	                        <ShieldCheck className="h-4 w-4 text-emerald-600" />
	                        <span>Audit Facts</span>
	                      </div>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    {user && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-9 rounded-xl border-slate-200"
                        onClick={() => favoriteMutation.mutate(attraction.id)}
                        title="Save favorite"
                      >
                        <Heart className="h-4 w-4 text-rose-500" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Fact Audit Sheet */}
      {activeAttractionForAudit && (
        <>
          <FactProvenanceDrawer
            isOpen={!!activeAttractionForAudit}
            onClose={() => setActiveAttractionForAudit(null)}
            attractionName={activeAttractionForAudit.name}
            facts={attractionFacts}
          />
          <div className="fixed right-4 bottom-4 z-40 w-[min(24rem,calc(100vw-2rem))] rounded-2xl border border-slate-200 bg-white p-4 shadow-xl space-y-3">
	            <div>
	              <p className="text-xs font-bold uppercase text-slate-400">Crowd Reports</p>
	              <p className="text-sm font-bold text-slate-900">
                {crowd?.latest?.currentCrowdLevel || attractionGuide?.latestCrowd?.currentCrowdLevel || 'No report yet'}
              </p>
            </div>
            {user && (
              <div className="grid grid-cols-4 gap-1">
                {(['LOW', 'MODERATE', 'HIGH', 'SEVERE'] as const).map((level) => (
                  <button
                    key={level}
                    onClick={() => crowdMutation.mutate(level)}
                    className="rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-700 hover:bg-orange-100"
                  >
                    {level}
                  </button>
                ))}
              </div>
            )}
            {attractionGuide?.trustWarnings?.length ? (
              <div className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-xl p-2">
                {attractionGuide.trustWarnings[0]}
              </div>
            ) : null}
            {alternatives.length > 0 && (
              <div>
                <p className="text-xs font-bold uppercase text-slate-400 mb-2">Alternatives</p>
                <div className="space-y-1">
                  {alternatives.slice(0, 3).map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setActiveAttractionForAudit(item)}
                      className="block w-full text-left text-xs rounded-lg bg-slate-50 px-2 py-1.5 text-slate-700 hover:bg-slate-100"
                    >
                      {item.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
