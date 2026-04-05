import { useCallback, useEffect, useState } from 'react';

import { findParksByProvince, type Park, type ParkType } from '@/services/google-maps';

export function useParksFetch(provinces: readonly string[], parkType: ParkType) {
  const [parks, setParks] = useState<Park[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const resultsByProvince = await Promise.all(
        provinces.map((province) => findParksByProvince(province, parkType))
      );

      // Merge and deduplicate by placeId
      const uniqueParks = new Map<string, Park>();

      for (const results of resultsByProvince) {
        for (const park of results) {
          uniqueParks.set(park.placeId, park);
        }
      }

      setParks([...uniqueParks.values()]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to fetch parks right now.';
      setErrorMessage(message);
      setParks([]);
    } finally {
      setIsLoading(false);
    }
  }, [parkType, provinces]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return {
    parks,
    isLoading,
    errorMessage,
    refetch,
  };
}

