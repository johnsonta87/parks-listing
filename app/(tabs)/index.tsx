import { Image } from 'expo-image';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  useWindowDimensions,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useParksFetch } from '@/hooks/use-parks-fetch';
import { useThemeColor } from '@/hooks/use-theme-color';
import type { Park, ParkType } from '@/services/google-maps';

const PROVINCES = [
  'Alberta',
  'British Columbia',
  'Manitoba',
  'New Brunswick',
  'Newfoundland and Labrador',
  'Nova Scotia',
  'Ontario',
  'Prince Edward Island',
  'Quebec',
  'Saskatchewan',
  'Northwest Territories',
  'Nunavut',
  'Yukon',
] as const;

const PARK_FILTERS: { value: ParkType; label: string }[] = [
  { value: 'national', label: 'National' },
  { value: 'provincial', label: 'Provincial' },
];

const PARKS_PER_PAGE = 10;

const toggleFilterLogic = (
  value: 'national' | 'provincial',
  current: Record<'national' | 'provincial', boolean>
): Record<'national' | 'provincial', boolean> => {
  const nextValue = !current[value];
  const otherValue = value === 'national' ? current.provincial : current.national;

  // Keep at least one filter selected so the query always maps to a valid ParkType.
  if (!nextValue && !otherValue) {
    return current;
  }

  return {
    ...current,
    [value]: nextValue,
  };
};

const isNationalLabeledPark = (park: Park) => {
  // In national-only mode, show only parks explicitly labeled as national.
  return /\bnational\b/i.test(`${park.name} ${park.address}`);
};

export default function HomeScreen() {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  const inputTextColor = useThemeColor({}, 'text');
  const inputBgColor = useThemeColor({}, 'background');

  const [selectedProvince, setSelectedProvince] = useState<typeof PROVINCES[number]>('Ontario');
  const [isProvinceDropdownOpen, setIsProvinceDropdownOpen] = useState(false);
  const [cityFilter, setCityFilter] = useState('');
  const [selectedFilters, setSelectedFilters] = useState<Record<'national' | 'provincial', boolean>>({
    national: true,
    provincial: true,
  });
  const [currentPage, setCurrentPage] = useState(1);

  const selectedFilter = useMemo<ParkType>(() => {
    if (selectedFilters.national && selectedFilters.provincial) {
      return 'all';
    }

    return selectedFilters.national ? 'national' : 'provincial';
  }, [selectedFilters.national, selectedFilters.provincial]);

  const selectedProvinces = useMemo(() => [selectedProvince], [selectedProvince]);

  const { parks, isLoading, errorMessage } = useParksFetch(selectedProvinces, selectedFilter);

  const visibleParks = useMemo(() => {
    let filtered = parks;

    if (selectedFilter === 'national') {
      filtered = filtered.filter((park) => isNationalLabeledPark(park));
    }

    if (cityFilter.trim()) {
      const normalizedCity = cityFilter.trim().toLowerCase();
      filtered = filtered.filter(
        (park) =>
          park.address.toLowerCase().includes(normalizedCity) ||
          park.name.toLowerCase().includes(normalizedCity)
      );
    }

    return filtered;
  }, [parks, selectedFilter, cityFilter]);

  // Reset to page 1 when province, filters, or city changes
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedProvince, selectedFilter, cityFilter]);

  // Calculate pagination values
  const totalPages = Math.ceil(visibleParks.length / PARKS_PER_PAGE);
  const startIndex = (currentPage - 1) * PARKS_PER_PAGE;
  const endIndex = startIndex + PARKS_PER_PAGE;
  const paginatedParks = visibleParks.slice(startIndex, endIndex);

  const goToPreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const goToNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  // Calculate display info
  const showNoParkMessage = !isLoading && !errorMessage && visibleParks.length === 0;
  const showParkCards = !isLoading && !errorMessage && visibleParks.length > 0;
  const showPaginationControls = showParkCards;

  const selectProvince = (province: typeof PROVINCES[number]) => {
    setSelectedProvince(province);
    setIsProvinceDropdownOpen(false);
  };

  const toggleFilter = (value: 'national' | 'provincial') => {
    setSelectedFilters((current) => toggleFilterLogic(value, current));
  };

  const openInMaps = async (park: Park) => {
    const query = encodeURIComponent(park.name);
    const url = park.placeId
      ? `https://www.google.com/maps/search/?api=1&query=${query}&query_place_id=${park.placeId}`
      : `https://www.google.com/maps/search/?api=1&query=${query}`;

    await Linking.openURL(url);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.containerContent}>
      <ThemedView style={styles.titleContainer}>
        <ThemedText type="title">Parks Finder</ThemedText>
      </ThemedView>

      <ThemedView style={[styles.mainContainer, isMobile && styles.mainContainerMobile]}>
        {/* Left Column - Filters */}
        <ThemedView style={[styles.leftColumn, isMobile && styles.leftColumnMobile]}>
          <ThemedView style={styles.section}>
            <ThemedText type="subtitle">Province</ThemedText>
            <ThemedView style={styles.dropdownContainer}>
              <Pressable
                accessibilityRole="button"
                onPress={() => setIsProvinceDropdownOpen((current) => !current)}
                style={styles.dropdownTrigger}>
                <ThemedText style={styles.dropdownTriggerText}>{selectedProvince}</ThemedText>
                <ThemedText style={styles.dropdownIcon}>{isProvinceDropdownOpen ? '^' : 'v'}</ThemedText>
              </Pressable>

              {isProvinceDropdownOpen ? (
                <ScrollView style={styles.dropdownMenu} nestedScrollEnabled>
                  {PROVINCES.map((province) => {
                    const selected = selectedProvince === province;

                    return (
                      <Pressable
                        key={province}
                        accessibilityRole="button"
                        onPress={() => selectProvince(province)}
                        style={[styles.dropdownOption, selected && styles.dropdownOptionSelected]}>
                        <ThemedText style={[styles.filterText, selected && styles.dropdownOptionSelectedText]}>
                          {province}
                        </ThemedText>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              ) : null}
            </ThemedView>
          </ThemedView>

          <ThemedView style={styles.section}>
            <ThemedText type="subtitle">City</ThemedText>
            <TextInput
              style={[styles.cityInput, { color: inputTextColor, backgroundColor: inputBgColor }]}
              placeholder="Filter by city…"
              placeholderTextColor="#9AA3AA"
              value={cityFilter}
              onChangeText={setCityFilter}
              clearButtonMode="while-editing"
              autoCorrect={false}
              autoCapitalize="words"
            />
          </ThemedView>

          <ThemedView style={styles.section}>
            <ThemedText type="subtitle">Park type</ThemedText>
            <ThemedView style={styles.filterRow}>
              {PARK_FILTERS.map((filter) => {
                const selected = selectedFilters[filter.value as 'national' | 'provincial'];

                return (
                  <Pressable
                    key={filter.value}
                    onPress={() => toggleFilter(filter.value as 'national' | 'provincial')}
                    style={styles.checkboxRow}>
                    <ThemedView style={[styles.checkbox, selected && styles.checkboxChecked]} />
                    <ThemedText style={styles.filterText}>{filter.label}</ThemedText>
                  </Pressable>
                );
              })}
            </ThemedView>
          </ThemedView>
        </ThemedView>

        {/* Right Column - Listings */}
        <ThemedView style={[styles.rightColumn, isMobile && styles.rightColumnMobile]}>
          <ThemedView style={styles.section}>
            {isLoading ? <ActivityIndicator size="small" /> : null}

            {errorMessage ? <ThemedText style={styles.errorText}>{errorMessage}</ThemedText> : null}

            {showNoParkMessage ? (
              <ThemedText>No parks found for this province and filter.</ThemedText>
            ) : null}

            {showParkCards
              ? paginatedParks.map((park) => (
                  <ThemedView key={park.placeId ?? park.name} style={[styles.parkCard, isMobile && styles.parkCardMobile]}>
                    {park.photoUrl ? (
                      <Image source={{ uri: park.photoUrl }} style={[styles.parkImage, isMobile && styles.parkImageMobile]} />
                    ) : null}
                    <ThemedView style={styles.parkCardContent}>
                      <ThemedText type="defaultSemiBold" style={styles.parkName}>
                        {park.name}
                      </ThemedText>
                      <ThemedText style={styles.parkAddress}>{park.address}</ThemedText>
                      {park.rating ? (
                        <ThemedText style={styles.parkRating}>
                          Rating: {park.rating}
                          {park.totalRatings ? ` (${park.totalRatings} reviews)` : ''}
                        </ThemedText>
                      ) : null}
                      <Pressable
                        accessibilityRole="link"
                        accessibilityLabel={`Open ${park.name} in Google Maps`}
                        onPress={() => void openInMaps(park)}>
                        <ThemedText style={styles.parkMapLinkText}>Click to view in google maps</ThemedText>
                      </Pressable>
                    </ThemedView>
                  </ThemedView>
                ))
              : null}

            {showPaginationControls ? (
              <ThemedView style={styles.paginationControls}>
                <Pressable
                  accessibilityRole="button"
                  onPress={goToPreviousPage}
                  disabled={currentPage === 1}
                  style={[styles.paginationButton, currentPage === 1 && styles.paginationButtonDisabled]}>
                  <ThemedText style={[styles.paginationButtonText, currentPage === 1 && styles.paginationButtonTextDisabled]}>
                    ← Previous
                  </ThemedText>
                </Pressable>

                <ThemedText style={styles.pageIndicator}>
                  Page {currentPage} of {totalPages}
                </ThemedText>

                <Pressable
                  accessibilityRole="button"
                  onPress={goToNextPage}
                  disabled={currentPage === totalPages}
                  style={[styles.paginationButton, currentPage === totalPages && styles.paginationButtonDisabled]}>
                  <ThemedText style={[styles.paginationButtonText, currentPage === totalPages && styles.paginationButtonTextDisabled]}>
                    Next →
                  </ThemedText>
                </Pressable>
              </ThemedView>
            ) : null}
          </ThemedView>
        </ThemedView>
      </ThemedView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 32,
  },
  containerContent: {
    alignItems: 'center',
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 24,
  },
  mainContainer: {
    flexDirection: 'row',
    gap: 16,
    width: '100%',
    padding: 32,
  },
  leftColumn: {
    flex: 1,
    paddingRight: 8,
  },
  rightColumn: {
    flex: 3,
    paddingLeft: 8,
  },
  section: {
    gap: 10,
    marginBottom: 10,
  },
  dropdownContainer: {
    gap: 8,
  },
  dropdownTrigger: {
    borderWidth: 1,
    borderColor: '#B4BDC3',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dropdownTriggerText: {
    fontSize: 15,
  },
  dropdownIcon: {
    fontSize: 14,
  },
  dropdownMenu: {
    borderWidth: 1,
    borderColor: '#D6DCE1',
    borderRadius: 8,
    maxHeight: 220,
  },
  dropdownOption: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
   dropdownOptionSelected: {
     backgroundColor: '#E6F4F8',
   },
   dropdownOptionSelectedText: {
     color: '#000000',
   },
  filterRow: {
    flexDirection: 'column',
    gap: 10,
  },
  checkboxRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  checkbox: {
    borderColor: '#B4BDC3',
    borderRadius: 4,
    borderWidth: 1,
    height: 20,
    width: 20,
  },
  checkboxChecked: {
    backgroundColor: '#0A7EA4',
    borderColor: '#0A7EA4',
  },
  filterText: {
    fontSize: 15,
  },
  cityInput: {
    borderWidth: 1,
    borderColor: '#B4BDC3',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 15,
  },
  filterTextSelected: {
    color: '#FFFFFF',
    fontSize: 14,
  },
  searchButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#0A7EA4',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  searchButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  parkCard: {
    padding: 12,
    gap: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  parkImage: {
    width: 350,
    height: 250,
    borderRadius: 4,
  },
  parkCardContent: {
    flex: 1,
    gap: 4,
  },
  parkName: {
    flexShrink: 1,
  },
  parkAddress: {
    flexShrink: 1,
  },
  parkRating: {
    flexShrink: 1,
  },
  parkMapLinkText: {
    color: '#0A7EA4',
    fontWeight: '600',
    marginTop: 8,
    textDecorationLine: 'underline',
  },
  errorText: {
    color: '#B42318',
  },
  paginationInfo: {
    fontSize: 13,
    marginBottom: 8,
  },
  paginationControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    gap: 8,
  },
  paginationButton: {
    backgroundColor: '#0A7EA4',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flex: 1,
  },
  paginationButtonDisabled: {
    backgroundColor: '#D6DCE1',
    opacity: 0.5,
  },
  paginationButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    textAlign: 'center',
  },
  paginationButtonTextDisabled: {
    color: '#999999',
  },
  pageIndicator: {
    fontWeight: '600',
    fontSize: 14,
  },
  reactLogo: {
    height: 178,
    width: 290,
    bottom: 0,
    left: 0,
    position: 'absolute',
  },
  mainContainerMobile: {
    flexDirection: 'column',
    gap: 16,
  },
  leftColumnMobile: {
    flex: 'auto' as any,
    paddingRight: 0,
    paddingBottom: 0,
  },
  rightColumnMobile: {
    flex: 'auto' as any,
    paddingLeft: 0,
  },
  parkCardMobile: {
    flexDirection: 'column',
    paddingTop: 12,
    paddingBottom: 0,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  parkImageMobile: {
    width: '100%',
    height: 200,
    marginBottom: 12,
  },
});
