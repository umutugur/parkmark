import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { GlassCard } from '../../components/ui/GlassCard';
import { AppModal } from '../../components/ui/AppModal';
import { Button } from '../../components/ui/Button';
import { Colors, Spacing, BorderRadius, FontSizes, FontWeights } from '../../constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { requestLocationPermission } from '../../utils/permissions';
import { getCurrentLocation, openMapApp } from '../../utils/location';
import { apiService } from '../../services/api';
import { ParkingRecord } from '../../types';
import { useAuthGuard } from '../../hooks/useAuthGuard';
import { formatDuration } from '../../utils/time';

export default function HomeScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { requireAuth, modalProps, hideModal } = useAuthGuard();
  const mapRef = useRef<MapView>(null);
  const [currentLocation, setCurrentLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [activeParking, setActiveParking] = useState<ParkingRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [duration, setDuration] = useState('');

  const [locationModal, setLocationModal] = useState({ visible: false });

  const loadCurrentLocation = async () => {
    const hasPermission = await requestLocationPermission();
    if (!hasPermission) {
      setLocationModal({ visible: true });
      return;
    }

    const location = await getCurrentLocation();
    if (location) {
      setCurrentLocation(location);
      mapRef.current?.animateToRegion({
        latitude: location.latitude,
        longitude: location.longitude,
        latitudeDelta: 0.003,
        longitudeDelta: 0.003,
      });
    }
  };

  const loadActiveParking = async () => {
    try {
      const response = await apiService.getParkingList({ isActive: true, limit: 1 });
      const active = response?.items?.[0] ?? null;
      setActiveParking(active);
      
      if (active) {
        mapRef.current?.animateToRegion({
          latitude: active.latitude,
          longitude: active.longitude,
          latitudeDelta: 0.003,
          longitudeDelta: 0.003,
        });
      }
    } catch (error) {
      console.error('Error loading active parking:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCurrentLocation();
    loadActiveParking();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      loadActiveParking();
    }, [])
  );

  // Update duration timer
  useEffect(() => {
    if (!activeParking) return;

    const updateDuration = () => {
      setDuration(formatDuration(activeParking.parkedAt));
    };

    updateDuration();
    const interval = setInterval(updateDuration, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [activeParking]);

  const handleParkHere = () => {
    requireAuth(() => router.push('/home/save-parking'));
  };

  const handleNavigate = () => {
    requireAuth(() => {
      if (activeParking) {
        openMapApp(
          activeParking.latitude,
          activeParking.longitude,
          activeParking?.address ?? 'Parking Location'
        );
      }
    });
  };

  const handleViewDetails = () => {
    requireAuth(() => {
      if (activeParking?.id) {
        router.push(`/home/parking/${activeParking.id}`);
      }
    });
  };

  const handleSettings = () => {
    requireAuth(() => router.push('/home/settings'));
  };

  const handleHistory = () => {
    requireAuth(() => router.push('/home/history'));
  };

  return (
    <View style={styles.container}>
      <AppModal {...modalProps} onClose={hideModal} />
      <AppModal
        visible={locationModal.visible}
        title={t('common.error')}
        message={t('home.locationPermissionDenied')}
        onClose={() => setLocationModal({ visible: false })}
      />
      {/* Map */}
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        showsUserLocation
        showsMyLocationButton={false}
        initialRegion={{
          latitude: currentLocation?.latitude ?? 41.0082,
          longitude: currentLocation?.longitude ?? 28.9784,
          latitudeDelta: 0.003,
          longitudeDelta: 0.003,
        }}
      >
        {activeParking && (
          <Marker
            coordinate={{
              latitude: activeParking.latitude,
              longitude: activeParking.longitude,
            }}
            title={t('home.yourCarIsParked')}
            description={activeParking?.address ?? ''}
          >
            <View style={styles.markerContainer}>
              <Ionicons name="car" size={30} color={Colors.primary} />
            </View>
          </Marker>
        )}
      </MapView>

      {/* Top Bar */}
      <View style={[styles.topBar, { top: insets.top }]}>
        <View style={styles.logoContainer}>
          <Text style={styles.logoText}>{t('common.appName')}</Text>
        </View>
        <TouchableOpacity onPress={handleSettings} style={styles.iconButton}>
          <Ionicons name="settings-outline" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* Bottom Card */}
      <View style={[styles.bottomCard, { paddingBottom: insets.bottom + Spacing.lg }]}>
        <GlassCard style={styles.cardContent}>
          {activeParking ? (
            <>
              <View style={styles.statusRow}>
                <View style={styles.activeIndicator} />
                <Text style={styles.cardTitle}>{t('home.yourCarIsParked')}</Text>
              </View>
              <Text style={styles.address} numberOfLines={2}>
                {activeParking?.address ?? 'Unknown location'}
              </Text>
              <Text style={styles.duration}>
                {t('home.parkedSince')}: {duration}
              </Text>
              <View style={styles.buttonRow}>
                <Button
                  title={t('home.navigate')}
                  onPress={handleNavigate}
                  variant="secondary"
                  style={styles.halfButton}
                />
                <Button
                  title={t('home.details')}
                  onPress={handleViewDetails}
                  variant="outline"
                  style={styles.halfButton}
                />
              </View>
            </>
          ) : (
            <>
              <Text style={styles.cardTitle}>{t('home.noActiveParking')}</Text>
              <Button
                title={t('home.parkHere')}
                onPress={handleParkHere}
                style={styles.fullWidthButton}
              />
            </>
          )}
        </GlassCard>
      </View>

      {/* History FAB */}
      <TouchableOpacity style={[styles.fab, { bottom: 220 + insets.bottom }]} onPress={handleHistory}>
        <LinearGradient
          colors={[Colors.accent, Colors.accentLight]}
          style={styles.fabGradient}
        >
          <Ionicons name="time-outline" size={24} color="white" />
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
  },
  map: {
    flex: 1,
  },
  topBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
  },
  logoContainer: {
    backgroundColor: Colors.glassOverlay,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  logoText: {
    fontSize: FontSizes.subheading,
    fontWeight: FontWeights.bold,
    color: Colors.primary,
    fontFamily: 'Poppins-Bold',
  },
  iconButton: {
    backgroundColor: Colors.glassOverlay,
    padding: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  markerContainer: {
    backgroundColor: Colors.primary,
    padding: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 3,
    borderColor: 'white',
  },
  bottomCard: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.md,
  },
  cardContent: {
    paddingVertical: Spacing.lg,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  activeIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.success,
    marginRight: Spacing.sm,
  },
  cardTitle: {
    fontSize: FontSizes.subheading,
    fontWeight: FontWeights.semibold,
    color: Colors.textPrimary,
    fontFamily: 'Poppins-SemiBold',
  },
  address: {
    fontSize: FontSizes.body,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
    fontFamily: 'NunitoSans-Regular',
  },
  duration: {
    fontSize: FontSizes.caption,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
    fontFamily: 'NunitoSans-Regular',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  halfButton: {
    flex: 1,
  },
  fullWidthButton: {
    marginTop: Spacing.md,
  },
  fab: {
    position: 'absolute',
    right: Spacing.md,
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  fabGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
