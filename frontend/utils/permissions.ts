import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import * as Notifications from 'expo-notifications';
import { Alert, Platform } from 'react-native';

export const requestLocationPermission = async (): Promise<boolean> => {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    return status === 'granted';
  } catch (error) {
    console.error('Error requesting location permission:', error);
    return false;
  }
};

export const requestCameraPermission = async (): Promise<boolean> => {
  try {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    return status === 'granted';
  } catch (error) {
    console.error('Error requesting camera permission:', error);
    return false;
  }
};

export const requestGalleryPermission = async (): Promise<boolean> => {
  try {
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      return status === 'granted';
    }
    return true; // Web doesn't need explicit permission
  } catch (error) {
    console.error('Error requesting gallery permission:', error);
    return false;
  }
};

export const requestNotificationPermission = async (): Promise<boolean> => {
  try {
    if (Platform.OS === 'web') {
      return true; // Web notifications handled differently
    }
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  } catch (error) {
    console.error('Error requesting notification permission:', error);
    return false;
  }
};

export const showPermissionDeniedAlert = (permissionType: string, message: string) => {
  Alert.alert(
    `${permissionType} Permission Denied`,
    message,
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Open Settings', onPress: () => {
        // Open app settings - platform specific
        if (Platform.OS === 'ios') {
          // Linking.openURL('app-settings:');
        } else if (Platform.OS === 'android') {
          // Linking.openSettings();
        }
      }},
    ]
  );
};
