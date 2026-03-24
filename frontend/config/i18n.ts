import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';

import en from '../locales/en.json';
import tr from '../locales/tr.json';

const LANGUAGE_KEY = '@parkmark_language';

const resources = {
  en: { translation: en },
  tr: { translation: tr },
};

export const initI18n = async () => {
  let savedLanguage = await AsyncStorage.getItem(LANGUAGE_KEY).catch(() => null);
  
  if (!savedLanguage) {
    // Auto-detect from device locale
    const deviceLocale = Localization.getLocales()?.[0]?.languageCode ?? 'en';
    savedLanguage = deviceLocale.startsWith('tr') ? 'tr' : 'en';
  }

  await i18n
    .use(initReactI18next)
    .init({
      resources,
      lng: savedLanguage,
      fallbackLng: 'en',
      interpolation: {
        escapeValue: false,
      },
      compatibilityJSON: 'v4',
    });
};

export const changeLanguage = async (lang: 'en' | 'tr') => {
  await AsyncStorage.setItem(LANGUAGE_KEY, lang);
  await i18n.changeLanguage(lang);
};

export default i18n;
