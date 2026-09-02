import type { Prisma } from '@prisma/client';

export type SelectedHotelSnapshot = Record<string, unknown> & {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  savedAt?: string;
  selectedOffer?: Record<string, unknown> | null;
};

export function selectedHotelFromSnapshot(snapshot: Prisma.JsonValue | null | undefined): SelectedHotelSnapshot | null {
  const selected = objectValue(objectValue(snapshot)?.selectedHotel);
  if (!selected || typeof selected.id !== 'string' || typeof selected.name !== 'string') return null;
  if (typeof selected.latitude !== 'number' || typeof selected.longitude !== 'number') return null;
  return selected as SelectedHotelSnapshot;
}

export function withSelectedHotel(
  snapshot: Prisma.JsonValue | null | undefined,
  hotel: Record<string, unknown>,
  offer?: Record<string, unknown>,
  savedAt = new Date().toISOString(),
) {
  return {
    ...(objectValue(snapshot) ?? {}),
    selectedHotel: {
      ...hotel,
      selectedOffer: offer ?? null,
      savedAt,
    },
  };
}

export function withoutSelectedHotel(snapshot: Prisma.JsonValue | null | undefined) {
  const copy = { ...(objectValue(snapshot) ?? {}) };
  delete copy.selectedHotel;
  return copy;
}

export function accommodationAmountFromSelectedHotel(snapshot: Prisma.JsonValue | null | undefined): number | null {
  const hotel = selectedHotelFromSnapshot(snapshot);
  const offer = objectValue(hotel?.selectedOffer);
  const pricing = objectValue(hotel?.pricing);
  return numberValue(offer?.totalAmount) ?? numberValue(offer?.totalPrice) ?? numberValue(pricing?.totalAmount) ?? null;
}

function objectValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function numberValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return null;
}
