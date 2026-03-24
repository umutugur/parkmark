import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Switch,
  Linking,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { GlassCard } from '../../components/ui/GlassCard';
import { Colors, Spacing, BorderRadius, FontSizes, FontWeights } from '../../constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { changeLanguage } from '../../config/i18n';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import {
  REMINDER_NOTIF_KEY,
  MARKETING_NOTIF_KEY,
  getNotificationPermissionStatus,
  cancelAllNotifications,
} from '../../utils/notifications';
import { BANNER_AD_UNIT_ID } from '../../services/ads';
import { apiService } from '../../services/api';

const isExpoGo = Constants.appOwnership === 'expo';
const { BannerAd, BannerAdSize } = isExpoGo ? ({} as any) : require('react-native-google-mobile-ads');

export default function SettingsScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { user, logout } = useAuth();
  const insets = useSafeAreaInsets();
  const [remindersEnabled, setRemindersEnabled] = useState(false);
  const [marketingEnabled, setMarketingEnabled] = useState(false);

  useEffect(() => {
    loadNotificationPrefs();
  }, []);

  const loadNotificationPrefs = async () => {
    try {
      const status = await getNotificationPermissionStatus();
      if (status !== 'granted') {
        setRemindersEnabled(false);
        setMarketingEnabled(false);
        return;
      }
      const reminderPref = await AsyncStorage.getItem(REMINDER_NOTIF_KEY);
      const marketingPref = await AsyncStorage.getItem(MARKETING_NOTIF_KEY);
      setRemindersEnabled(reminderPref !== 'false');
      setMarketingEnabled(marketingPref !== 'false');
    } catch {
      setRemindersEnabled(false);
      setMarketingEnabled(false);
    }
  };

  const handleNotificationToggle = async (
    type: 'reminders' | 'marketing',
    value: boolean
  ) => {
    const key = type === 'reminders' ? REMINDER_NOTIF_KEY : MARKETING_NOTIF_KEY;
    const setter = type === 'reminders' ? setRemindersEnabled : setMarketingEnabled;

    if (value) {
      const status = await getNotificationPermissionStatus();
      if (status === 'granted') {
        setter(true);
        await AsyncStorage.setItem(key, 'true');
        if (type === 'marketing') {
          apiService.updateNotificationPrefs({ marketingNotificationsEnabled: true }).catch(() => {});
        }
      } else {
        const { status: newStatus } = await Notifications.requestPermissionsAsync();
        if (newStatus === 'granted') {
          setter(true);
          await AsyncStorage.setItem(key, 'true');
          if (type === 'marketing') {
            apiService.updateNotificationPrefs({ marketingNotificationsEnabled: true }).catch(() => {});
          }
        } else {
          Alert.alert(
            t('settings.notificationsPermissionTitle'),
            t('settings.notificationsPermissionBody'),
            [
              { text: t('common.cancel'), style: 'cancel' },
              {
                text: t('settings.openSettings'),
                onPress: () => Linking.openURL('app-settings:'),
              },
            ]
          );
        }
      }
    } else {
      setter(false);
      await AsyncStorage.setItem(key, 'false');
      if (type === 'reminders') {
        await cancelAllNotifications();
      } else {
        apiService.updateNotificationPrefs({ marketingNotificationsEnabled: false }).catch(() => {});
      }
    }
  };

  const handleLanguageChange = async (lang: 'en' | 'tr') => {
    await changeLanguage(lang);
  };

  const handleLogout = () => {
    Alert.alert(
      t('auth.logout'),
      t('auth.logoutConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('auth.logout'),
          style: 'destructive',
          onPress: async () => { await logout(); },
        },
      ]
    );
  };

  const getInitials = (name: string): string => {
    const parts = name?.split(' ') ?? [];
    if (parts.length >= 2) {
      return `${parts[0]?.[0] ?? ''}${parts[1]?.[0] ?? ''}`.toUpperCase();
    }
    return (name?.[0] ?? 'U').toUpperCase();
  };

  return (
    <LinearGradient colors={[Colors.bgDeep, Colors.bgPrimary]} style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('settings.title')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + Spacing.xl }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Section */}
        <GlassCard style={styles.section}>
          <Text style={styles.sectionTitle}>{t('settings.profile')}</Text>
          <View style={styles.profileRow}>
            <View style={styles.avatarContainer}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{getInitials(user?.name ?? '')}</Text>
              </View>
              {user?.isSubscribed && (
                <View style={styles.proAvatarBadge}>
                  <Ionicons name="star" size={10} color={Colors.bgDeep} />
                </View>
              )}
            </View>
            <View style={styles.profileInfo}>
              <View style={styles.profileNameRow}>
                <Text style={styles.userName}>{user?.name ?? 'User'}</Text>
                <View style={user?.isSubscribed ? styles.proBadge : styles.freeBadge}>
                  <Ionicons
                    name={user?.isSubscribed ? 'star' : 'star-outline'}
                    size={10}
                    color={user?.isSubscribed ? Colors.bgDeep : Colors.textSecondary}
                  />
                  <Text style={user?.isSubscribed ? styles.proBadgeText : styles.freeBadgeText}>
                    {user?.isSubscribed ? 'PRO' : 'FREE'}
                  </Text>
                </View>
              </View>
              <Text style={styles.userEmail}>{user?.email ?? ''}</Text>
              {user?.isSubscribed && user?.subscriptionExpiresAt && (
                <Text style={styles.subscriptionExpiry}>
                  {t('settings.renewsOn', {
                    date: new Date(user.subscriptionExpiresAt).toLocaleDateString(),
                  })}
                </Text>
              )}
            </View>
          </View>
        </GlassCard>

        {/* Upgrade to Pro — sadece free kullanıcılara */}
        {!user?.isSubscribed && (
          <TouchableOpacity
            style={styles.upgradeCard}
            onPress={() => router.push('/paywall')}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={['#FF8C00', '#FFC107']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.upgradeGradient}
            >
              <View style={styles.upgradeLeft}>
                <View style={styles.upgradeIconCircle}>
                  <Ionicons name="star" size={22} color="#FF8C00" />
                </View>
                <View>
                  <Text style={styles.upgradeTitle}>{t('settings.upgradeToPro')}</Text>
                  <Text style={styles.upgradeSubtitle}>{t('settings.upgradeSubtitle')}</Text>
                </View>
              </View>
              <View style={styles.upgradeArrow}>
                <Ionicons name="chevron-forward" size={20} color={Colors.bgDeep} />
              </View>
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* Language Section */}
        <GlassCard style={styles.section}>
          <Text style={styles.sectionTitle}>{t('settings.language')}</Text>
          <TouchableOpacity style={styles.row} onPress={() => handleLanguageChange('en')}>
            <View style={styles.rowLeft}>
              <Text style={styles.languageFlag}>🇬🇧</Text>
              <Text style={styles.rowText}>{t('settings.english')}</Text>
            </View>
            {i18n.language === 'en' && (
              <Ionicons name="checkmark" size={24} color={Colors.primary} />
            )}
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity style={styles.row} onPress={() => handleLanguageChange('tr')}>
            <View style={styles.rowLeft}>
              <Text style={styles.languageFlag}>🇹🇷</Text>
              <Text style={styles.rowText}>{t('settings.turkish')}</Text>
            </View>
            {i18n.language === 'tr' && (
              <Ionicons name="checkmark" size={24} color={Colors.primary} />
            )}
          </TouchableOpacity>
        </GlassCard>

        {/* Notifications Section */}
        <GlassCard style={styles.section}>
          <Text style={styles.sectionTitle}>{t('settings.notifications')}</Text>

          {/* Park Hatırlatıcıları */}
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Ionicons
                name={remindersEnabled ? 'alarm' : 'alarm-outline'}
                size={20}
                color={remindersEnabled ? Colors.primary : Colors.textSecondary}
              />
              <View style={{ marginLeft: Spacing.sm, flex: 1 }}>
                <Text style={styles.rowText}>{t('settings.parkingReminders')}</Text>
                <Text style={styles.rowSubText}>{t('settings.parkingRemindersDesc')}</Text>
              </View>
            </View>
            <Switch
              value={remindersEnabled}
              onValueChange={(v) => handleNotificationToggle('reminders', v)}
              trackColor={{ false: Colors.surface, true: Colors.primary }}
              thumbColor={remindersEnabled ? Colors.bgDeep : Colors.textSecondary}
            />
          </View>

          <View style={styles.divider} />

          {/* Uygulama Bildirimleri */}
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Ionicons
                name={marketingEnabled ? 'megaphone' : 'megaphone-outline'}
                size={20}
                color={marketingEnabled ? Colors.primary : Colors.textSecondary}
              />
              <View style={{ marginLeft: Spacing.sm, flex: 1 }}>
                <Text style={styles.rowText}>{t('settings.appNotifications')}</Text>
                <Text style={styles.rowSubText}>{t('settings.appNotificationsDesc')}</Text>
              </View>
            </View>
            <Switch
              value={marketingEnabled}
              onValueChange={(v) => handleNotificationToggle('marketing', v)}
              trackColor={{ false: Colors.surface, true: Colors.primary }}
              thumbColor={marketingEnabled ? Colors.bgDeep : Colors.textSecondary}
            />
          </View>
        </GlassCard>

        {/* App Section */}
        <GlassCard style={styles.section}>
          <Text style={styles.sectionTitle}>{t('settings.app')}</Text>

          <TouchableOpacity style={styles.row} onPress={() => router.push('/home/history')}>
            <View style={styles.rowLeft}>
              <Ionicons name="time-outline" size={20} color={Colors.textPrimary} />
              <Text style={[styles.rowText, { marginLeft: Spacing.sm }]}>{t('settings.parkingHistory')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity style={styles.row} onPress={() => router.push('/home/about')}>
            <View style={styles.rowLeft}>
              <Ionicons name="information-circle-outline" size={20} color={Colors.textPrimary} />
              <Text style={[styles.rowText, { marginLeft: Spacing.sm }]}>{t('settings.aboutParkMark')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity style={styles.row} onPress={() => router.push('/home/privacy')}>
            <View style={styles.rowLeft}>
              <Ionicons name="shield-checkmark-outline" size={20} color={Colors.textPrimary} />
              <Text style={[styles.rowText, { marginLeft: Spacing.sm }]}>{t('about.privacyPolicy')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity style={styles.row} onPress={() => router.push('/home/terms')}>
            <View style={styles.rowLeft}>
              <Ionicons name="document-text-outline" size={20} color={Colors.textPrimary} />
              <Text style={[styles.rowText, { marginLeft: Spacing.sm }]}>{t('about.termsOfService')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
          </TouchableOpacity>

          <View style={styles.divider} />

          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Ionicons name="code-slash-outline" size={20} color={Colors.textSecondary} />
              <Text style={[styles.rowText, { marginLeft: Spacing.sm, color: Colors.textSecondary }]}>
                {t('settings.version')}
              </Text>
            </View>
            <Text style={styles.versionText}>{Constants?.expoConfig?.version ?? '1.0.0'}</Text>
          </View>
        </GlassCard>

        {/* Banner Ad */}
        {!user?.isSubscribed && !isExpoGo && (
          <View style={styles.adItem}>
            <BannerAd
              unitId={BANNER_AD_UNIT_ID}
              size={BannerAdSize.INLINE_ADAPTIVE_BANNER}
            />
          </View>
        )}

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color="white" style={{ marginRight: Spacing.sm }} />
          <Text style={styles.logoutText}>{t('settings.logout')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
  },
  backButton: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: {
    fontSize: FontSizes.heading,
    fontWeight: FontWeights.semibold,
    color: Colors.textPrimary,
    fontFamily: 'Poppins-SemiBold',
  },
  scrollView: { flex: 1 },
  scrollContent: { padding: Spacing.md },
  section: { marginBottom: Spacing.md },
  sectionTitle: {
    fontSize: FontSizes.body,
    fontWeight: FontWeights.semibold,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
    fontFamily: 'Poppins-SemiBold',
  },
  profileRow: { flexDirection: 'row', alignItems: 'center' },
  avatarContainer: { position: 'relative', marginRight: Spacing.md },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  proAvatarBadge: {
    position: 'absolute',
    bottom: 0,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.bgCard,
  },
  avatarText: {
    fontSize: 24,
    fontWeight: FontWeights.bold,
    color: Colors.bgDeep,
    fontFamily: 'Poppins-Bold',
  },
  profileInfo: { flex: 1 },
  profileNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  userName: {
    fontSize: FontSizes.subheading,
    fontWeight: FontWeights.semibold,
    color: Colors.textPrimary,
    fontFamily: 'Poppins-SemiBold',
  },
  proBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: Colors.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  freeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: Colors.surface,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  proBadgeText: {
    fontSize: 10,
    fontWeight: FontWeights.bold,
    color: Colors.bgDeep,
    fontFamily: 'Poppins-Bold',
  },
  freeBadgeText: {
    fontSize: 10,
    fontWeight: FontWeights.semibold,
    color: Colors.textSecondary,
    fontFamily: 'Poppins-SemiBold',
  },
  userEmail: {
    fontSize: FontSizes.body,
    color: Colors.textSecondary,
    marginTop: 2,
    fontFamily: 'NunitoSans-Regular',
  },
  subscriptionExpiry: {
    fontSize: FontSizes.caption,
    color: Colors.primary,
    marginTop: 2,
    fontFamily: 'NunitoSans-Regular',
  },
  upgradeCard: {
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    marginBottom: Spacing.md,
  },
  upgradeGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
  },
  upgradeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    flex: 1,
  },
  upgradeIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  upgradeTitle: {
    fontSize: FontSizes.subheading,
    fontWeight: FontWeights.bold,
    color: Colors.bgDeep,
    fontFamily: 'Poppins-Bold',
  },
  upgradeSubtitle: {
    fontSize: FontSizes.caption,
    color: Colors.bgDeep,
    opacity: 0.75,
    fontFamily: 'NunitoSans-Regular',
    marginTop: 1,
  },
  upgradeArrow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  rowLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  rowText: {
    fontSize: FontSizes.body,
    color: Colors.textPrimary,
    fontFamily: 'NunitoSans-Regular',
  },
  rowSubText: {
    fontSize: FontSizes.caption,
    color: Colors.textSecondary,
    fontFamily: 'NunitoSans-Regular',
    marginTop: 2,
  },
  languageFlag: { fontSize: 24, marginRight: Spacing.md },
  divider: {
    height: 1,
    backgroundColor: Colors.surface,
    marginVertical: Spacing.xs,
  },
  versionText: {
    fontSize: FontSizes.body,
    color: Colors.textSecondary,
    fontFamily: 'NunitoSans-Regular',
  },
  logoutButton: {
    backgroundColor: Colors.error,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: Spacing.sm,
    marginBottom: Spacing.xxl,
  },
  logoutText: {
    fontSize: FontSizes.body,
    fontWeight: FontWeights.semibold,
    color: 'white',
    fontFamily: 'Poppins-SemiBold',
  },
  adItem: {
    alignItems: 'center',
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    marginBottom: Spacing.md,
  },
});
