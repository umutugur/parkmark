import * as Location from 'expo-location';

export const getCurrentLocation = async (): Promise<{
  latitude: number;
  longitude: number;
} | null> => {
  try {
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    return {
      latitude: location?.coords?.latitude ?? 0,
      longitude: location?.coords?.longitude ?? 0,
    };
  } catch (error) {
    console.error('Error getting current location:', error);
    return null;
  }
};

export const reverseGeocode = async (
  latitude: number,
  longitude: number
): Promise<string | null> => {
  try {
    const addresses = await Location.reverseGeocodeAsync({ latitude, longitude });
    const address = addresses?.[0];
    if (!address) return null;

    const parts = [
      address?.name,
      address?.street,
      address?.district,
      address?.city,
      address?.region,
      address?.country,
    ].filter(Boolean);

    return parts.join(', ') || null;
  } catch (error) {
    console.error('Error reverse geocoding:', error);
    return null;
  }
};

export const openMapApp = (latitude: number, longitude: number, label?: string) => {
  const scheme = Platform.select({
    ios: 'maps:0,0?q=',
    android: 'geo:0,0?q=',
    default: 'https://www.google.com/maps/search/?api=1&query=',
  });

  const latLng = `${latitude},${longitude}`;
  const url = Platform.select({
    ios: `${scheme}${label ?? 'Parking'}@${latLng}`,
    android: `${scheme}${latLng}(${label ?? 'Parking'})`,
    default: `${scheme}${latLng}`,
  });

  if (url) {
    Linking.openURL(url).catch(err => console.error('Error opening map:', err));
  }
};

import { Platform, Linking } from 'react-native';
