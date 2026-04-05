import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Modal,
  StatusBar,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import MapView, { Marker } from 'react-native-maps';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { GlassCard } from '../../../components/ui/GlassCard';
import { AppModal, AppModalProps } from '../../../components/ui/AppModal';
import { Button } from '../../../components/ui/Button';
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner';
import { Colors, Spacing, BorderRadius, FontSizes, FontWeights } from '../../../constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { apiService } from '../../../services/api';
import { ParkingRecord } from '../../../types';
import { formatDateTime, formatDuration } from '../../../utils/time';
import { openMapApp } from '../../../utils/location';

export default function ParkingDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [modal, setModal] = useState<Omit<AppModalProps, 'onClose'>>({ visible: false });
  const showAlert = (title: string, message?: string, buttons?: AppModalProps['buttons']) =>
    setModal({ visible: true, title, message, buttons });
  const hideModal = () => setModal((m) => ({ ...m, visible: false }));

  const [parking, setParking] = useState<ParkingRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoModalVisible, setPhotoModalVisible] = useState(false);

  useEffect(() => {
    if (id) {
      loadParkingDetail();
    }
  }, [id]);

  const loadParkingDetail = async () => {
    try {
      const record = await apiService.getParkingById(id ?? '');
      setParking(record);

      if (record?.photoCloudStoragePath) {
        setPhotoUrl(record.photoCloudStoragePath);
      }
    } catch (error) {
      showAlert(t('common.error'), t('errors.somethingWentWrong'), [
        { text: 'Tamam', onPress: () => router.back() },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleNavigate = () => {
    if (parking) {
      openMapApp(
        parking.latitude,
        parking.longitude,
        parking?.address ?? 'Parking Location'
      );
    }
  };

  const handleEdit = () => {
    if (id) {
      router.push(`/home/save-parking?id=${id}`);
    }
  };

  const handlePickedUp = () => {
    showAlert(t('parkingDetail.pickedUpConfirm'), t('parkingDetail.pickedUpMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.yes'),
        onPress: async () => {
          try {
            await apiService.updateParking(id ?? '', { isActive: false });
            router.replace('/home');
          } catch (error) {
            showAlert(t('common.error'), t('errors.somethingWentWrong'));
          }
        },
      },
    ]);
  };

  if (loading || !parking) {
    return <LoadingSpinner message={t('common.loading')} />;
  }

  return (
    <LinearGradient colors={[Colors.bgDeep, Colors.bgPrimary]} style={styles.container}>
      <AppModal {...modal} onClose={hideModal} />
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('parkingDetail.title')}</Text>
        <TouchableOpacity onPress={handleEdit} style={styles.editButton}>
          <Ionicons name="pencil" size={20} color={Colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + Spacing.xl }]}>
        {/* Map Section */}
        {parking.latitude != null && parking.longitude != null ? (
          <MapView
            style={styles.map}
            initialRegion={{
              latitude: parking.latitude,
              longitude: parking.longitude,
              latitudeDelta: 0.005,
              longitudeDelta: 0.005,
            }}
            scrollEnabled={false}
            zoomEnabled={false}
          >
            <Marker
              coordinate={{
                latitude: parking.latitude,
                longitude: parking.longitude,
              }}
            >
              <Ionicons name="car" size={30} color={Colors.primary} />
            </Marker>
          </MapView>
        ) : (
          <View style={[styles.map, styles.mapPlaceholder]}>
            <Ionicons name="map-outline" size={40} color={Colors.textSecondary} />
          </View>
        )}

        {/* Address Card */}
        <GlassCard style={styles.section}>
          <Text style={styles.sectionTitle}>{t('parkingDetail.address')}</Text>
          <Text style={styles.addressText}>
            {parking?.address ?? 'Unknown location'}
          </Text>
          {parking.latitude != null && parking.longitude != null && (
            <Text style={styles.coordinatesText}>
              {t('parkingDetail.coordinates')}: {parking.latitude.toFixed(6)}, {parking.longitude.toFixed(6)}
            </Text>
          )}
        </GlassCard>

        {/* Photo */}
        {photoUrl && (
          <GlassCard style={styles.section}>
            <TouchableOpacity onPress={() => setPhotoModalVisible(true)} activeOpacity={0.9}>
              <Image source={{ uri: photoUrl }} style={styles.photo} resizeMode="cover" />
            </TouchableOpacity>
          </GlassCard>
        )}

        {/* Full Screen Photo Modal */}
        <Modal visible={photoModalVisible} transparent animationType="fade" onRequestClose={() => setPhotoModalVisible(false)}>
          <StatusBar backgroundColor="#000" barStyle="light-content" />
          <View style={styles.modalContainer}>
            <TouchableOpacity style={[styles.modalClose, { top: insets.top + 10 }]} onPress={() => setPhotoModalVisible(false)}>
              <Ionicons name="close" size={30} color="white" />
            </TouchableOpacity>
            <Image source={{ uri: photoUrl ?? undefined }} style={styles.modalImage} resizeMode="contain" />
          </View>
        </Modal>

        {/* Info Card */}
        <GlassCard style={styles.section}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{t('parkingDetail.parkedAt')}</Text>
            <Text style={styles.infoValue}>{formatDateTime(parking.parkedAt)}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{t('parkingDetail.duration')}</Text>
            <Text style={styles.infoValue}>{formatDuration(parking.parkedAt)}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{t('parkingDetail.floor')}</Text>
            <Text style={styles.infoValue}>
              {parking?.floor ?? t('parkingDetail.noValue')}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{t('parkingDetail.section')}</Text>
            <Text style={styles.infoValue}>
              {parking?.section ?? t('parkingDetail.noValue')}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{t('parkingDetail.spotNumber')}</Text>
            <Text style={styles.infoValue}>
              {parking?.spotNumber ?? t('parkingDetail.noValue')}
            </Text>
          </View>
        </GlassCard>

        {/* Notes Card */}
        {parking?.notes && (
          <GlassCard style={styles.section}>
            <Text style={styles.sectionTitle}>{t('parkingDetail.notes')}</Text>
            <Text style={styles.notesText}>{parking.notes}</Text>
          </GlassCard>
        )}

        {/* Reminder Card */}
        {parking?.reminderTime && (
          <GlassCard style={styles.section}>
            <Text style={styles.sectionTitle}>{t('parkingDetail.reminder')}</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>{formatDateTime(parking.reminderTime)}</Text>
              <View
                style={[
                  styles.reminderBadge,
                  parking.reminderSent && styles.reminderBadgeSent,
                ]}
              >
                <Text
                  style={[
                    styles.reminderBadgeText,
                    parking.reminderSent && styles.reminderBadgeTextSent,
                  ]}
                >
                  {parking.reminderSent
                    ? t('parkingDetail.reminderSent')
                    : t('parkingDetail.reminderPending')}
                </Text>
              </View>
            </View>
          </GlassCard>
        )}

        {/* Action Buttons */}
        <Button
          title={t('parkingDetail.navigateButton')}
          onPress={handleNavigate}
          variant="secondary"
          style={styles.navigateButton}
        />
        <Button
          title={t('parkingDetail.pickedUpButton')}
          onPress={handlePickedUp}
          variant="outline"
          style={styles.deleteButton}
        />
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: FontSizes.heading,
    fontWeight: FontWeights.semibold,
    color: Colors.textPrimary,
    fontFamily: 'Poppins-SemiBold',
  },
  editButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.md,
  },
  map: {
    height: 250,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
  },
  mapPlaceholder: {
    backgroundColor: Colors.bgCard,
    justifyContent: 'center',
    alignItems: 'center',
  },
  section: {
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: FontSizes.body,
    fontWeight: FontWeights.semibold,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
    fontFamily: 'Poppins-SemiBold',
  },
  addressText: {
    fontSize: FontSizes.body,
    color: Colors.textPrimary,
    lineHeight: 24,
    fontFamily: 'NunitoSans-Regular',
  },
  coordinatesText: {
    fontSize: FontSizes.caption,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
    fontFamily: 'NunitoSans-Regular',
  },
  photo: {
    width: '100%',
    height: 200,
    borderRadius: BorderRadius.md,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  infoLabel: {
    fontSize: FontSizes.body,
    color: Colors.textSecondary,
    fontFamily: 'NunitoSans-Regular',
  },
  infoValue: {
    fontSize: FontSizes.body,
    color: Colors.textPrimary,
    fontWeight: FontWeights.medium,
    fontFamily: 'NunitoSans-Medium',
  },
  notesText: {
    fontSize: FontSizes.body,
    color: Colors.textPrimary,
    lineHeight: 24,
    fontFamily: 'NunitoSans-Regular',
  },
  reminderBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.warning,
  },
  reminderBadgeSent: {
    backgroundColor: Colors.success,
  },
  reminderBadgeText: {
    fontSize: FontSizes.caption,
    color: Colors.bgDeep,
    fontFamily: 'NunitoSans-Medium',
  },
  reminderBadgeTextSent: {
    color: 'white',
  },
  navigateButton: {
    marginBottom: Spacing.md,
  },
  deleteButton: {
    marginBottom: Spacing.xxl,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalClose: {
    position: 'absolute',
    right: Spacing.md,
    zIndex: 1,
    padding: Spacing.sm,
  },
  modalImage: {
    width: '100%',
    height: '100%',
  },
});
