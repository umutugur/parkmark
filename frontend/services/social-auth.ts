import { Platform } from 'react-native';
import { GoogleSignin, isSuccessResponse } from '@react-native-google-signin/google-signin';
import * as AppleAuthentication from 'expo-apple-authentication';

export const configureGoogleSignIn = () => {
  GoogleSignin.configure({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    ...(Platform.OS === 'ios'
      ? { iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID }
      : { androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID }),
    offlineAccess: false,
  });
};

export interface OAuthResult {
  idToken: string;
  name: string;
  email: string;
}

export const signInWithGoogle = async (): Promise<OAuthResult> => {
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const response = await GoogleSignin.signIn();

  if (!isSuccessResponse(response)) {
    throw new Error('Google sign-in cancelled');
  }

  const { idToken, user } = response.data;

  if (!idToken) {
    throw new Error('No ID token from Google');
  }

  return {
    idToken,
    name: user.name || user.givenName || '',
    email: user.email,
  };
};

export const signInWithApple = async (): Promise<OAuthResult> => {
  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
  });

  if (!credential.identityToken) {
    throw new Error('No identity token from Apple');
  }

  const firstName = credential.fullName?.givenName || '';
  const lastName = credential.fullName?.familyName || '';
  const name = [firstName, lastName].filter(Boolean).join(' ');

  return {
    idToken: credential.identityToken,
    name,
    email: credential.email || '',
  };
};

export const isAppleSignInAvailable = async (): Promise<boolean> => {
  if (Platform.OS !== 'ios') return false;
  return AppleAuthentication.isAvailableAsync();
};
