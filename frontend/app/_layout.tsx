import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { ErrorBoundary } from '../components/ui/ErrorBoundary';
import { initI18n } from '../config/i18n';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import Constants from 'expo-constants';
import { configureGoogleSignIn } from '../services/social-auth';

const isExpoGo = Constants.appOwnership === 'expo';
if (!isExpoGo) {
  const { default: MobileAds } = require('react-native-google-mobile-ads');
  MobileAds().initialize();
  configureGoogleSignIn();
}

// Prevent splash screen from auto-hiding
SplashScreen.preventAutoHideAsync();

function RootLayoutContent() {
  const { isLoading } = useAuth();
  const [fontsLoaded] = useFonts({
    'Poppins-Regular': require('../assets/fonts/Poppins-Regular.ttf'),
    'Poppins-Medium': require('../assets/fonts/Poppins-Medium.ttf'),
    'Poppins-SemiBold': require('../assets/fonts/Poppins-SemiBold.ttf'),
    'Poppins-Bold': require('../assets/fonts/Poppins-Bold.ttf'),
    'NunitoSans-Regular': require('../assets/fonts/NunitoSans-Regular.ttf'),
    'NunitoSans-Medium': require('../assets/fonts/NunitoSans-Medium.ttf'),
  });

  useEffect(() => {
    if (fontsLoaded && !isLoading) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, isLoading]);

  if (!fontsLoaded || isLoading) {
    return null; // Keep splash screen visible
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="auth/onboarding" />
      <Stack.Screen name="auth/login" />
      <Stack.Screen name="home/index" />
      <Stack.Screen name="home/save-parking" />
      <Stack.Screen name="home/history" />
      <Stack.Screen name="home/parking/[id]" />
      <Stack.Screen name="home/settings" />
    </Stack>
  );
}

export default function RootLayout() {
  useEffect(() => {
    initI18n();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ErrorBoundary>
        <AuthProvider>
          <RootLayoutContent />
        </AuthProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}
