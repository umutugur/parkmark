import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { GlassCard } from '../../components/ui/GlassCard';
import { Colors, Spacing, FontSizes, FontWeights } from '../../constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface Section {
  titleKey: string;
  bodyKey: string;
}

const SECTIONS: Section[] = [
  { titleKey: 'terms.section1Title', bodyKey: 'terms.section1Body' },
  { titleKey: 'terms.section2Title', bodyKey: 'terms.section2Body' },
  { titleKey: 'terms.section3Title', bodyKey: 'terms.section3Body' },
  { titleKey: 'terms.section4Title', bodyKey: 'terms.section4Body' },
  { titleKey: 'terms.section5Title', bodyKey: 'terms.section5Body' },
  { titleKey: 'terms.section6Title', bodyKey: 'terms.section6Body' },
  { titleKey: 'terms.section7Title', bodyKey: 'terms.section7Body' },
];

export default function TermsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <LinearGradient colors={[Colors.bgDeep, Colors.bgPrimary]} style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('about.termsOfService')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + Spacing.xl }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Last Updated */}
        <GlassCard style={styles.updatedCard}>
          <View style={styles.updatedRow}>
            <Ionicons name="time-outline" size={16} color={Colors.primary} />
            <Text style={styles.updatedText}>{t('legal.lastUpdated')}: {t('legal.updatedDate')}</Text>
          </View>
        </GlassCard>

        {/* Intro */}
        <GlassCard style={styles.section}>
          <Text style={styles.introText}>{t('terms.intro')}</Text>
        </GlassCard>

        {/* Sections */}
        {SECTIONS.map((section, index) => (
          <GlassCard key={index} style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionNumber}>
                <Text style={styles.sectionNumberText}>{index + 1}</Text>
              </View>
              <Text style={styles.sectionTitle}>{t(section.titleKey)}</Text>
            </View>
            <Text style={styles.sectionBody}>{t(section.bodyKey)}</Text>
          </GlassCard>
        ))}

        {/* Contact */}
        <GlassCard style={styles.section}>
          <Text style={styles.sectionTitle}>{t('terms.contactTitle')}</Text>
          <Text style={styles.sectionBody}>{t('terms.contactBody')}</Text>
          <Text style={styles.emailText}>support@parkmark.app</Text>
        </GlassCard>
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
    fontSize: FontSizes.subheading,
    fontWeight: FontWeights.semibold,
    color: Colors.textPrimary,
    fontFamily: 'Poppins-SemiBold',
  },
  scrollView: { flex: 1 },
  scrollContent: { padding: Spacing.md, gap: Spacing.md },
  updatedCard: {
    backgroundColor: 'rgba(255, 193, 7, 0.08)',
    borderColor: 'rgba(255, 193, 7, 0.2)',
  },
  updatedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  updatedText: {
    fontSize: FontSizes.caption,
    color: Colors.primary,
    fontFamily: 'NunitoSans-Regular',
  },
  section: {},
  introText: {
    fontSize: FontSizes.body,
    color: Colors.textSecondary,
    lineHeight: 26,
    fontFamily: 'NunitoSans-Regular',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  sectionNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionNumberText: {
    fontSize: FontSizes.caption,
    fontWeight: FontWeights.bold,
    color: Colors.bgDeep,
    fontFamily: 'Poppins-Bold',
  },
  sectionTitle: {
    fontSize: FontSizes.body,
    fontWeight: FontWeights.semibold,
    color: Colors.textPrimary,
    fontFamily: 'Poppins-SemiBold',
    flex: 1,
  },
  sectionBody: {
    fontSize: FontSizes.body,
    color: Colors.textSecondary,
    lineHeight: 26,
    fontFamily: 'NunitoSans-Regular',
  },
  emailText: {
    fontSize: FontSizes.body,
    color: Colors.accent,
    fontFamily: 'NunitoSans-Medium',
    marginTop: Spacing.xs,
  },
});
