import Purchases, { LOG_LEVEL } from 'react-native-purchases';
import { Platform } from 'react-native';

const getApiKey = () => {
  if (Platform.OS === 'ios') {
    return process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY!;
  }
  return process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY!;
};

export const initializePurchases = (userId: string) => {
  Purchases.setLogLevel(LOG_LEVEL.DEBUG);
  Purchases.configure({
    apiKey: getApiKey(),
    appUserID: userId,
  });
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
