import { apiClient } from '../client';

export interface AttractionGuide {
  id: string;
  destinationId: string;
  name: string;
  categories: string[];
  latitude: number;
  longitude: number;
  address?: string | null;
  description?: string | null;
  indoorOutdoor: string;
  accessibility: {
    wheelchair: boolean;
    visual: boolean;
    hearing: boolean;
    notes?: string | null;
  };
  facts: Array<{
    id: string;
    key: string;
    value: unknown;
    verificationStatus: string;
    confidence: number;
    lastChecked: string;
    source: { id: string; name: string; sourceType: string; reliabilityTier: number; url: string | null };
  }>;
  latestCrowd: {
    id: string;
    currentCrowdLevel: string;
    capacityValue: number | null;
    verificationStatus: string;
    timestamp: string;
    source: { id: string; name: string; sourceType: string } | null;
  } | null;
  sensitivityFlags: Array<{
    id: string;
    sensitivityType: string;
    description: string;
    activeFrom: string | null;
    activeTo: string | null;
    source: { id: string; name: string; sourceType: string } | null;
  }>;
  trustWarnings: string[];
}

export interface DestinationGuide {
  id: string;
  name: string;
  country: string;
  region?: string | null;
  latitude: number;
  longitude: number;
  timezone: string;
  attractions: AttractionGuide[];
  localBusinesses: Array<{
    id: string;
    name: string;
    category: string;
    latitude: number;
    longitude: number;
    isLocallyOwned: boolean;
    description?: string | null;
    ownershipSource?: { id: string; name: string; sourceType: string; url: string | null } | null;
  }>;
}

export const guideApi = {
  getDestinationGuide: async (id: string): Promise<DestinationGuide> => {
    const { data } = await apiClient.get<{ data: DestinationGuide }>(`/guide/destinations/${id}`);
    return data.data;
  },

  getAttractionGuide: async (id: string): Promise<AttractionGuide> => {
    const { data } = await apiClient.get<{ data: AttractionGuide }>(`/guide/attractions/${id}`);
    return data.data;
  },
};
