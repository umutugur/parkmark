import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { getOfferings, purchasePackage, restorePurchases, initializePurchases } from '../services/purchases';
import { loadRewardedAd } from '../services/ads';
import { apiService } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, BorderRadius, FontSizes, FontWeights } from '../constants/theme';
import { GlassCard } from '../components/ui/GlassCard';
import { AppModal, AppModalProps } from '../components/ui/AppModal';

// rcIdentifier → RevenueCat package identifier ($rc_*)
const PLAN_CONFIGS = [
  { id: 'monthly',  rcIdentifier: '$rc_monthly',   labelKey: 'monthly',  highlight: false, badge: false, fallbackPrice: '$2.99'  },
  { id: 'sixMonth', rcIdentifier: '$rc_six_month',  labelKey: 'sixMonth', highlight: false, badge: false, fallbackPrice: '$12.99' },
  { id: 'yearly',   rcIdentifier: '$rc_annual',     labelKey: 'yearly',   highlight: true,  badge: true,  fallbackPrice: '$19.99' },
];

const isExpoGo = Constants.appOwnership === 'expo';
const { RewardedAdEventType } = isExpoGo ? ({} as any) : require('react-native-google-mobile-ads');

export default function PaywallScreen() {
  const router = useRouter();
  const { refreshUser, user } = useAuth();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [modal, setModal] = useState<Omit<AppModalProps, 'onClose'>>({ visible: false });
  const showAlert = (title: string, message?: string, buttons?: AppModalProps['buttons']) =>
    setModal({ visible: true, title, message, buttons });
  const hideModal = () => setModal((m) => ({ ...m, visible: false }));

  const [offerings, setOfferings] = useState<any>(null);
  const [selectedPlan, setSelectedPlan] = useState<string>('yearly');
  const [loading, setLoading] = useState(false);
  const [adLoading, setAdLoading] = useState(false);
  const [rewardedAd, setRewardedAd] = useState<any>(null);

  useEffect(() => {
    loadOfferings();
    setupRewardedAd();
  }, []);

  const loadOfferings = async () => {
    if (isExpoGo || __DEV__) return; // RevenueCat simulator/Expo Go'da çalışmaz
    try {
      // Güvenlik: RC daha init edilmediyse user id ile initialize et
      if (user?.id) {
        try { initializePurchases(user.id); } catch {}
      }
      const current = await getOfferings();
      setOfferings(current);
    } catch (err) {
      console.error('[Paywall] offerings error:', err);
    }
  };

  const setupRewardedAd = () => {
    const ad = loadRewardedAd();
    if (!ad) return;
    ad.addAdEventListener(RewardedAdEventType.LOADED, () => {
      setRewardedAd(ad);
    });
    ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, async () => {
      try {
        await apiService.activateFreemium();
        router.back();
      } catch {
        showAlert(t('paywall.errorTitle'), t('paywall.freemiumError'));
      }
    });
    ad.load();
  };

  const handlePurchase = async () => {
    if (isExpoGo || __DEV__) {
      console.warn('[Paywall] Satın alma simulator/Expo Go\'da çalışmaz.');
      return;
    }
    if (!offerings) {
      showAlert(t('paywall.errorTitle'), t('paywall.offeringsError'));
      return;
    }
    const selectedPlanObj = PLAN_CONFIGS.find(p => p.id === selectedPlan);
    const pkg = offerings.availablePackages?.find(
      (p: any) => p.identifier === selectedPlanObj?.rcIdentifier
    );
    if (!pkg) {
      showAlert(t('paywall.errorTitle'), t('paywall.offeringsError'));
      return;
    }
    setLoading(true);
    try {
      const customerInfo = await purchasePackage(pkg);
      // RC customerInfo'dan pro entitlement'ı okuyup MongoDB'yi anında güncelle
      const proEntitlement = customerInfo?.entitlements?.active?.['pro'];
      if (proEntitlement) {
        const productPlanMap: Record<string, string> = {
          parkmark_monthly: 'monthly',
          parkmark_6month: 'sixMonth',
          parkmark_yearly: 'yearly',
        };
        await apiService.syncSubscription({
          isSubscribed: true,
          plan: productPlanMap[proEntitlement.productIdentifier] ?? 'monthly',
          expiresAt: proEntitlement.expirationDate ?? null,
        }).catch(() => {});
      }
      await refreshUser();
      router.back();
    } catch (err: any) {
      if (!err.userCancelled) {
        showAlert(t('paywall.errorTitle'), t('paywall.purchaseError'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleWatchAd = async () => {
    if (isExpoGo || __DEV__) {
      console.warn('[Paywall] Reklam simulator/Expo Go\'da çalışmaz.');
      return;
    }
    if (!rewardedAd) {
      showAlert(t('paywall.errorTitle'), t('paywall.adNotReady'));
      return;
    }
    setAdLoading(true);
    try {
      await rewardedAd.show();
    } catch {
      showAlert(t('paywall.errorTitle'), t('paywall.adError'));
    } finally {
      setAdLoading(false);
    }
  };

  const handleRestore = async () => {
    if (isExpoGo || __DEV__) {
      console.warn('[Paywall] Geri yükleme simulator/Expo Go\'da çalışmaz.');
      return;
    }
    setLoading(true);
    try {
      const customerInfo = await restorePurchases();
      const proEntitlement = customerInfo?.entitlements?.active?.['pro'];
      const productPlanMap: Record<string, string> = {
        parkmark_monthly: 'monthly',
        parkmark_6month: 'sixMonth',
        parkmark_yearly: 'yearly',
      };
      await apiService.syncSubscription({
        isSubscribed: !!proEntitlement,
        plan: proEntitlement ? (productPlanMap[proEntitlement.productIdentifier] ?? 'monthly') : undefined,
        expiresAt: proEntitlement?.expirationDate ?? null,
      }).catch(() => {});
      await refreshUser();
      showAlert(t('common.success'), t('paywall.restoreSuccess'), [
        { text: t('common.ok'), onPress: () => router.back() },
      ]);
    } catch {
      showAlert(t('paywall.errorTitle'), t('paywall.restoreError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient colors={[Colors.bgDeep, Colors.bgPrimary]} style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom + Spacing.lg }]}>
      <AppModal {...modal} onClose={hideModal} />
      {/* Close */}
      <TouchableOpacity style={[styles.closeButton, { top: insets.top + 10 }]} onPress={() => router.back()}>
        <Ionicons name="close" size={24} color={Colors.textPrimary} />
      </TouchableOpacity>

      {/* Title */}
      <View style={styles.titleSection}>
        <Ionicons name="shield-checkmark" size={48} color={Colors.primary} />
        <Text style={styles.title}>{t('paywall.title')}</Text>
        <Text style={styles.subtitle}>{t('paywall.subtitle')}</Text>
      </View>

      {/* Plans */}
      <View style={styles.plansContainer}>
        {PLAN_CONFIGS.map((plan) => {
          // Fiyatı RC'den al, yoksa hardcoded fallback göster
          const rcPkg = offerings?.availablePackages?.find(
            (p: any) => p.identifier === plan.rcIdentifier
          );
          const priceString = rcPkg?.product?.priceString ?? plan.fallbackPrice;

          return (
            <TouchableOpacity
              key={plan.id}
              onPress={() => setSelectedPlan(plan.id)}
            >
              <GlassCard
                style={[
                  styles.planCard,
                  selectedPlan === plan.id && styles.planCardSelected,
                  plan.highlight && styles.planCardHighlight,
                ]}
              >
                {plan.badge && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{t('paywall.bestValue')}</Text>
                  </View>
                )}
                <View style={styles.planRow}>
                  <View style={styles.planRadio}>
                    {selectedPlan === plan.id && <View style={styles.planRadioDot} />}
                  </View>
                  <Text style={styles.planLabel}>{t(`paywall.${plan.labelKey}`)}</Text>
                  <Text style={styles.planPrice}>{priceString}</Text>
                </View>
              </GlassCard>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Purchase Button */}
      <TouchableOpacity
        style={[styles.purchaseButton, loading && styles.buttonDisabled]}
        onPress={handlePurchase}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color={Colors.bgDeep} />
        ) : (
          <Text style={styles.purchaseButtonText}>{t('paywall.subscribe')}</Text>
        )}
      </TouchableOpacity>

      {/* Watch Ad */}
      <TouchableOpacity
        style={[styles.adButton, adLoading && styles.buttonDisabled]}
        onPress={handleWatchAd}
        disabled={adLoading}
      >
        {adLoading ? (
          <ActivityIndicator color={Colors.textPrimary} />
        ) : (
          <>
            <Ionicons name="play-circle-outline" size={20} color={Colors.textPrimary} style={{ marginRight: 6 }} />
            <Text style={styles.adButtonText}>{t('paywall.watchAd')}</Text>
          </>
        )}
      </TouchableOpacity>

      {/* Restore */}
      <TouchableOpacity onPress={handleRestore} style={styles.restoreButton}>
        <Text style={styles.restoreText}>{t('paywall.restore')}</Text>
      </TouchableOpacity>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
  },
  closeButton: {
    position: 'absolute',
    right: Spacing.lg,
    zIndex: 10,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleSection: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  title: {
    fontSize: 28,
    fontWeight: FontWeights.bold,
    color: Colors.textPrimary,
    fontFamily: 'Poppins-Bold',
    marginTop: Spacing.sm,
  },
  subtitle: {
    fontSize: FontSizes.body,
    color: Colors.textSecondary,
    fontFamily: 'NunitoSans-Regular',
    marginTop: 4,
  },
  plansContainer: {
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  planCard: {
    padding: Spacing.md,
  },
  planCardSelected: {
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  planCardHighlight: {
    borderWidth: 1,
    borderColor: Colors.primary + '60',
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    marginBottom: Spacing.xs,
  },
  badgeText: {
    fontSize: 11,
    color: Colors.bgDeep,
    fontWeight: FontWeights.bold,
    fontFamily: 'Poppins-Bold',
  },
  planRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  planRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  planRadioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.primary,
  },
  planLabel: {
    flex: 1,
    fontSize: FontSizes.body,
    color: Colors.textPrimary,
    fontFamily: 'NunitoSans-Medium',
  },
  planPrice: {
    fontSize: FontSizes.subheading,
    fontWeight: FontWeights.semibold,
    color: Colors.primary,
    fontFamily: 'Poppins-SemiBold',
  },
  purchaseButton: {
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  purchaseButtonText: {
    fontSize: FontSizes.body,
    fontWeight: FontWeights.bold,
    color: Colors.bgDeep,
    fontFamily: 'Poppins-Bold',
  },
  adButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.surface,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },
  adButtonText: {
    fontSize: FontSizes.body,
    color: Colors.textPrimary,
    fontFamily: 'NunitoSans-Regular',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  restoreButton: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  restoreText: {
    fontSize: FontSizes.caption,
    color: Colors.textSecondary,
    fontFamily: 'NunitoSans-Regular',
    textDecorationLine: 'underline',
  },
});
