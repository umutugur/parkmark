import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { AntDesign } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Colors, FontSizes, FontWeights, Spacing, BorderRadius } from '../../constants/theme';
import { changeLanguage } from '../../config/i18n';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { signInWithGoogle, signInWithApple, isAppleSignInAvailable } from '../../services/social-auth';
import Constants from 'expo-constants';

const isExpoGo = Constants.appOwnership === 'expo';

type TabType = 'login' | 'signup';

export default function LoginScreen() {
  const router = useRouter();
  const { login, signup, loginWithOAuth } = useAuth();
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<TabType>('login');
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<'google' | 'apple' | null>(null);
  const [appleAvailable, setAppleAvailable] = useState(false);

  useEffect(() => {
    isAppleSignInAvailable().then(setAppleAvailable);
  }, []);

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!email) {
      newErrors.email = t('auth.emailRequired');
    } else if (!validateEmail(email)) {
      newErrors.email = t('auth.emailInvalid');
    }

    if (!password) {
      newErrors.password = t('auth.passwordRequired');
    } else if (password.length < 6) {
      newErrors.password = t('auth.passwordTooShort');
    }

    if (activeTab === 'signup') {
      if (!name) {
        newErrors.name = t('auth.nameRequired');
      }
      if (password !== confirmPassword) {
        newErrors.confirmPassword = t('auth.passwordsDoNotMatch');
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      if (activeTab === 'login') {
        await login(email, password);
        Alert.alert(t('common.success'), t('auth.loginSuccess'));
        router.replace('/home');
      } else {
        await signup(email, password, name);
        Alert.alert(t('common.success'), t('auth.signupSuccess'));
        router.replace('/home');
      }
    } catch (error: any) {
      const message =
        activeTab === 'login'
          ? t('auth.loginError')
          : t('auth.signupError');
      Alert.alert(t('common.error'), message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (isExpoGo) {
      Alert.alert('Expo Go', 'Google Sign-In Expo Go\'da çalışmaz. Dev build gerektirir.');
      return;
    }
    setOauthLoading('google');
    try {
      const result = await signInWithGoogle();
      await loginWithOAuth('google', result.idToken, result.name);
      router.replace('/home');
    } catch (err: any) {
      if (err?.message !== 'Google sign-in cancelled') {
        console.error('[Google SignIn Error]', JSON.stringify(err), err?.message, err?.code);
        Alert.alert(t('common.error'), `Google ile giriş başarısız.\n\n${err?.message || err?.code || JSON.stringify(err)}`);
      }
    } finally {
      setOauthLoading(null);
    }
  };

  const handleAppleSignIn = async () => {
    setOauthLoading('apple');
    try {
      const result = await signInWithApple();
      await loginWithOAuth('apple', result.idToken, result.name);
      router.replace('/home');
    } catch (err: any) {
      if (err?.code !== 'ERR_REQUEST_CANCELED') {
        Alert.alert(t('common.error'), 'Apple ile giriş başarısız.');
      }
    } finally {
      setOauthLoading(null);
    }
  };

  const toggleLanguage = async () => {
    const newLang = i18n.language === 'en' ? 'tr' : 'en';
    await changeLanguage(newLang);
  };

  return (
    <LinearGradient colors={[Colors.bgDeep, Colors.bgPrimary]} style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 20 }]}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo */}
          <View style={styles.logoContainer}>
            <Image
              source={require('../../assets/images/icon.png')}
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={styles.appName}>{t('common.appName')}</Text>
          </View>

          {/* Tab Bar */}
          <View style={styles.tabBar}>
            <TouchableOpacity
              style={[
                styles.tab,
                activeTab === 'login' && styles.activeTab,
              ]}
              onPress={() => setActiveTab('login')}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === 'login' && styles.activeTabText,
                ]}
              >
                {t('auth.login')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.tab,
                activeTab === 'signup' && styles.activeTab,
              ]}
              onPress={() => setActiveTab('signup')}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === 'signup' && styles.activeTabText,
                ]}
              >
                {t('auth.signup')}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Form */}
          <View style={styles.formContainer}>
            {activeTab === 'signup' && (
              <Input
                label={t('auth.name')}
                value={name}
                onChangeText={setName}
                error={errors?.name}
                autoCapitalize="words"
              />
            )}
            <Input
              label={t('auth.email')}
              value={email}
              onChangeText={setEmail}
              error={errors?.email}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <Input
              label={t('auth.password')}
              value={password}
              onChangeText={setPassword}
              error={errors?.password}
              secureTextEntry
            />
            {activeTab === 'signup' && (
              <Input
                label={t('auth.confirmPassword')}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                error={errors?.confirmPassword}
                secureTextEntry
              />
            )}

            {activeTab === 'login' && (
              <TouchableOpacity style={styles.forgotPassword}>
                <Text style={styles.forgotPasswordText}>
                  {t('auth.forgotPassword')}
                </Text>
              </TouchableOpacity>
            )}

            <Button
              title={
                activeTab === 'login'
                  ? t('auth.loginButton')
                  : t('auth.signupButton')
              }
              onPress={handleSubmit}
              loading={loading}
              style={styles.submitButton}
            />
          </View>

          {/* OAuth Divider */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>veya</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Google Sign-In */}
          <TouchableOpacity
            style={[styles.oauthButton, oauthLoading === 'google' && styles.oauthButtonDisabled]}
            onPress={handleGoogleSignIn}
            disabled={oauthLoading !== null}
          >
            {oauthLoading === 'google' ? (
              <ActivityIndicator size="small" color={Colors.textPrimary} />
            ) : (
              <>
                <AntDesign name="google" size={20} color="#EA4335" style={styles.oauthIcon} />
                <Text style={styles.oauthButtonText}>Google ile devam et</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Apple Sign-In — sadece iOS */}
          {appleAvailable && (
            <TouchableOpacity
              style={[styles.oauthButton, styles.oauthButtonApple, oauthLoading === 'apple' && styles.oauthButtonDisabled]}
              onPress={handleAppleSignIn}
              disabled={oauthLoading !== null}
            >
              {oauthLoading === 'apple' ? (
                <ActivityIndicator size="small" color={Colors.bgDeep} />
              ) : (
                <>
                  <Ionicons name="logo-apple" size={22} color={Colors.bgDeep} style={styles.oauthIcon} />
                  <Text style={[styles.oauthButtonText, styles.oauthButtonTextApple]}>Apple ile devam et</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {/* Language Toggle */}
          <TouchableOpacity style={styles.languageToggle} onPress={toggleLanguage}>
            <Text style={styles.languageText}>
              {i18n.language === 'en' ? '🇹🇷 Türkçe' : '🇬🇧 English'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xl,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  logo: {
    width: 80,
    height: 80,
    marginBottom: Spacing.md,
  },
  appName: {
    fontSize: FontSizes.heading,
    fontWeight: FontWeights.bold,
    color: Colors.primary,
    fontFamily: 'Poppins-Bold',
  },
  tabBar: {
    flexDirection: 'row',
    marginBottom: Spacing.xl,
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius.md,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    borderRadius: BorderRadius.sm,
  },
  activeTab: {
    backgroundColor: Colors.primary,
  },
  tabText: {
    fontSize: FontSizes.body,
    color: Colors.textSecondary,
    fontFamily: 'NunitoSans-Medium',
  },
  activeTabText: {
    color: Colors.bgDeep,
    fontWeight: FontWeights.semibold,
  },
  formContainer: {
    marginBottom: Spacing.xl,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: Spacing.md,
  },
  forgotPasswordText: {
    fontSize: 14,
    color: Colors.accent,
    fontFamily: 'NunitoSans-Regular',
  },
  submitButton: {
    marginTop: Spacing.md,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: Spacing.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.surface,
  },
  dividerText: {
    marginHorizontal: Spacing.md,
    fontSize: FontSizes.caption,
    color: Colors.textSecondary,
    fontFamily: 'NunitoSans-Regular',
  },
  oauthButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.surface,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    marginBottom: Spacing.md,
    backgroundColor: Colors.bgCard,
  },
  oauthButtonApple: {
    backgroundColor: Colors.textPrimary,
    borderColor: Colors.textPrimary,
  },
  oauthButtonDisabled: {
    opacity: 0.6,
  },
  oauthIcon: {
    marginRight: Spacing.sm,
  },
  oauthButtonText: {
    fontSize: FontSizes.body,
    color: Colors.textPrimary,
    fontFamily: 'NunitoSans-Medium',
  },
  oauthButtonTextApple: {
    color: Colors.bgDeep,
  },
  languageToggle: {
    alignSelf: 'center',
    padding: Spacing.sm,
  },
  languageText: {
    fontSize: FontSizes.body,
    color: Colors.textSecondary,
    fontFamily: 'NunitoSans-Regular',
  },
});
