import { useEffect } from 'react';
import { View, StyleSheet, Image, Text, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { Colors, FontSizes, FontWeights } from '../constants/theme';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';

export default function SplashScreen() {
  const router = useRouter();
  const { token, isLoading, isGuest, isOnboardingCompleted } = useAuth();
  const { t } = useTranslation();
  const fadeAnim = new Animated.Value(0);

  useEffect(() => {
    // Sadece fade-in — scale bounce native splash'ten sonra "yarım logo" görünümüne yol açıyordu
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();

    // Navigate after animation
    const timer = setTimeout(() => {
      if (!isLoading) {
        if (token || isGuest) {
          router.replace('/home');
        } else if (!isOnboardingCompleted) {
          router.replace('/auth/onboarding');
        } else {
          router.replace('/auth/login');
        }
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [token, isLoading, isGuest, isOnboardingCompleted]);

  return (
    <LinearGradient
      colors={[Colors.bgDeep, Colors.bgPrimary]}
      style={styles.container}
    >
      <Animated.View
        style={[
          styles.logoContainer,
          { opacity: fadeAnim },
        ]}
      >
        <Image
          source={require('../assets/images/icon.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.title}>{t('common.appName')}</Text>
        <Text style={styles.tagline}>{t('common.tagline')}</Text>
      </Animated.View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    alignItems: 'center',
  },
  logo: {
    width: 120,
    height: 120,
    marginBottom: 24,
  },
  title: {
    fontSize: 36,
    fontWeight: FontWeights.bold,
    color: Colors.primary,
    marginBottom: 8,
    fontFamily: 'Poppins-Bold',
  },
  tagline: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontFamily: 'NunitoSans-Regular',
  },
});
