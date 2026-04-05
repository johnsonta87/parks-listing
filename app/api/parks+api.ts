import type { Park, ParkType } from '@/services/google-maps';

const GOOGLE_PLACES_TEXT_SEARCH_ENDPOINT =
  'https://maps.googleapis.com/maps/api/place/textsearch/json';


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

function normalizeAndSortParks(resultsByQuery: GooglePlacesTextSearchResult[][], apiKey: string): Park[] {
  const uniqueParks = new Map<string, Park>();

  for (const resultSet of resultsByQuery) {
    for (const park of resultSet) {
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
    const parks = normalizeAndSortParks(resultsByQuery, apiKey);

    return Response.json({ parks });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to fetch parks right now.';
    return Response.json({ error: message }, { status: 500 });
  }
}

