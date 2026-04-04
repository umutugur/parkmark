import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import { getOfferings, purchasePackage, restorePurchases } from '../services/purchases';
import { loadRewardedAd } from '../services/ads';
import { apiService } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, BorderRadius, FontSizes, FontWeights } from '../constants/theme';
import { GlassCard } from '../components/ui/GlassCard';

// rcIdentifier → RevenueCat package identifier ($rc_*)
const PLANS = [
  {
    id: 'monthly',
    rcIdentifier: '$rc_monthly',
    label: 'Aylık',
    price: '$2.99',
    highlight: false,
  },
  {
    id: 'sixMonth',
    rcIdentifier: '$rc_six_month',
    label: '6 Aylık',
    price: '$12.99',
    highlight: false,
  },
  {
    id: 'yearly',
    rcIdentifier: '$rc_annual',
    label: 'Yıllık',
    price: '$19.99',
    badge: 'En İyi Değer',
    highlight: true,
  },
];

const isExpoGo = Constants.appOwnership === 'expo';
const { RewardedAdEventType } = isExpoGo ? ({} as any) : require('react-native-google-mobile-ads');

export default function PaywallScreen() {
  const router = useRouter();
  const { refreshUser } = useAuth();
  const insets = useSafeAreaInsets();
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
    try {
      const current = await getOfferings();
      setOfferings(current);
    } catch {
      // silently fail, use fallback UI
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
        Alert.alert('Hata', 'Freemium aktivasyonu başarısız.');
      }
    });
    ad.load();
  };

  const handlePurchase = async () => {
    if (isExpoGo) {
      console.warn('[Paywall] Satın alma Expo Go\'da çalışmaz.');
      return;
    }
    if (!offerings) {
      Alert.alert('Hata', 'Abonelik paketleri yüklenemedi.');
      return;
    }
    const selectedPlanObj = PLANS.find(p => p.id === selectedPlan);
    const pkg = offerings.availablePackages?.find(
      (p: any) => p.identifier === selectedPlanObj?.rcIdentifier
    );
    if (!pkg) {
      Alert.alert('Hata', 'Seçilen paket bulunamadı.');
      return;
    }
    setLoading(true);
    try {
      await purchasePackage(pkg);
      await refreshUser(); // premium durumunu anında güncelle
      router.back();
    } catch (err: any) {
      if (!err.userCancelled) {
        Alert.alert('Hata', 'Satın alma işlemi başarısız.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleWatchAd = async () => {
    if (isExpoGo) {
      console.warn('[Paywall] Reklam Expo Go\'da çalışmaz.');
      return;
    }
    if (!rewardedAd) {
      Alert.alert('Reklam Hazır Değil', 'Lütfen birkaç saniye bekleyip tekrar deneyin.');
      return;
    }
    setAdLoading(true);
    try {
      await rewardedAd.show();
    } catch {
      Alert.alert('Hata', 'Reklam gösterilemedi.');
    } finally {
      setAdLoading(false);
    }
  };

  const handleRestore = async () => {
    if (isExpoGo) {
      console.warn('[Paywall] Geri yükleme Expo Go\'da çalışmaz.');
      return;
    }
    setLoading(true);
    try {
      await restorePurchases();
      await refreshUser(); // premium durumunu anında güncelle
      Alert.alert('Başarılı', 'Satın alımlar geri yüklendi.');
      router.back();
    } catch {
      Alert.alert('Hata', 'Geri yükleme başarısız.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient colors={[Colors.bgDeep, Colors.bgPrimary]} style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom + Spacing.lg }]}>
      {/* Close */}
      <TouchableOpacity style={[styles.closeButton, { top: insets.top + 10 }]} onPress={() => router.back()}>
        <Ionicons name="close" size={24} color={Colors.textPrimary} />
      </TouchableOpacity>

      {/* Title */}
      <View style={styles.titleSection}>
        <Ionicons name="shield-checkmark" size={48} color={Colors.primary} />
        <Text style={styles.title}>ParkMark Pro</Text>
        <Text style={styles.subtitle}>Sınırsız park pini oluştur</Text>
      </View>

      {/* Plans */}
      <View style={styles.plansContainer}>
        {PLANS.map((plan) => (
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
                  <Text style={styles.badgeText}>{plan.badge}</Text>
                </View>
              )}
              <View style={styles.planRow}>
                <View style={styles.planRadio}>
                  {selectedPlan === plan.id && <View style={styles.planRadioDot} />}
                </View>
                <Text style={styles.planLabel}>{plan.label}</Text>
                <Text style={styles.planPrice}>{plan.price}</Text>
              </View>
            </GlassCard>
          </TouchableOpacity>
        ))}
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
          <Text style={styles.purchaseButtonText}>Abone Ol</Text>
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
            <Text style={styles.adButtonText}>24 saat ücretsiz kullan — Reklam İzle</Text>
          </>
        )}
      </TouchableOpacity>

      {/* Restore */}
      <TouchableOpacity onPress={handleRestore} style={styles.restoreButton}>
        <Text style={styles.restoreText}>Satın alımları geri yükle</Text>
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
