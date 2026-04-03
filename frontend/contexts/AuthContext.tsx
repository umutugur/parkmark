import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import { User } from '../types';
import { apiService } from '../services/api';
import { initializePurchases } from '../services/purchases';
import { registerPushToken } from '../utils/notifications';

const TOKEN_KEY = 'auth_token';
const ONBOARDING_KEY = 'onboarding_completed';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isGuest: boolean;
  isOnboardingCompleted: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string) => Promise<void>;
  loginWithOAuth: (provider: 'google' | 'apple', idToken: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
  completeOnboarding: () => Promise<void>;
  refreshUser: () => Promise<void>;
  continueAsGuest: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(false);
  const [isOnboardingCompleted, setIsOnboardingCompleted] = useState(false);

  const saveToken = async (newToken: string) => {
    try {
      if (Platform.OS === 'web') {
        localStorage.setItem(TOKEN_KEY, newToken);
      } else {
        await SecureStore.setItemAsync(TOKEN_KEY, newToken);
      }
    } catch (error) {
      console.error('Error saving token:', error);
    }
  };

  const getToken = async (): Promise<string | null> => {
    try {
      if (Platform.OS === 'web') {
        return localStorage.getItem(TOKEN_KEY);
      } else {
        return await SecureStore.getItemAsync(TOKEN_KEY);
      }
    } catch (error) {
      console.error('Error getting token:', error);
      return null;
    }
  };

  const removeToken = async () => {
    try {
      if (Platform.OS === 'web') {
        localStorage.removeItem(TOKEN_KEY);
      } else {
        await SecureStore.deleteItemAsync(TOKEN_KEY);
      }
    } catch (error) {
      console.error('Error removing token:', error);
    }
  };

  const checkOnboarding = async () => {
    try {
      if (Platform.OS === 'web') {
        const completed = localStorage.getItem(ONBOARDING_KEY);
        setIsOnboardingCompleted(completed === 'true');
      } else {
        const completed = await SecureStore.getItemAsync(ONBOARDING_KEY);
        setIsOnboardingCompleted(completed === 'true');
      }
    } catch (error) {
      setIsOnboardingCompleted(false);
    }
  };

  const completeOnboarding = async () => {
    try {
      if (Platform.OS === 'web') {
        localStorage.setItem(ONBOARDING_KEY, 'true');
      } else {
        await SecureStore.setItemAsync(ONBOARDING_KEY, 'true');
      }
      setIsOnboardingCompleted(true);
    } catch (error) {
      console.error('Error saving onboarding status:', error);
    }
  };

  const loadUser = async (authToken: string) => {
    try {
      apiService.setToken(authToken);
      const userData = await apiService.getMe();
      setUser(userData?.user ?? null);
      setToken(authToken);
      // Token kaydı arka planda — UI'yi bloklamaz
      registerPushToken(apiService.updateNotificationPrefs.bind(apiService)).catch(() => {});
    } catch (error) {
      console.error('Error loading user:', error);
      await removeToken();
      setToken(null);
      setUser(null);
    }
  };

  useEffect(() => {
    const initAuth = async () => {
      setIsLoading(true);
      await checkOnboarding();
      const savedToken = await getToken();
      if (savedToken) {
        await loadUser(savedToken);
      }
      setIsLoading(false);
    };

    initAuth();
  }, []);

  const login = async (email: string, password: string) => {
    const response = await apiService.login(email, password);
    const newToken = response?.token ?? '';
    const userData = response?.user ?? null;
    
    if (newToken && userData) {
      await saveToken(newToken);
      apiService.setToken(newToken);
      setToken(newToken);
      setUser(userData);
      initializePurchases(userData.id);
    } else {
      throw new Error('Invalid login response');
    }
  };

  const signup = async (email: string, password: string, name: string) => {
    const response = await apiService.signup(email, password, name);
    const newToken = response?.token ?? '';
    const userData = response?.user ?? null;
    
    if (newToken && userData) {
      await saveToken(newToken);
      apiService.setToken(newToken);
      setToken(newToken);
      setUser(userData);
      initializePurchases(userData.id);
    } else {
      throw new Error('Invalid signup response');
    }
  };

  const loginWithOAuth = async (provider: 'google' | 'apple', idToken: string, name?: string) => {
    const response = await apiService.oauthLogin(provider, idToken, name);
    const newToken = response?.token ?? '';
    const userData = response?.user ?? null;

    if (newToken && userData) {
      await saveToken(newToken);
      apiService.setToken(newToken);
      setToken(newToken);
      setUser(userData);
      initializePurchases(userData.id);
    } else {
      throw new Error('Invalid OAuth response');
    }
  };

  const continueAsGuest = () => {
    setIsGuest(true);
    router.replace('/home');
  };

  const logout = async () => {
    await removeToken();
    apiService.setToken(null);
    setToken(null);
    setUser(null);
    setIsGuest(false);
    router.replace('/auth/login');
  };

  const refreshUser = async () => {
    try {
      const userData = await apiService.getMe();
      setUser(userData?.user ?? null);
    } catch (error) {
      console.error('[Auth] refreshUser failed:', error);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isGuest,
        isOnboardingCompleted,
        login,
        signup,
        loginWithOAuth,
        logout,
        completeOnboarding,
        refreshUser,
        continueAsGuest,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
