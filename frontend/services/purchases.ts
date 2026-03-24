import Purchases, { LOG_LEVEL } from 'react-native-purchases';

export const initializePurchases = (userId: string) => {
  Purchases.setLogLevel(LOG_LEVEL.DEBUG);
  Purchases.configure({
    apiKey: process.env.EXPO_PUBLIC_REVENUECAT_API_KEY!,
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
