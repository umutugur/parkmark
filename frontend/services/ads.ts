import Constants from 'expo-constants';
import { Platform } from 'react-native';

const isExpoGo = Constants.appOwnership === 'expo';
const adsModule = isExpoGo ? null : require('react-native-google-mobile-ads');

const BANNER_AD_UNIT_ID: string = isExpoGo ? '' : (
  __DEV__
    ? adsModule.TestIds.BANNER
    : (Platform.OS === 'ios'
        ? process.env.EXPO_PUBLIC_ADMOB_IOS_BANNER_ID!
        : process.env.EXPO_PUBLIC_ADMOB_ANDROID_BANNER_ID!)
);

const REWARDED_AD_UNIT_ID: string = isExpoGo ? '' : (
  __DEV__
    ? adsModule.TestIds.REWARDED
    : (Platform.OS === 'ios'
        ? process.env.EXPO_PUBLIC_ADMOB_IOS_REWARDED_ID!
        : process.env.EXPO_PUBLIC_ADMOB_ANDROID_REWARDED_ID!)
);

export { BANNER_AD_UNIT_ID, REWARDED_AD_UNIT_ID };

export const loadRewardedAd = () => {
  if (isExpoGo || !adsModule) return null;
  return adsModule.RewardedAd.createForAdRequest(REWARDED_AD_UNIT_ID);
};
