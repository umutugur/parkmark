import Purchases, { LOG_LEVEL } from 'react-native-purchases';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Expo Go'da veya development ortamında RevenueCat native store'a erişemez
const isExpoGo = Constants.appOwnership === 'expo';

const getApiKey = (): string | null => {
  // Platform-specific keys take priority, fall back to shared key
  if (Platform.OS === 'ios') {
    return (
      process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY ||
      process.env.EXPO_PUBLIC_REVENUECAT_API_KEY ||
      null
    );
  }
  return (
    process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY ||
    process.env.EXPO_PUBLIC_REVENUECAT_API_KEY ||
    null
  );
};

export const initializePurchases = (userId: string) => {
  // Expo Go ve simulator/dev build'de StoreKit erişilemez — atla
  if (isExpoGo || __DEV__) {
    console.log('[Purchases] Dev/Expo Go — RevenueCat atlandı');
    return;
  }
  try {
    const apiKey = getApiKey();
    if (!apiKey) {
      console.warn('[Purchases] RevenueCat API key bulunamadı — abonelik devre dışı');
      return;
    }
    Purchases.setLogLevel(LOG_LEVEL.DEBUG);
    Purchases.configure({
      apiKey,
      appUserID: userId,
    });
  } catch (error) {
    // RevenueCat başlatma hatası login akışını engellememeli
    console.warn('[Purchases] initializePurchases hatası:', error);
  }
};

export const getOfferings = async () => {
  const offerings = await Purchases.getOfferings();
  return offerings.current;
};

export const purchasePackage = async (pkg: any) => {
  const { customerInfo } = await Purchases.purchasePackage(pkg);
  return customerInfo;
};

export const restorePurchases = async () => {
  const customerInfo = await Purchases.restorePurchases();
  return customerInfo;
};
