import { apiClient } from '../client';
import { Destination, Attraction, DestinationRating, DestinationRatingRequest } from '../../types/domain';

let usingFallbackData = false;

export const DEFAULT_DESTINATIONS: Destination[] = [
  {
    id: 'bhubaneswar-odisha',
    name: 'Bhubaneswar',
    region: 'Odisha',
    country: 'India',
    latitude: 20.2961,
    longitude: 85.8245,
    timezone: 'Asia/Kolkata',
  },
  {
    id: 'puri-odisha',
    name: 'Puri',
    region: 'Odisha',
    country: 'India',
    latitude: 19.8135,
    longitude: 85.8312,
    timezone: 'Asia/Kolkata',
  },
  {
    id: 'konark-odisha',
    name: 'Konark',
    region: 'Odisha',
    country: 'India',
    latitude: 19.8876,
    longitude: 86.0945,
    timezone: 'Asia/Kolkata',
  },
  {
    id: 'jaipur-rajasthan',
    name: 'Jaipur',
    region: 'Rajasthan',
    country: 'India',
    latitude: 26.9124,
    longitude: 75.7873,
    timezone: 'Asia/Kolkata',
  },
  {
    id: 'varanasi-up',
    name: 'Varanasi',
    region: 'Uttar Pradesh',
    country: 'India',
    latitude: 25.3176,
    longitude: 82.9739,
    timezone: 'Asia/Kolkata',
  },
  {
    id: 'agra-up',
    name: 'Agra',
    region: 'Uttar Pradesh',
    country: 'India',
    latitude: 27.1767,
    longitude: 78.0081,
    timezone: 'Asia/Kolkata',
  },
  {
    id: 'goa',
    name: 'Goa',
    region: 'Goa',
    country: 'India',
    latitude: 15.2993,
    longitude: 74.1240,
    timezone: 'Asia/Kolkata',
  },
  {
    id: 'kerala',
    name: 'Kerala',
    region: 'Kerala',
    country: 'India',
    latitude: 10.8505,
    longitude: 76.2711,
    timezone: 'Asia/Kolkata',
  },
  {
    id: 'manali-hp',
    name: 'Manali',
    region: 'Himachal Pradesh',
    country: 'India',
    latitude: 32.2396,
    longitude: 77.1887,
    timezone: 'Asia/Kolkata',
  },
  {
    id: 'darjeeling-wb',
    name: 'Darjeeling',
    region: 'West Bengal',
    country: 'India',
    latitude: 27.0360,
    longitude: 88.2627,
    timezone: 'Asia/Kolkata',
  },
  {
    id: 'mysore-karnataka',
    name: 'Mysore',
    region: 'Karnataka',
    country: 'India',
    latitude: 12.2958,
    longitude: 76.6394,
    timezone: 'Asia/Kolkata',
  },
];

export const DEFAULT_ATTRACTIONS: Record<string, Attraction[]> = {
  'bhubaneswar-odisha': [
    {
      id: 'lingaraj-temple',
      destinationId: 'bhubaneswar-odisha',
      name: 'Lingaraj Temple',
      categories: ['Heritage', 'Spiritual', 'Architecture'],
      latitude: 20.2381,
      longitude: 85.8336,
      address: 'Old Town, Bhubaneswar, Odisha',
      description: 'Ancient 11th-century temple dedicated to Harihara, showcasing quintessential Kalinga architecture.',
      indoorOutdoor: 'mixed',
      accessibilityWheelchair: false,
      accessibilityVisual: true,
      accessibilityHearing: true,
      accessibilityNotes: 'Ancient stone steps at entrance. Wheelchairs require assistance.',
    },
    {
      id: 'udayagiri-khandagiri',
      destinationId: 'bhubaneswar-odisha',
      name: 'Udayagiri & Khandagiri Caves',
      categories: ['Heritage', 'History', 'Nature'],
      latitude: 20.2606,
      longitude: 85.7864,
      address: 'Khandagiri, Bhubaneswar, Odisha',
      description: 'Rock-cut caves of historical and archaeological significance dating back to King Kharavela.',
      indoorOutdoor: 'outdoor',
      accessibilityWheelchair: false,
      accessibilityVisual: false,
      accessibilityHearing: true,
    },
    {
      id: 'odisha-state-museum',
      destinationId: 'bhubaneswar-odisha',
      name: 'Odisha State Museum',
      categories: ['Museums & Culture', 'Handicrafts & Art'],
      latitude: 20.2548,
      longitude: 85.8431,
      address: 'Lewis Rd, BJB Nagar, Bhubaneswar',
      description: 'Premier museum housing palm-leaf manuscripts, ancient sculptures, coins, and tribal art.',
      indoorOutdoor: 'indoor',
      accessibilityWheelchair: true,
      accessibilityVisual: true,
      accessibilityHearing: true,
      accessibilityNotes: 'Ramps and accessible elevators available throughout all main galleries.',
    },
    {
      id: 'dhauli-shanti-stupa',
      destinationId: 'bhubaneswar-odisha',
      name: 'Dhauli Shanti Stupa',
      categories: ['Heritage', 'Spiritual', 'History'],
      latitude: 20.1924,
      longitude: 85.8394,
      address: 'Dhauli Hills, Bhubaneswar',
      description: 'Peace pagoda on the banks of River Daya, marking the historic Kalinga War transformation of Emperor Ashoka.',
      indoorOutdoor: 'outdoor',
      accessibilityWheelchair: true,
      accessibilityVisual: true,
      accessibilityHearing: true,
    },
    {
      id: 'mukteshwar-temple',
      destinationId: 'bhubaneswar-odisha',
      name: 'Mukteshwar Temple',
      categories: ['Heritage', 'Architecture', 'Spiritual'],
      latitude: 20.2432,
      longitude: 85.8358,
      address: 'Old Town, Bhubaneswar',
      description: 'Known as the "Gem of Odisha architecture", famed for its sculpted stone archway (Torana).',
      indoorOutdoor: 'mixed',
      accessibilityWheelchair: true,
      accessibilityVisual: true,
      accessibilityHearing: true,
    },
    {
      id: 'nandankanan-zoo',
      destinationId: 'bhubaneswar-odisha',
      name: 'Nandankanan Zoological Park',
      categories: ['Nature & Parks', 'Family'],
      latitude: 20.3687,
      longitude: 85.8268,
      address: 'Nandankanan Rd, Bhubaneswar',
      description: 'Famous zoological park and botanical garden — home to white tigers and the country\'s first white-tiger breeding program.',
      indoorOutdoor: 'outdoor',
      accessibilityWheelchair: true,
      accessibilityVisual: false,
      accessibilityHearing: true,
      accessibilityNotes: 'Paved paths for most enclosures; battery-operated vehicles available.',
    },
    {
      id: 'rajarani-temple',
      destinationId: 'bhubaneswar-odisha',
      name: 'Rajarani Temple',
      categories: ['Heritage', 'Architecture'],
      latitude: 20.2498,
      longitude: 85.8467,
      address: 'Near Odisha State Museum, Bhubaneswar',
      description: 'Temple known for its erotic carvings and unique red sandstone tower rising above serene gardens.',
      indoorOutdoor: 'mixed',
      accessibilityWheelchair: false,
      accessibilityVisual: true,
      accessibilityHearing: true,
    },
    {
      id: 'ekamra-haat',
      destinationId: 'bhubaneswar-odisha',
      name: 'Ekamra Haat Craft Market',
      categories: ['Local Food & Markets', 'Handicrafts & Art'],
      latitude: 20.2562,
      longitude: 85.8389,
      address: 'Ekamra Haat, Bhubaneswar',
      description: 'Curated artisan market showcasing handlooms, Pattachitra paintings, stone carvings, and Odia street food.',
      indoorOutdoor: 'outdoor',
      accessibilityWheelchair: true,
      accessibilityVisual: true,
      accessibilityHearing: true,
    },
  ],

  'puri-odisha': [
    {
      id: 'jagannath-temple',
      destinationId: 'puri-odisha',
      name: 'Shree Jagannath Temple',
      categories: ['Spiritual', 'Heritage', 'Culture'],
      latitude: 19.8049,
      longitude: 85.8179,
      address: 'Grand Road, Puri, Odisha',
      description: 'One of the Char Dham pilgrimage sites, famous for its wooden deities and annual Ratha Yatra.',
      indoorOutdoor: 'mixed',
      accessibilityWheelchair: false,
      accessibilityVisual: true,
      accessibilityHearing: true,
    },
    {
      id: 'golden-beach-puri',
      destinationId: 'puri-odisha',
      name: 'Puri Golden Beach (Blue Flag Certified)',
      categories: ['Nature & Parks', 'Local Food & Markets'],
      latitude: 19.7983,
      longitude: 85.8249,
      address: 'Chakratirtha Rd, Puri',
      description: 'Eco-certified pristine beach with accessible promenade, safety lifeguards, and ocean breeze.',
      indoorOutdoor: 'outdoor',
      accessibilityWheelchair: true,
      accessibilityVisual: true,
      accessibilityHearing: true,
    },
    {
      id: 'puri-beach-market',
      destinationId: 'puri-odisha',
      name: 'Swargadwar & Sea Beach Market',
      categories: ['Local Food & Markets', 'Culture'],
      latitude: 19.7954,
      longitude: 85.8231,
      address: 'Swargadwar, Puri',
      description: 'Vibrant seafront market and sacred cremation ground at the foot of the Bay of Bengal.',
      indoorOutdoor: 'outdoor',
      accessibilityWheelchair: true,
      accessibilityVisual: true,
      accessibilityHearing: true,
    },
    {
      id: 'chilika-lake',
      destinationId: 'puri-odisha',
      name: 'Chilika Lake Bird Sanctuary',
      categories: ['Nature & Parks', 'Heritage'],
      latitude: 19.7333,
      longitude: 85.3186,
      address: 'Chilika Lake, Odisha',
      description: 'Asia\'s largest brackish water lagoon — winter home to flamingos, migratory birds and Irrawaddy dolphins.',
      indoorOutdoor: 'outdoor',
      accessibilityWheelchair: false,
      accessibilityVisual: false,
      accessibilityHearing: true,
    },
    {
      id: 'raghurajpur-village',
      destinationId: 'puri-odisha',
      name: 'Raghurajpur Heritage Craft Village',
      categories: ['Handicrafts & Art', 'Culture'],
      latitude: 19.8837,
      longitude: 85.8867,
      address: 'Raghurajpur, Puri District',
      description: 'A UNESCO-recognised village where every household practises Pattachitra, stone carving, or palm-leaf etching.',
      indoorOutdoor: 'outdoor',
      accessibilityWheelchair: true,
      accessibilityVisual: false,
      accessibilityHearing: true,
    },
    {
      id: 'gundicha-temple',
      destinationId: 'puri-odisha',
      name: 'Gundicha Temple',
      categories: ['Spiritual', 'Heritage'],
      latitude: 19.8098,
      longitude: 85.8216,
      address: 'Grand Road, Puri',
      description: 'The "Garden House of Lord Jagannath" — the destination of the annual Rath Yatra chariot procession.',
      indoorOutdoor: 'outdoor',
      accessibilityWheelchair: false,
      accessibilityVisual: true,
      accessibilityHearing: true,
    },
  ],

  'konark-odisha': [
    {
      id: 'sun-temple-konark',
      destinationId: 'konark-odisha',
      name: 'Konark Sun Temple (UNESCO World Heritage)',
      categories: ['Heritage', 'Architecture', 'History'],
      latitude: 19.8876,
      longitude: 86.0945,
      address: 'Konark, Odisha',
      description: 'The 13th-century chariot temple of Surya is among the greatest architectural achievements of medieval India.',
      indoorOutdoor: 'outdoor',
      accessibilityWheelchair: true,
      accessibilityVisual: true,
      accessibilityHearing: true,
      accessibilityNotes: 'Archaeological Survey ramps and guided access for persons with disability.',
    },
    {
      id: 'konark-beach',
      destinationId: 'konark-odisha',
      name: 'Konark Beach (Chandrabhaga)',
      categories: ['Nature & Parks'],
      latitude: 19.8784,
      longitude: 86.1025,
      address: 'Chandrabhaga, Konark',
      description: 'Serene sunrise beach famous for Chandrabhaga Mela and Konark Dance Festival performances against the sea.',
      indoorOutdoor: 'outdoor',
      accessibilityWheelchair: false,
      accessibilityVisual: true,
      accessibilityHearing: true,
    },
    {
      id: 'konark-museum',
      destinationId: 'konark-odisha',
      name: 'Archaeological Museum Konark',
      categories: ['Museums & Culture', 'Heritage'],
      latitude: 19.8881,
      longitude: 86.0961,
      address: 'Near Sun Temple, Konark',
      description: 'Museum displaying original stone sculptures and architectural fragments excavated from the Sun Temple complex.',
      indoorOutdoor: 'indoor',
      accessibilityWheelchair: true,
      accessibilityVisual: true,
      accessibilityHearing: true,
    },
    {
      id: 'ramchandi-temple',
      destinationId: 'konark-odisha',
      name: 'Ramchandi Temple',
      categories: ['Spiritual'],
      latitude: 19.8567,
      longitude: 86.0891,
      address: 'Ramchandi Beach, Konark',
      description: 'Riverside Shakti temple where the Kushbhadra River meets the Bay of Bengal — a serene pilgrimage spot.',
      indoorOutdoor: 'outdoor',
      accessibilityWheelchair: false,
      accessibilityVisual: true,
      accessibilityHearing: true,
    },
  ],

  'jaipur-rajasthan': [
    {
      id: 'amber-fort',
      destinationId: 'jaipur-rajasthan',
      name: 'Amber Fort & Palace',
      categories: ['Heritage', 'Architecture', 'History'],
      latitude: 26.9855,
      longitude: 75.8513,
      address: 'Devisinghpura, Amer, Jaipur',
      description: 'Magnificent Rajput fort blending Hindu and Mughal elements, with ornate mirrored halls and elephant rides.',
      indoorOutdoor: 'mixed',
      accessibilityWheelchair: false,
      accessibilityVisual: true,
      accessibilityHearing: true,
      accessibilityNotes: 'Steep inclines and irregular stone steps. Jeep shuttle available.',
    },
    {
      id: 'hawa-mahal',
      destinationId: 'jaipur-rajasthan',
      name: 'Hawa Mahal (Palace of Winds)',
      categories: ['Heritage', 'Architecture'],
      latitude: 26.9239,
      longitude: 75.8267,
      address: 'Hawa Mahal Rd, Badi Chaupad, Jaipur',
      description: 'Iconic 5-storey "palace of winds" with 953 small windows allowing royal ladies to observe street processions.',
      indoorOutdoor: 'mixed',
      accessibilityWheelchair: false,
      accessibilityVisual: true,
      accessibilityHearing: true,
    },
    {
      id: 'city-palace-jaipur',
      destinationId: 'jaipur-rajasthan',
      name: 'City Palace Jaipur',
      categories: ['Heritage', 'Architecture', 'Museums & Culture'],
      latitude: 26.9258,
      longitude: 75.8237,
      address: 'Tulsi Marg, Gangori Bazaar, Jaipur',
      description: 'Royal palace complex housing museums of royal garments, weapons, and the world\'s two largest silver urns.',
      indoorOutdoor: 'mixed',
      accessibilityWheelchair: true,
      accessibilityVisual: true,
      accessibilityHearing: true,
    },
    {
      id: 'jantar-mantar',
      destinationId: 'jaipur-rajasthan',
      name: 'Jantar Mantar (UNESCO World Heritage)',
      categories: ['Heritage', 'History', 'Architecture'],
      latitude: 26.9248,
      longitude: 75.8246,
      address: 'Gangori Bazaar, J.D.A. Market, Jaipur',
      description: '18th-century astronomical observatory with the world\'s largest stone sundial, accurate to 2 seconds.',
      indoorOutdoor: 'outdoor',
      accessibilityWheelchair: true,
      accessibilityVisual: true,
      accessibilityHearing: true,
    },
    {
      id: 'nahargarh-fort',
      destinationId: 'jaipur-rajasthan',
      name: 'Nahargarh Fort',
      categories: ['Heritage', 'Nature & Parks'],
      latitude: 26.9433,
      longitude: 75.8026,
      address: 'Krishna Nagar, Brahampuri, Jaipur',
      description: 'Fort overlooking Jaipur\'s pink skyline with sprawling views; houses the Sheesh Mahal and wax museum.',
      indoorOutdoor: 'outdoor',
      accessibilityWheelchair: false,
      accessibilityVisual: true,
      accessibilityHearing: true,
    },
    {
      id: 'jaipur-bazaar',
      destinationId: 'jaipur-rajasthan',
      name: 'Johari & Tripolia Bazaar',
      categories: ['Local Food & Markets', 'Handicrafts & Art'],
      latitude: 26.9217,
      longitude: 75.8236,
      address: 'Johari Bazaar, Jaipur',
      description: 'Famous gem, jewellery, and textile markets in the heart of the walled city — Rajasthan\'s trading soul.',
      indoorOutdoor: 'outdoor',
      accessibilityWheelchair: true,
      accessibilityVisual: false,
      accessibilityHearing: true,
    },
    {
      id: 'albert-hall-museum',
      destinationId: 'jaipur-rajasthan',
      name: 'Albert Hall Museum',
      categories: ['Museums & Culture', 'Heritage'],
      latitude: 26.9047,
      longitude: 75.8233,
      address: 'Ram Niwas Garden, Jaipur',
      description: 'Oldest museum of Rajasthan — Indo-Saracenic architectural gem housing Egyptian mummies and Mughal miniatures.',
      indoorOutdoor: 'mixed',
      accessibilityWheelchair: true,
      accessibilityVisual: true,
      accessibilityHearing: true,
    },
    {
      id: 'jal-mahal',
      destinationId: 'jaipur-rajasthan',
      name: 'Jal Mahal (Water Palace)',
      categories: ['Heritage', 'Nature & Parks'],
      latitude: 26.9516,
      longitude: 75.8464,
      address: 'Man Sagar Lake, Jaipur',
      description: 'A 5-storey Rajput palace appearing to float at the centre of Man Sagar Lake — best seen at dusk.',
      indoorOutdoor: 'outdoor',
      accessibilityWheelchair: true,
      accessibilityVisual: true,
      accessibilityHearing: true,
    },
  ],

  'agra-up': [
    {
      id: 'taj-mahal',
      destinationId: 'agra-up',
      name: 'Taj Mahal (UNESCO World Heritage)',
      categories: ['Heritage', 'Architecture', 'History'],
      latitude: 27.1751,
      longitude: 78.0421,
      address: 'Dharmapuri, Forest Colony, Tajganj, Agra',
      description: 'Iconic 17th-century white marble mausoleum built by Mughal emperor Shah Jahan for his wife Mumtaz Mahal.',
      indoorOutdoor: 'mixed',
      accessibilityWheelchair: true,
      accessibilityVisual: true,
      accessibilityHearing: true,
      accessibilityNotes: 'Ramps available for main gardens; some levels require manual lifting of wheelchair.',
    },
    {
      id: 'agra-fort',
      destinationId: 'agra-up',
      name: 'Agra Fort (UNESCO World Heritage)',
      categories: ['Heritage', 'Architecture', 'History'],
      latitude: 27.1795,
      longitude: 78.0211,
      address: 'Agra Fort, Rakabganj, Agra',
      description: 'Massive red sandstone fort which served as the main residence of the Mughal emperors until 1638.',
      indoorOutdoor: 'mixed',
      accessibilityWheelchair: false,
      accessibilityVisual: true,
      accessibilityHearing: true,
    },
    {
      id: 'fatehpur-sikri',
      destinationId: 'agra-up',
      name: 'Fatehpur Sikri',
      categories: ['Heritage', 'Architecture', 'History'],
      latitude: 27.0911,
      longitude: 77.6611,
      address: 'Fatehpur Sikri, Agra District',
      description: 'A 16th-century Mughal capital built of red sandstone, featuring the massive Buland Darwaza.',
      indoorOutdoor: 'outdoor',
      accessibilityWheelchair: false,
      accessibilityVisual: true,
      accessibilityHearing: true,
    }
  ],

  'varanasi-up': [
    {
      id: 'dashashwamedh-ghat',
      destinationId: 'varanasi-up',
      name: 'Dashashwamedh Ghat & Ganga Aarti',
      categories: ['Spiritual', 'Culture', 'Heritage'],
      latitude: 25.3050,
      longitude: 83.0166,
      address: 'Dashashwamedh Rd, Varanasi',
      description: 'The main ghat of Varanasi, famous for its spectacular daily Ganga Aarti ceremony with fire and flowers.',
      indoorOutdoor: 'outdoor',
      accessibilityWheelchair: false,
      accessibilityVisual: true,
      accessibilityHearing: true,
      accessibilityNotes: 'Stone steps to waterfront. Ghats accessible at top-level viewing areas.',
    },
    {
      id: 'kashi-vishwanath-temple',
      destinationId: 'varanasi-up',
      name: 'Kashi Vishwanath Temple',
      categories: ['Spiritual', 'Heritage'],
      latitude: 25.3109,
      longitude: 83.0107,
      address: 'Lahori Tola, Varanasi',
      description: 'One of the 12 Jyotirlingas and most sacred Shiva temple in Hinduism, recently restored under Kashi Vishwanath Corridor.',
      indoorOutdoor: 'mixed',
      accessibilityWheelchair: true,
      accessibilityVisual: true,
      accessibilityHearing: true,
      accessibilityNotes: 'New corridor has ramps and wide walkways per 2023 CPWD accessibility audit.',
    },
    {
      id: 'sarnath',
      destinationId: 'varanasi-up',
      name: 'Sarnath — Dhamek Stupa & Museum',
      categories: ['Heritage', 'History', 'Spiritual'],
      latitude: 25.3811,
      longitude: 83.0243,
      address: 'Sarnath, Varanasi District',
      description: 'Where the Buddha delivered his first sermon after enlightenment; UNESCO-listed Dhamek Stupa dates to 500 CE.',
      indoorOutdoor: 'outdoor',
      accessibilityWheelchair: true,
      accessibilityVisual: true,
      accessibilityHearing: true,
    },
    {
      id: 'banaras-hindu-university',
      destinationId: 'varanasi-up',
      name: 'Banaras Hindu University & New Vishwanath Temple',
      categories: ['Heritage', 'Spiritual', 'Architecture'],
      latitude: 25.2677,
      longitude: 82.9913,
      address: 'Lanka, Varanasi',
      description: 'One of Asia\'s largest residential universities — home to a white-marble temple and Bharat Kala Bhavan art museum.',
      indoorOutdoor: 'mixed',
      accessibilityWheelchair: true,
      accessibilityVisual: true,
      accessibilityHearing: true,
    },
    {
      id: 'ramnagar-fort',
      destinationId: 'varanasi-up',
      name: 'Ramnagar Fort & Museum',
      categories: ['Heritage', 'Museums & Culture'],
      latitude: 25.2898,
      longitude: 83.0332,
      address: 'Ramnagar, Varanasi',
      description: '18th-century fort of the Kashi Naresh, housing a vintage car collection, arms, and astronomical clocks.',
      indoorOutdoor: 'mixed',
      accessibilityWheelchair: false,
      accessibilityVisual: false,
      accessibilityHearing: true,
    },
    {
      id: 'assi-ghat',
      destinationId: 'varanasi-up',
      name: 'Assi Ghat & Varanasi Sunrise Boat Ride',
      categories: ['Culture', 'Nature & Parks', 'Local Food & Markets'],
      latitude: 25.2948,
      longitude: 83.0101,
      address: 'Assi Ghat, Varanasi',
      description: 'The southernmost ghat — ideal for a sunrise boat ride along the ghats, witnessing yoga and classical music sessions.',
      indoorOutdoor: 'outdoor',
      accessibilityWheelchair: false,
      accessibilityVisual: true,
      accessibilityHearing: true,
    },
    {
      id: 'vishwanath-lane',
      destinationId: 'varanasi-up',
      name: 'Vishwanath Gali — Street Food Trail',
      categories: ['Local Food & Markets'],
      latitude: 25.3103,
      longitude: 83.0097,
      address: 'Vishwanath Gali, Varanasi',
      description: 'Narrow lanes leading to the temple packed with chaat, lassi, kachori and Banarasi silk shops.',
      indoorOutdoor: 'outdoor',
      accessibilityWheelchair: false,
      accessibilityVisual: false,
      accessibilityHearing: true,
    },
  ],
};

export const knowledgeApi = {
  getDestinations: async (): Promise<Destination[]> => {
    try {
      const response = await apiClient.get<{ data: Destination[] }>('/knowledge/destinations');
      if (response.data?.data && response.data.data.length > 0) {
        usingFallbackData = false;
        return response.data.data;
      }
      usingFallbackData = true;
      return DEFAULT_DESTINATIONS;
    } catch {
      usingFallbackData = true;
      return DEFAULT_DESTINATIONS;
    }
  },

  getDestination: async (destinationId: string): Promise<Destination & { _count?: { attractions: number } }> => {
    try {
      const response = await apiClient.get<{ data: Destination & { _count?: { attractions: number } } }>(`/knowledge/destinations/${destinationId}`);
      usingFallbackData = false;
      return response.data.data;
    } catch {
      const fallback = DEFAULT_DESTINATIONS.find((d) => d.id === destinationId);
      if (!fallback) throw new Error('Destination not found');
      usingFallbackData = true;
      return fallback;
    }
  },

  getAttractionsByDestination: async (
    destinationId: string,
    filters: {
      categories?: string;
      accessibilityWheelchair?: boolean;
      indoorOutdoor?: 'indoor' | 'outdoor' | 'mixed';
      search?: string;
    } = {},
  ): Promise<Attraction[]> => {
    try {
      const response = await apiClient.get<{ data: Attraction[] }>(`/knowledge/destinations/${destinationId}/attractions`, {
        params: {
          ...filters,
          accessibilityWheelchair:
            filters.accessibilityWheelchair === undefined ? undefined : String(filters.accessibilityWheelchair),
        },
      });
      if (response.data?.data && response.data.data.length > 0) {
        usingFallbackData = false;
        return response.data.data;
      }
      usingFallbackData = true;
      return DEFAULT_ATTRACTIONS[destinationId] || [];
    } catch {
      usingFallbackData = true;
      return DEFAULT_ATTRACTIONS[destinationId] || [];
    }
  },

  getDestinationRatings: async (input: DestinationRatingRequest = {}): Promise<DestinationRating[]> => {
    try {
      const response = await apiClient.post<{ data: { ratings: DestinationRating[] } }>('/scoring/destination-ratings', input);
      return response.data?.data?.ratings || [];
    } catch {
      return fallbackDestinationRatings(input);
    }
  },

  isUsingFallbackData: () => usingFallbackData,
};

const ratingLabel = (score: number, count: number) => {
  if (count === 0) return 'Limited Data';
  if (score >= 85) return 'Excellent Fit';
  if (score >= 70) return 'Good Fit';
  if (score >= 55) return 'Fair Fit';
  return 'Weak Fit';
};

const lowerTokens = (text: string) =>
  text.toLowerCase().split(/[^a-z0-9]+/).filter((token) => token.length > 2 && !['and', 'the', 'for', 'with'].includes(token));

const fallbackDestinationRatings = (input: DestinationRatingRequest): DestinationRating[] => {
  const ids = input.destinationIds?.length ? new Set(input.destinationIds) : null;
  const interestTokens = new Set((input.interests || input.preferences?.interests || []).flatMap(lowerTokens));
  const wheelchair = input.accessibilityWheelchair ?? input.preferences?.accessibilityWheelchair ?? false;
  const budgetBand = input.budgetBand ?? input.preferences?.budgetBand ?? 'MODERATE';
  const budgetLimit = budgetBand === 'BUDGET' ? 100 : budgetBand === 'PREMIUM' ? 1000 : 350;
  const preferredTime = input.preferredTime ?? input.preferences?.preferredStartTime ?? '09:00';
  const hour = Number(preferredTime.split(':')[0] || 9);
  const month = input.startDate ? new Date(input.startDate).getMonth() + 1 : new Date().getMonth() + 1;

  return DEFAULT_DESTINATIONS
    .filter((destination) => !ids || ids.has(destination.id))
    .map((destination) => {
      const attractions = DEFAULT_ATTRACTIONS[destination.id] || [];
      const accessible = attractions.filter((attraction) => attraction.accessibilityWheelchair).length;
      const interestMatches = attractions.filter((attraction) => {
        const text = `${attraction.name} ${attraction.description || ''} ${attraction.categories.join(' ')}`;
        const attractionTokens = new Set(lowerTokens(text));
        return [...interestTokens].some((token) => attractionTokens.has(token));
      }).length;
      const cheapStops = attractions.filter((attraction) => {
        const text = `${attraction.name} ${attraction.categories.join(' ')}`.toLowerCase();
        const estimate = /(market|temple|beach|park|ghat)/.test(text) ? 0 : /(zoo|safari|adventure)/.test(text) ? 250 : 80;
        return estimate <= budgetLimit;
      }).length;
      const outdoor = attractions.length
        ? attractions.reduce((sum, attraction) => sum + (attraction.indoorOutdoor === 'outdoor' ? 1 : attraction.indoorOutdoor === 'mixed' ? 0.5 : 0), 0) / attractions.length
        : 0.5;
      const accessibilityScore = !wheelchair ? 100 : attractions.length ? (accessible / attractions.length) * 100 : 35;
      const interestScore = interestTokens.size === 0 ? 80 : attractions.length ? 35 + (interestMatches / attractions.length) * 65 : 40;
      const budgetScore = attractions.length ? (cheapStops / attractions.length) * 100 : 45;
      const seasonalPenalty = (month >= 4 && month <= 9 ? 20 * outdoor : 0) + (hour >= 12 && hour <= 16 ? 18 * outdoor : 0);
      const score = Math.max(0, Math.min(100, Math.round(accessibilityScore * 0.25 + interestScore * 0.25 + budgetScore * 0.2 + (100 - seasonalPenalty) * 0.2 + 75 * 0.1)));

      return {
        destinationId: destination.id,
        destinationName: destination.name,
        score,
        label: ratingLabel(score, attractions.length),
        summary: attractions.length ? `${accessible}/${attractions.length} wheelchair stops, ${cheapStops}/${attractions.length} budget-friendly stops` : 'Not enough attraction data yet',
        topReasons: attractions.length
          ? [`${interestMatches}/${attractions.length} stops match selected interests`, `${cheapStops}/${attractions.length} stops fit ${budgetBand.toLowerCase()} assumptions`]
          : ['No attraction records available'],
        breakdown: [],
        computedAt: new Date().toISOString(),
      };
    })
    .sort((a, b) => b.score - a.score || a.destinationName.localeCompare(b.destinationName));
};
