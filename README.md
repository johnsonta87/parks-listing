# Parks Finder

Expo app that finds national and provincial parks in Canadian provinces using the Google Maps Places API.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create your environment file:

```bash
cp .env.local .env
```

3. Set `GOOGLE_MAPS_API_KEY` in `.env`.

4. In Google Cloud, enable at least:
- Places API

5. Start the app:

```bash
npx expo start
```

## How it works

- The home screen in `app/(tabs)/index.tsx` lets you choose a province and park type.
- The app calls `findParksByProvince` in `services/google-maps.ts`.
- The client requests `GET /api/parks` (Expo Router API route in `app/api/parks+api.ts`).
- The API route calls Google Places Text Search, merges `national` and `provincial` queries for `all`, and returns deduped/sorted parks.
- Tapping a result opens that park in Google Maps.

## Notes

- The Google key is server-side only to avoid exposing it in the browser bundle.
- Keep your key restricted in Google Cloud (IP/API restrictions for web server usage).
