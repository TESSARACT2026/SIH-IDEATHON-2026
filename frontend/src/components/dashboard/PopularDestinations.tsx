import React, { useState } from 'react';
import { Star, ChevronRight, ChevronLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { knowledgeApi } from '../../api/services/knowledgeApi';

interface Destination {
  id: string;
  name: string;
  state: string;
  rating: number;
  reviews: string;
  image: string;
  emoji: string;
  emojiBg: string;
}

const defaultDestinations: Destination[] = [
  {
    id: '1',
    name: 'Manali',
    state: 'Himachal Pradesh',
    rating: 4.8,
    reviews: '1.2K',
    emoji: '🏔️',
    emojiBg: 'bg-teal-400',
    image: 'https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?w=400&h=300&fit=crop&auto=format',
  },
  {
    id: '2',
    name: 'Jaipur',
    state: 'Rajasthan',
    rating: 4.7,
    reviews: '2.1K',
    emoji: '🏰',
    emojiBg: 'bg-orange-400',
    image: 'https://images.unsplash.com/photo-1477587458883-47145ed94245?w=400&h=300&fit=crop&auto=format',
  },
  {
    id: '3',
    name: 'Varanasi',
    state: 'Uttar Pradesh',
    rating: 4.9,
    reviews: '3.4K',
    emoji: '🕉️',
    emojiBg: 'bg-purple-400',
    image: 'https://images.unsplash.com/photo-1561361058-c24cecae35ca?w=400&h=300&fit=crop&auto=format',
  },
  {
    id: '4',
    name: 'Kerala',
    state: 'Kerala',
    rating: 4.8,
    reviews: '1.6K',
    emoji: '🌴',
    emojiBg: 'bg-cyan-400',
    image: 'https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?w=400&h=300&fit=crop&auto=format',
  },
  {
    id: '5',
    name: 'Goa',
    state: 'Goa',
    rating: 4.6,
    reviews: '2.8K',
    emoji: '🏖️',
    emojiBg: 'bg-yellow-400',
    image: 'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=400&h=300&fit=crop&auto=format',
  },
  {
    id: '6',
    name: 'Agra',
    state: 'Uttar Pradesh',
    rating: 4.8,
    reviews: '3.1K',
    emoji: '🕌',
    emojiBg: 'bg-rose-400',
    image: 'https://images.unsplash.com/photo-1548013146-72479768bada?w=400&h=300&fit=crop&auto=format',
  },
  {
    id: '7',
    name: 'Darjeeling',
    state: 'West Bengal',
    rating: 4.7,
    reviews: '1.9K',
    emoji: '🚂',
    emojiBg: 'bg-green-400',
    image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=400&h=300&fit=crop&auto=format',
  },
  {
    id: '8',
    name: 'Mysore',
    state: 'Karnataka',
    rating: 4.6,
    reviews: '2.2K',
    emoji: '🐘',
    emojiBg: 'bg-amber-400',
    image: 'https://images.unsplash.com/photo-1533105079780-92b9be482077?w=400&h=300&fit=crop&auto=format',
  },
];

// Comprehensive destination image map keyed by destination name (lowercase)
const DESTINATION_IMAGES: Record<string, { image: string; emoji: string; emojiBg: string }> = {
  'bhubaneswar': { emoji: '🏛️', emojiBg: 'bg-orange-400', image: 'https://images.unsplash.com/photo-1582510003544-4d00b7f74220?w=400&h=300&fit=crop&auto=format' },
  'puri': { emoji: '🌊', emojiBg: 'bg-cyan-400', image: 'https://images.unsplash.com/photo-1626714258765-14e8e97e6af2?w=400&h=300&fit=crop&auto=format' },
  'konark': { emoji: '☀️', emojiBg: 'bg-yellow-400', image: 'https://images.unsplash.com/photo-1590050752117-238cb0fb12b1?w=400&h=300&fit=crop&auto=format' },
  'jaipur': { emoji: '🏰', emojiBg: 'bg-orange-400', image: 'https://images.unsplash.com/photo-1477587458883-47145ed94245?w=400&h=300&fit=crop&auto=format' },
  'varanasi': { emoji: '🕉️', emojiBg: 'bg-purple-400', image: 'https://images.unsplash.com/photo-1561361058-c24cecae35ca?w=400&h=300&fit=crop&auto=format' },
  'agra': { emoji: '🕌', emojiBg: 'bg-rose-400', image: 'https://images.unsplash.com/photo-1548013146-72479768bada?w=400&h=300&fit=crop&auto=format' },
  'goa': { emoji: '🏖️', emojiBg: 'bg-yellow-400', image: 'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=400&h=300&fit=crop&auto=format' },
  'kerala': { emoji: '🌴', emojiBg: 'bg-cyan-400', image: 'https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?w=400&h=300&fit=crop&auto=format' },
  'munnar': { emoji: '🌿', emojiBg: 'bg-green-400', image: 'https://images.unsplash.com/photo-1605649487212-47bdab064df7?w=400&h=300&fit=crop&auto=format' },
  'manali': { emoji: '🏔️', emojiBg: 'bg-teal-400', image: 'https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?w=400&h=300&fit=crop&auto=format' },
  'darjeeling': { emoji: '🚂', emojiBg: 'bg-green-400', image: 'https://images.unsplash.com/photo-1544639587-bdc84e6dc668?w=400&h=300&fit=crop&auto=format' },
  'mysore': { emoji: '🐘', emojiBg: 'bg-amber-400', image: 'https://images.unsplash.com/photo-1633789242441-11dd85ea9670?w=400&h=300&fit=crop&auto=format' },
  // All Indian States
  'visakhapatnam': { emoji: '⛵', emojiBg: 'bg-blue-400', image: 'https://images.unsplash.com/photo-1591297669022-a0609afef87a?w=400&h=300&fit=crop&auto=format' },
  'tawang': { emoji: '🏔️', emojiBg: 'bg-indigo-400', image: 'https://images.unsplash.com/photo-1607462109225-6b64ae2dd3cb?w=400&h=300&fit=crop&auto=format' },
  'guwahati': { emoji: '🛕', emojiBg: 'bg-orange-400', image: 'https://images.unsplash.com/photo-1680782316083-4c7c09de7591?w=400&h=300&fit=crop&auto=format' },
  'bodh gaya': { emoji: '☸️', emojiBg: 'bg-amber-400', image: 'https://images.unsplash.com/photo-1626005606720-61bab8a4d6fe?w=400&h=300&fit=crop&auto=format' },
  'raipur': { emoji: '🌾', emojiBg: 'bg-lime-400', image: 'https://images.unsplash.com/photo-1662473219534-72bab1ef7fa4?w=400&h=300&fit=crop&auto=format' },
  'ahmedabad': { emoji: '🏛️', emojiBg: 'bg-yellow-400', image: 'https://images.unsplash.com/photo-1590156546069-83ce63c75b49?w=400&h=300&fit=crop&auto=format' },
  'gurugram': { emoji: '🌆', emojiBg: 'bg-slate-400', image: 'https://images.unsplash.com/photo-1587474260584-136574528ed5?w=400&h=300&fit=crop&auto=format' },
  'ranchi': { emoji: '💧', emojiBg: 'bg-sky-400', image: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=400&h=300&fit=crop&auto=format' },
  'bengaluru': { emoji: '🌸', emojiBg: 'bg-pink-400', image: 'https://images.unsplash.com/photo-1596176530529-78163a4f7af2?w=400&h=300&fit=crop&auto=format' },
  'bhopal': { emoji: '🕌', emojiBg: 'bg-teal-400', image: 'https://images.unsplash.com/photo-1583147610148-5efec2a94dc5?w=400&h=300&fit=crop&auto=format' },
  'mumbai': { emoji: '🌉', emojiBg: 'bg-blue-400', image: 'https://images.unsplash.com/photo-1566552881560-0be862a7c445?w=400&h=300&fit=crop&auto=format' },
  'imphal': { emoji: '🏞️', emojiBg: 'bg-green-400', image: 'https://images.unsplash.com/photo-1623501952637-0c5efb1e4e06?w=400&h=300&fit=crop&auto=format' },
  'shillong': { emoji: '⛰️', emojiBg: 'bg-emerald-400', image: 'https://images.unsplash.com/photo-1617195737994-7fd4d6a62cd7?w=400&h=300&fit=crop&auto=format' },
  'aizawl': { emoji: '🌄', emojiBg: 'bg-violet-400', image: 'https://images.unsplash.com/photo-1633436373892-bdfaaae38dba?w=400&h=300&fit=crop&auto=format' },
  'kohima': { emoji: '🌿', emojiBg: 'bg-green-400', image: 'https://images.unsplash.com/photo-1680782316083-4c7c09de7591?w=400&h=300&fit=crop&auto=format' },
  'amritsar': { emoji: '✨', emojiBg: 'bg-yellow-400', image: 'https://images.unsplash.com/photo-1514222134-b57cbb8ce073?w=400&h=300&fit=crop&auto=format' },
  'gangtok': { emoji: '🏔️', emojiBg: 'bg-blue-400', image: 'https://images.unsplash.com/photo-1586016413664-864c0dd76f53?w=400&h=300&fit=crop&auto=format' },
  'chennai': { emoji: '🌊', emojiBg: 'bg-cyan-400', image: 'https://images.unsplash.com/photo-1582510003544-4d00b7f74220?w=400&h=300&fit=crop&auto=format' },
  'hyderabad': { emoji: '🕌', emojiBg: 'bg-rose-400', image: 'https://images.unsplash.com/photo-1563448927693-6e71c6a1d4a4?w=400&h=300&fit=crop&auto=format' },
  'agartala': { emoji: '🏛️', emojiBg: 'bg-amber-400', image: 'https://images.unsplash.com/photo-1576426863848-c21f53c60b19?w=400&h=300&fit=crop&auto=format' },
  'dehradun': { emoji: '🌲', emojiBg: 'bg-green-400', image: 'https://images.unsplash.com/photo-1606067048200-f81cf6c35dc5?w=400&h=300&fit=crop&auto=format' },
  'kolkata': { emoji: '🌉', emojiBg: 'bg-indigo-400', image: 'https://images.unsplash.com/photo-1558431382-27e303142255?w=400&h=300&fit=crop&auto=format' },
  'port blair': { emoji: '🏝️', emojiBg: 'bg-teal-400', image: 'https://images.unsplash.com/photo-1586016413664-864c0dd76f53?w=400&h=300&fit=crop&auto=format' },
  'chandigarh': { emoji: '🌳', emojiBg: 'bg-green-400', image: 'https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?w=400&h=300&fit=crop&auto=format' },
  'daman': { emoji: '🏖️', emojiBg: 'bg-blue-400', image: 'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=400&h=300&fit=crop&auto=format' },
  'new delhi': { emoji: '🏛️', emojiBg: 'bg-orange-400', image: 'https://images.unsplash.com/photo-1587474260584-136574528ed5?w=400&h=300&fit=crop&auto=format' },
  'delhi': { emoji: '🏛️', emojiBg: 'bg-orange-400', image: 'https://images.unsplash.com/photo-1587474260584-136574528ed5?w=400&h=300&fit=crop&auto=format' },
  'srinagar': { emoji: '🛶', emojiBg: 'bg-blue-400', image: 'https://images.unsplash.com/photo-1573408310015-a5f6b9c5b1eb?w=400&h=300&fit=crop&auto=format' },
  'leh': { emoji: '🏔️', emojiBg: 'bg-slate-400', image: 'https://images.unsplash.com/photo-1598091383021-15ddea10925d?w=400&h=300&fit=crop&auto=format' },
  'kavaratti': { emoji: '🏝️', emojiBg: 'bg-cyan-400', image: 'https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=400&h=300&fit=crop&auto=format' },
  'pondicherry': { emoji: '⛪', emojiBg: 'bg-pink-400', image: 'https://images.unsplash.com/photo-1582510003544-4d00b7f74220?w=400&h=300&fit=crop&auto=format' },
};

function getImageForDestination(name: string, index: number) {
  const key = name.toLowerCase();
  return DESTINATION_IMAGES[key]
    || Object.entries(DESTINATION_IMAGES).find(([k]) => key.includes(k) || k.includes(key))?.[1]
    || { emoji: '🗺️', emojiBg: 'bg-gray-400', image: `https://source.unsplash.com/400x300/?${encodeURIComponent(name)},india,tourism` };
}

const backendVisuals: Array<Pick<Destination, 'name' | 'rating' | 'reviews' | 'emoji' | 'emojiBg' | 'image'>> = [
  {
    name: 'Bhubaneswar',
    rating: 4.8,
    reviews: 'Backend',
    emoji: '🏛️',
    emojiBg: 'bg-orange-400',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5d/Lingaraj_Temple_%2C_Bhubaneswar.jpg/960px-Lingaraj_Temple_%2C_Bhubaneswar.jpg',
  },
  {
    name: 'Puri',
    rating: 4.7,
    reviews: 'Backend',
    emoji: '🌊',
    emojiBg: 'bg-cyan-400',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b7/Shri_Jagannath_temple.jpg/960px-Shri_Jagannath_temple.jpg',
  },
  {
    name: 'Konark',
    rating: 4.9,
    reviews: 'Backend',
    emoji: '☀️',
    emojiBg: 'bg-yellow-400',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/Konarka_Temple.jpg/960px-Konarka_Temple.jpg',
  },
  {
    name: 'Jaipur',
    rating: 4.7,
    reviews: 'Backend',
    emoji: '🏰',
    emojiBg: 'bg-orange-400',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/41/East_facade_Hawa_Mahal_Jaipur_from_ground_level_%28July_2022%29_-_img_01.jpg/960px-East_facade_Hawa_Mahal_Jaipur_from_ground_level_%28July_2022%29_-_img_01.jpg',
  },
  {
    name: 'Varanasi',
    rating: 4.9,
    reviews: 'Backend',
    emoji: '🕉️',
    emojiBg: 'bg-purple-400',
    image: 'https://images.unsplash.com/photo-1561361058-c24cecae35ca?w=400&h=300&fit=crop&auto=format',
  },
  {
    name: 'Agra',
    rating: 4.8,
    reviews: 'Backend',
    emoji: '🕌',
    emojiBg: 'bg-rose-400',
    image: 'https://images.unsplash.com/photo-1548013146-72479768bada?w=400&h=300&fit=crop&auto=format',
  },
  {
    name: 'Goa',
    rating: 4.6,
    reviews: 'Backend',
    emoji: '🏖️',
    emojiBg: 'bg-yellow-400',
    image: 'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=400&h=300&fit=crop&auto=format',
  },
  {
    name: 'Kerala',
    rating: 4.8,
    reviews: 'Backend',
    emoji: '🌴',
    emojiBg: 'bg-cyan-400',
    image: 'https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?w=400&h=300&fit=crop&auto=format',
  },
  {
    name: 'Manali',
    rating: 4.8,
    reviews: 'Demo',
    emoji: '🏔️',
    emojiBg: 'bg-teal-400',
    image: 'https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?w=400&h=300&fit=crop&auto=format',
  },
  {
    name: 'Darjeeling',
    rating: 4.7,
    reviews: 'Demo',
    emoji: '🚂',
    emojiBg: 'bg-green-400',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/96/DarjeelingTrainFruitshop_%282%29.jpg/960px-DarjeelingTrainFruitshop_%282%29.jpg',
  },
  {
    name: 'Mysore',
    rating: 4.6,
    reviews: 'Demo',
    emoji: '🐘',
    emojiBg: 'bg-amber-400',
    image: 'https://images.unsplash.com/photo-1533105079780-92b9be482077?w=400&h=300&fit=crop&auto=format',
  },
];

export function getDestinationVisual(name: string, index: number) {
  const visual = getImageForDestination(name, index);
  return {
    image: visual.image,
    emoji: visual.emoji,
    emojiBg: visual.emojiBg,
    rating: 4.7,
    reviews: 'Live',
    name,
  };
}

interface PopularDestinationsProps {
  destinations?: Destination[];
}

export const PopularDestinations: React.FC<PopularDestinationsProps> = ({
  destinations = defaultDestinations,
}) => {
  const [page, setPage] = useState(0);
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: apiDestinations = [] } = useQuery({
    queryKey: ['destinations'],
    queryFn: knowledgeApi.getDestinations,
  });
  const liveDestinations = apiDestinations.length > 0
    ? apiDestinations.map((destination, index) => {
        const visual = getDestinationVisual(destination.name, index);
        return {
          id: destination.id,
          name: destination.name,
          state: destination.region || destination.country,
          rating: visual.rating,
          reviews: knowledgeApi.isUsingFallbackData() ? 'Demo' : visual.reviews,
          emoji: visual.emoji,
          emojiBg: visual.emojiBg,
          image: visual.image,
        };
      })
    : destinations;
  const visible = 4;
  const totalPages = Math.ceil(liveDestinations.length / visible);
  const shown = liveDestinations.slice(page * visible, page * visible + visible);

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">{t('dashboard.popularDestinations', 'Popular Destinations')}</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t('dashboard.popularSubtitle', 'Most loved places across India')}</p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/explore')}
          className="flex items-center gap-1 text-green-600 hover:text-green-700 font-semibold text-sm transition-colors"
        >
          <span>{t('dashboard.viewAll', 'View All')}</span>
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="relative">
        <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-4 gap-4">
          {shown.map((dest) => (
            <div
              key={dest.id}
              onClick={() => navigate(`/destination/${dest.id}`)}
              className="bg-white dark:bg-gray-900 rounded-2xl overflow-hidden shadow-sm border border-gray-100 dark:border-gray-800 hover:shadow-2xl hover:-translate-y-2 hover:border-orange-200 transition-all duration-300 cursor-pointer group"
            >
              {/* Photo */}
              <div className="relative h-40 overflow-hidden">
                <img
                  src={dest.image}
                  alt={dest.name}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out"
                  onError={(e) => {
                    // fallback gradient if image fails
                    const el = e.currentTarget.parentElement!;
                    e.currentTarget.style.display = 'none';
                    el.style.background = 'linear-gradient(135deg, #fde68a, #fca5a5)';
                  }}
                />
                {/* Premium Hover Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-center p-4">
                  <span className="text-white font-semibold text-sm translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
                    View Budget & Info
                  </span>
                </div>
              </div>

              {/* Info */}
              <div className="p-3">
                <h3 className="font-bold text-gray-900 dark:text-white text-sm">{dest.name}</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{dest.state}</p>

              </div>
            </div>
          ))}
        </div>

        {/* Pagination dots */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-4">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 text-gray-600 dark:text-gray-400"
            >
              <ChevronLeft size={14} />
            </button>
            {Array.from({ length: totalPages }).map((_, i) => (
              <button
                key={i}
                onClick={() => setPage(i)}
                className={`w-2 h-2 rounded-full transition-all ${i === page ? 'bg-green-500 w-4' : 'bg-gray-300 dark:bg-gray-700'}`}
              />
            ))}
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page === totalPages - 1}
              className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 text-gray-600 dark:text-gray-400"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
