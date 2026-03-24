import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { GlassCard } from '../../components/ui/GlassCard';
import { Colors, Spacing, BorderRadius, FontSizes, FontWeights } from '../../constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants';

export default function AboutScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const version = Constants?.expoConfig?.version ?? '1.0.0';

  const handleEmail = () => {
    Linking.openURL('mailto:support@parkmark.app');
  };

  const handleWebsite = () => {
    Linking.openURL('https://parkmark.app');
  };

  return (
    <LinearGradient colors={[Colors.bgDeep, Colors.bgPrimary]} style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('about.title')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + Spacing.xl }]}
        showsVerticalScrollIndicator={false}
      >
        {/* App Identity */}
        <View style={styles.appIdentity}>
          <View style={styles.iconContainer}>
            <Image
              source={require('../../assets/images/icon.png')}
              style={styles.appIcon}
              resizeMode="contain"
            />
          </View>
          <Text style={styles.appName}>{t('common.appName')}</Text>
          <Text style={styles.tagline}>{t('common.tagline')}</Text>
          <View style={styles.versionBadge}>
            <Text style={styles.versionText}>{t('about.version')} {version}</Text>
          </View>
        </View>

        {/* Description */}
        <GlassCard style={styles.section}>
          <Text style={styles.sectionTitle}>{t('about.whatIsTitle')}</Text>
          <Text style={styles.descriptionText}>{t('about.description')}</Text>
        </GlassCard>

        {/* Features */}
        <GlassCard style={styles.section}>
          <Text style={styles.sectionTitle}>{t('about.featuresTitle')}</Text>
          {[
            { icon: 'location', key: 'feature1' },
            { icon: 'camera', key: 'feature2' },
            { icon: 'notifications', key: 'feature3' },
            { icon: 'navigate', key: 'feature4' },
            { icon: 'time', key: 'feature5' },
          ].map((item) => (
            <View key={item.key} style={styles.featureRow}>
              <View style={styles.featureIcon}>
                <Ionicons name={item.icon as any} size={18} color={Colors.primary} />
              </View>
              <Text style={styles.featureText}>{t(`about.${item.key}`)}</Text>
            </View>
          ))}
        </GlassCard>

        {/* Legal Links */}
        <GlassCard style={styles.section}>
          <Text style={styles.sectionTitle}>{t('about.legalTitle')}</Text>

          <TouchableOpacity style={styles.linkRow} onPress={() => router.push('/home/privacy')}>
            <View style={styles.linkLeft}>
              <Ionicons name="shield-checkmark-outline" size={20} color={Colors.accent} />
              <Text style={styles.linkText}>{t('about.privacyPolicy')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity style={styles.linkRow} onPress={() => router.push('/home/terms')}>
            <View style={styles.linkLeft}>
              <Ionicons name="document-text-outline" size={20} color={Colors.accent} />
              <Text style={styles.linkText}>{t('about.termsOfService')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
          </TouchableOpacity>
        </GlassCard>

        {/* Contact */}
        <GlassCard style={styles.section}>
          <Text style={styles.sectionTitle}>{t('about.contactTitle')}</Text>

          <TouchableOpacity style={styles.linkRow} onPress={handleEmail}>
            <View style={styles.linkLeft}>
              <Ionicons name="mail-outline" size={20} color={Colors.primary} />
              <Text style={styles.linkText}>support@parkmark.app</Text>
            </View>
            <Ionicons name="open-outline" size={18} color={Colors.textSecondary} />
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity style={styles.linkRow} onPress={handleWebsite}>
            <View style={styles.linkLeft}>
              <Ionicons name="globe-outline" size={20} color={Colors.primary} />
              <Text style={styles.linkText}>parkmark.app</Text>
            </View>
            <Ionicons name="open-outline" size={18} color={Colors.textSecondary} />
          </TouchableOpacity>
        </GlassCard>

        {/* Copyright */}
        <Text style={styles.copyright}>
          © {new Date().getFullYear()} ParkMark. {t('about.allRightsReserved')}
        </Text>
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
  scrollContent: { padding: Spacing.md, gap: Spacing.md },
  appIdentity: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    marginBottom: Spacing.md,
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  appIcon: { width: '100%', height: '100%' },
  appName: {
    fontSize: FontSizes.display,
    fontWeight: FontWeights.bold,
    color: Colors.primary,
    fontFamily: 'Poppins-Bold',
    letterSpacing: 1,
  },
  tagline: {
    fontSize: FontSizes.body,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
    fontFamily: 'NunitoSans-Regular',
    textAlign: 'center',
  },
  versionBadge: {
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.surface,
  },
  versionText: {
    fontSize: FontSizes.caption,
    color: Colors.textSecondary,
    fontFamily: 'NunitoSans-Regular',
  },
  section: { gap: Spacing.xs },
  sectionTitle: {
    fontSize: FontSizes.body,
    fontWeight: FontWeights.semibold,
    color: Colors.textPrimary,
    fontFamily: 'Poppins-SemiBold',
    marginBottom: Spacing.sm,
  },
  descriptionText: {
    fontSize: FontSizes.body,
    color: Colors.textSecondary,
    lineHeight: 24,
    fontFamily: 'NunitoSans-Regular',
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.xs,
    gap: Spacing.sm,
  },
  featureIcon: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.sm,
    backgroundColor: 'rgba(255, 193, 7, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureText: {
    fontSize: FontSizes.body,
    color: Colors.textSecondary,
    fontFamily: 'NunitoSans-Regular',
    flex: 1,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
  },
  linkLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  linkText: {
    fontSize: FontSizes.body,
    color: Colors.textPrimary,
    fontFamily: 'NunitoSans-Medium',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginVertical: Spacing.xs,
  },
  copyright: {
    textAlign: 'center',
    fontSize: FontSizes.caption,
    color: Colors.textSecondary,
    fontFamily: 'NunitoSans-Regular',
    opacity: 0.6,
    marginTop: Spacing.sm,
  },
});
