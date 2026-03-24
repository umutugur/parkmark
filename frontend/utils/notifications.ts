import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

// AsyncStorage keys
export const REMINDER_NOTIF_KEY = '@parkmark_reminders_enabled';
export const MARKETING_NOTIF_KEY = '@parkmark_marketing_enabled';
const PUSH_TOKEN_KEY = '@parkmark_push_token';

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// ─── Permission ──────────────────────────────────────────────────────────────

export const requestNotificationPermission = async (): Promise<boolean> => {
  try {
    if (Platform.OS === 'web') return true;
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  } catch (error) {
    console.error('Error requesting notification permission:', error);
    return false;
  }
};

export const getNotificationPermissionStatus = async (): Promise<'granted' | 'denied' | 'undetermined'> => {
  try {
    if (Platform.OS === 'web') return 'granted';
    const { status } = await Notifications.getPermissionsAsync();
    return status;
  } catch {
    return 'denied';
  }
};

// ─── Push Token ───────────────────────────────────────────────────────────────

/**
 * Expo Push Token alır ve önbellekte saklar.
 * Simulator'da null döner (simülatörde push çalışmaz).
 */
export const getExpoPushToken = async (): Promise<string | null> => {
  try {
    if (Platform.OS === 'web') return null;

    // Simulator kontrolü
    const isSimulator = !Constants.isDevice;
    if (isSimulator) return null;

    const status = await getNotificationPermissionStatus();
    if (status !== 'granted') return null;

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) {
      console.warn('[Push] EAS projectId bulunamadı — push token alınamıyor');
      return null;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    return tokenData.data;
  } catch (error) {
    console.error('[Push] Token alınamadı:', error);
    return null;
  }
};

/**
 * Giriş sonrası çağrılır: izin ister, token alır, backend'e gönderir.
 * Daha önce kaydedilmiş token varsa tekrar göndermez (değişmedikçe).
 */
export const registerPushToken = async (
  updateFn: (prefs: { pushToken?: string | null; marketingNotificationsEnabled?: boolean }) => Promise<any>
): Promise<void> => {
  try {
    if (Platform.OS === 'web') return;

    // İzin yoksa iste
    let status = await getNotificationPermissionStatus();
    if (status === 'undetermined') {
      const granted = await requestNotificationPermission();
      status = granted ? 'granted' : 'denied';
    }
    if (status !== 'granted') return;

    const token = await getExpoPushToken();
    if (!token) return;

    // Daha önce bu token kaydedildiyse tekrar gönderme
    const cached = await AsyncStorage.getItem(PUSH_TOKEN_KEY);
    if (cached === token) return;

    const marketingPref = await AsyncStorage.getItem(MARKETING_NOTIF_KEY);
    const marketingEnabled = marketingPref !== 'false';

    await updateFn({ pushToken: token, marketingNotificationsEnabled: marketingEnabled });
    await AsyncStorage.setItem(PUSH_TOKEN_KEY, token);
  } catch (error) {
    console.error('[Push] registerPushToken hatası:', error);
  }
};

// ─── Preference Helpers ───────────────────────────────────────────────────────

export const isRemindersEnabled = async (): Promise<boolean> => {
  try {
    const status = await getNotificationPermissionStatus();
    if (status !== 'granted') return false;
    const pref = await AsyncStorage.getItem(REMINDER_NOTIF_KEY);
    return pref !== 'false';
  } catch {
    return false;
  }
};

export const isMarketingEnabled = async (): Promise<boolean> => {
  try {
    const status = await getNotificationPermissionStatus();
    if (status !== 'granted') return false;
    const pref = await AsyncStorage.getItem(MARKETING_NOTIF_KEY);
    return pref !== 'false';
  } catch {
    return false;
  }
};

// ─── Reminder Notifications (local — internet gerekmez) ──────────────────────

export const scheduleReminderNotification = async (
  title: string,
  body: string,
  triggerDate: Date,
  data?: Record<string, any>
): Promise<string | null> => {
  try {
    if (Platform.OS === 'web') return null;

    const enabled = await isRemindersEnabled();
    if (!enabled) return null;

    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: data ?? {},
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: triggerDate,
      },
    });

    return notificationId;
  } catch (error) {
    console.error('Error scheduling notification:', error);
    return null;
  }
};

export const cancelNotification = async (notificationId: string): Promise<void> => {
  try {
    if (Platform.OS !== 'web') {
      await Notifications.cancelScheduledNotificationAsync(notificationId);
    }
  } catch (error) {
    console.error('Error canceling notification:', error);
  }
};

export const cancelAllNotifications = async (): Promise<void> => {
  try {
    if (Platform.OS !== 'web') {
      await Notifications.cancelAllScheduledNotificationsAsync();
    }
  } catch (error) {
    console.error('Error canceling all notifications:', error);
  }
};
