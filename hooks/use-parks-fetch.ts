import { useCallback, useEffect, useRef, useState } from 'react';

import { findParksByProvince, type Park, type ParkType } from '@/services/google-maps';

export function useParksFetch(provinces: readonly string[], parkType: ParkType) {
  const [parks, setParks] = useState<Park[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const refetch = useCallback(async () => {
    const requestId = ++requestIdRef.current;
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

      if (requestId === requestIdRef.current) {
        setParks([...uniqueParks.values()]);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to fetch parks right now.';
      if (requestId === requestIdRef.current) {
        setErrorMessage(message);
        setParks([]);
      }
    } finally {
      if (requestId === requestIdRef.current) {
        setIsLoading(false);
      }
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

