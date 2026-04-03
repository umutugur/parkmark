import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';

/**
 * Kullanıcının giriş yapıp yapmadığını kontrol eder.
 * Guest modundaki veya token'ı olmayan kullanıcıları login'e yönlendirir.
 *
 * Kullanım:
 *   const { requireAuth } = useAuthGuard();
 *   <Button onPress={() => requireAuth(() => router.push('/home/save-parking'))} />
 */
export const useAuthGuard = () => {
  const { token, isGuest } = useAuth();
  const router = useRouter();
  const { t } = useTranslation();

  const isAuthenticated = !!token && !isGuest;

  const requireAuth = (action?: () => void) => {
    if (isAuthenticated) {
      action?.();
      return;
    }

    Alert.alert(
      t('auth.guestTitle'),
      t('auth.guestMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('auth.signInNow'),
          onPress: () => router.push('/auth/login'),
        },
      ]
    );
  };

  return { requireAuth, isAuthenticated, isGuest };
};
