import type { Park, ParkType } from '@/services/google-maps';

const GOOGLE_PLACES_TEXT_SEARCH_ENDPOINT =
  'https://maps.googleapis.com/maps/api/place/textsearch/json';

// Province bounding boxes (approximate coordinates)
const PROVINCE_BOUNDS: Record<string, { minLat: number; maxLat: number; minLng: number; maxLng: number }> = {
  'Alberta': { minLat: 49.0, maxLat: 60.0, minLng: -120.0, maxLng: -110.0 },
  'British Columbia': { minLat: 49.0, maxLat: 60.0, minLng: -139.0, maxLng: -114.0 },
  'Manitoba': { minLat: 49.0, maxLat: 60.5, minLng: -102.0, maxLng: -95.0 },
  'New Brunswick': { minLat: 45.0, maxLat: 47.8, minLng: -67.5, maxLng: -64.0 },
  'Newfoundland and Labrador': { minLat: 47.0, maxLat: 60.5, minLng: -63.0, maxLng: -52.0 },
  'Northwest Territories': { minLat: 60.0, maxLat: 83.0, minLng: -141.0, maxLng: -60.0 },
  'Nova Scotia': { minLat: 43.5, maxLat: 47.0, minLng: -66.0, maxLng: -59.5 },
  'Nunavut': { minLat: 60.0, maxLat: 83.0, minLng: -141.0, maxLng: -60.0 },
  'Ontario': { minLat: 41.7, maxLat: 56.9, minLng: -95.2, maxLng: -74.3 },
  'Prince Edward Island': { minLat: 45.9, maxLat: 47.1, minLng: -64.5, maxLng: -61.9 },
  'Quebec': { minLat: 45.0, maxLat: 63.0, minLng: -79.0, maxLng: -57.0 },
  'Saskatchewan': { minLat: 49.0, maxLat: 60.0, minLng: -110.0, maxLng: -102.0 },
  'Yukon': { minLat: 60.0, maxLat: 69.5, minLng: -141.0, maxLng: -124.0 },
};


type GooglePlacesTextSearchResult = {
  place_id: string;
  name: string;
  formatted_address: string;
  rating?: number;
  user_ratings_total?: number;
  geometry?: {
    location?: {
      lat: number;
      lng: number;
    };
  };
  photos?: {
    photo_reference: string;
  }[];
};

type GooglePlacesTextSearchResponse = {
  status: string;
  error_message?: string;
  results: GooglePlacesTextSearchResult[];
};

function getApiKey() {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    throw new Error('Missing Google Maps API key. Add GOOGLE_MAPS_API_KEY to your environment.');
  }

  return apiKey;
}

function isParkType(value: string | null): value is ParkType {
  return value === 'all' || value === 'national' || value === 'provincial';
}

function buildQueries(province: string, parkType: ParkType) {
  if (parkType === 'all') {
    return [
      `national park in ${province}, Canada`,
      `provincial park in ${province}, Canada`,
    ];
  }

  return [`${parkType} park in ${province}, Canada`];
}

function buildPhotoUrl(photoReference: string, apiKey: string): string {
  return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${photoReference}&key=${apiKey}`;
}

async function searchParksByQuery(query: string, apiKey: string) {
  const url = `${GOOGLE_PLACES_TEXT_SEARCH_ENDPOINT}?query=${encodeURIComponent(query)}&region=ca&key=${apiKey}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Google Maps request failed with HTTP ${response.status}.`);
  }

  const payload = (await response.json()) as GooglePlacesTextSearchResponse;

  if (payload.status === 'ZERO_RESULTS') {
    return [];
  }

  if (payload.status !== 'OK') {
    throw new Error(payload.error_message ?? `Google Maps API returned status: ${payload.status}`);
  }

  return payload.results;
}

function isWithinProvinceBounds(location: { lat: number; lng: number } | undefined, province: string): boolean {
  if (!location) return true; // If no location data, include the result

  const bounds = PROVINCE_BOUNDS[province];
  if (!bounds) return true; // If province not in bounds map, include the result

  const { lat, lng } = location;
  return (
    lat >= bounds.minLat &&
    lat <= bounds.maxLat &&
    lng >= bounds.minLng &&
    lng <= bounds.maxLng
  );
}

function normalizeAndSortParks(resultsByQuery: GooglePlacesTextSearchResult[][], apiKey: string, province: string): Park[] {
  const uniqueParks = new Map<string, Park>();

  for (const resultSet of resultsByQuery) {
    for (const park of resultSet) {
      // Filter out parks that are outside the province bounds
      if (!isWithinProvinceBounds(park.geometry?.location, province)) {
        continue;
      }

      const photoUrl = park.photos?.[0]
        ? buildPhotoUrl(park.photos[0].photo_reference, apiKey)
        : undefined;

      uniqueParks.set(park.place_id, {
        placeId: park.place_id,
        name: park.name,
        address: park.formatted_address,
        rating: park.rating,
        totalRatings: park.user_ratings_total,
        location: park.geometry?.location,
        photoUrl,
      });
    }
  }

  return [...uniqueParks.values()].sort((a, b) => {
    const ratingA = a.rating ?? 0;
    const ratingB = b.rating ?? 0;

    if (ratingA === ratingB) {
      return a.name.localeCompare(b.name);
    }

    return ratingB - ratingA;
  });
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const province = searchParams.get('province')?.trim();
    const parkTypeParam = searchParams.get('parkType');

    if (!province) {
      return Response.json({ error: 'Missing required query parameter: province.' }, { status: 400 });
    }

    if (!isParkType(parkTypeParam)) {
      return Response.json(
        { error: 'Invalid parkType. Expected one of: all, national, provincial.' },
        { status: 400 }
      );
    }

    const apiKey = getApiKey();
    const queries = buildQueries(province, parkTypeParam);
    const resultsByQuery = await Promise.all(queries.map((query) => searchParksByQuery(query, apiKey)));
    const parks = normalizeAndSortParks(resultsByQuery, apiKey, province);

    return Response.json({ parks });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to fetch parks right now.';
    return Response.json({ error: message }, { status: 500 });
  }
}

