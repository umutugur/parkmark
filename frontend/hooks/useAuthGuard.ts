import { useState } from 'react';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { AppModalProps } from '../components/ui/AppModal';

/**
 * Kullanıcının giriş yapıp yapmadığını kontrol eder.
 * Guest modundaki veya token'ı olmayan kullanıcıları login'e yönlendirir.
 *
 * Kullanım:
 *   const { requireAuth, modalProps, hideModal } = useAuthGuard();
 *   // JSX'te <AppModal {...modalProps} onClose={hideModal} /> ekle
 *   <Button onPress={() => requireAuth(() => router.push('/home/save-parking'))} />
 */
export const useAuthGuard = () => {
  const { token, isGuest } = useAuth();
  const router = useRouter();
  const { t } = useTranslation();
  const [modal, setModal] = useState<Omit<AppModalProps, 'onClose'>>({ visible: false });

  const isAuthenticated = !!token && !isGuest;

  const requireAuth = (action?: () => void) => {
    if (isAuthenticated) {
      action?.();
      return;
    }

    setModal({
      visible: true,
      title: t('auth.guestTitle'),
      message: t('auth.guestMessage'),
      buttons: [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('auth.signInNow'),
          onPress: () => router.push('/auth/login'),
        },
      ],
    });
  };

  const hideModal = () => setModal((m) => ({ ...m, visible: false }));

  return { requireAuth, isAuthenticated, isGuest, modalProps: modal, hideModal };
};
