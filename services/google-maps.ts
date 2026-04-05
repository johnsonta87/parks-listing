export type ParkType = 'all' | 'national' | 'provincial';

export type Park = {
  placeId: string;
  name: string;
  address: string;
  rating?: number;
  totalRatings?: number;
  location?: {
    lat: number;
    lng: number;
  };
  photoUrl?: string;
};

type ParksApiResponse = {
  parks?: Park[];
  error?: string;
};

export async function findParksByProvince(province: string, parkType: ParkType) {
  const params = new URLSearchParams({ province, parkType });
  const response = await fetch(`/api/parks?${params.toString()}`);

  if (!response.ok) {
    throw new Error(`Google Maps request failed with HTTP ${response.status}.`);
  }

  const payload = (await response.json()) as ParksApiResponse;

  if (!response.ok) {
    throw new Error(payload.error ?? `Parks API request failed with HTTP ${response.status}.`);
  }

  return payload.parks ?? [];
}

