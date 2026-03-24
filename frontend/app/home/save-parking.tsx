import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  Platform,
  KeyboardAvoidingView,
  ActionSheetIOS,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import MapView, { Marker } from 'react-native-maps';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { GlassCard } from '../../components/ui/GlassCard';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { Colors, Spacing, BorderRadius, FontSizes, FontWeights } from '../../constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { requestCameraPermission, requestGalleryPermission } from '../../utils/permissions';
import { getCurrentLocation, reverseGeocode } from '../../utils/location';
import { apiService } from '../../services/api';
import { ParkingRecord } from '../../types';
import { scheduleReminderNotification, requestNotificationPermission } from '../../utils/notifications';

interface PhotoAsset {
  uri: string;
  type: string;
  fileName: string;
}

export default function SaveParkingScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const isEditMode = !!id;

  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(isEditMode);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [address, setAddress] = useState('');
  const [photo, setPhoto] = useState<PhotoAsset | null>(null);
  const [existingPhotoPath, setExistingPhotoPath] = useState<string | null>(null);
  const [floor, setFloor] = useState('');
  const [section, setSection] = useState('');
  const [spotNumber, setSpotNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderDuration, setReminderDuration] = useState<number>(60); // minutes
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (isEditMode && id) {
      loadParkingRecord(id);
    } else {
      loadCurrentLocation();
    }
  }, [id]);

  const loadParkingRecord = async (parkingId: string) => {
    try {
      const record = await apiService.getParkingById(parkingId);
      setLocation({ latitude: record.latitude, longitude: record.longitude });
      setAddress(record?.address ?? '');
      setExistingPhotoPath(record?.photoCloudStoragePath ?? null);
      setFloor(record?.floor ?? '');
      setSection(record?.section ?? '');
      setSpotNumber(record?.spotNumber ?? '');
      setNotes(record?.notes ?? '');
      if (record?.reminderTime) {
        setReminderEnabled(true);
      }
    } catch (error) {
      Alert.alert(t('common.error'), t('errors.somethingWentWrong'));
      router.back();
    } finally {
      setInitialLoading(false);
    }
  };

  const loadCurrentLocation = async () => {
    const loc = await getCurrentLocation();
    if (loc) {
      setLocation(loc);
      const addr = await reverseGeocode(loc.latitude, loc.longitude);
      setAddress(addr ?? 'Unknown location');
    }
    setInitialLoading(false);
  };

  const handleSelectPhoto = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [t('common.cancel'), t('saveParking.takePhoto'), t('saveParking.chooseFromGallery')],
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) {
            handleTakePhoto();
          } else if (buttonIndex === 2) {
            handleChoosePhoto();
          }
        }
      );
    } else {
      Alert.alert(
        t('saveParking.addPhoto'),
        '',
        [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('saveParking.takePhoto'), onPress: handleTakePhoto },
          { text: t('saveParking.chooseFromGallery'), onPress: handleChoosePhoto },
        ]
      );
    }
  };

  const handleTakePhoto = async () => {
    const hasPermission = await requestCameraPermission();
    if (!hasPermission) {
      Alert.alert(t('common.error'), t('saveParking.cameraPermissionDenied'));
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      allowsEditing: true,
      aspect: [4, 3],
    });

    if (!result.canceled && result?.assets?.[0]) {
      const asset = result.assets[0];
      setPhoto({
        uri: asset.uri,
        type: asset?.type ?? 'image',
        fileName: asset?.fileName ?? `photo-${Date.now()}.jpg`,
      });
      setHasChanges(true);
    }
  };

  const handleChoosePhoto = async () => {
    const hasPermission = await requestGalleryPermission();
    if (!hasPermission) {
      Alert.alert(t('common.error'), t('saveParking.galleryPermissionDenied'));
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      allowsEditing: true,
      aspect: [4, 3],
    });

    if (!result.canceled && result?.assets?.[0]) {
      const asset = result.assets[0];
      setPhoto({
        uri: asset.uri,
        type: asset?.type ?? 'image',
        fileName: asset?.fileName ?? `photo-${Date.now()}.jpg`,
      });
      setHasChanges(true);
    }
  };

  const uploadPhoto = async (): Promise<string | null> => {
    if (!photo) return existingPhotoPath;

    try {
      // Get Cloudinary signed upload params
      const presignedData = await apiService.getPresignedUploadUrl(
        photo.fileName,
        'image/jpeg',
        false
      );

      // Upload to Cloudinary
      const { secure_url } = await apiService.uploadFileToCloudinary(presignedData, { uri: photo.uri, name: photo.fileName }, 'image/jpeg');

      // Complete upload
      await apiService.completeFileUpload(
        presignedData.public_id,
        photo.fileName,
        'image/jpeg',
        false
      );

      return secure_url;
    } catch (error) {
      console.error('Error uploading photo:', error);
      throw error;
    }
  };

  const handleSave = async () => {
    if (!location) {
      Alert.alert(t('common.error'), t('home.locationError'));
      return;
    }

    setLoading(true);
    try {
      let photoPath: string | null = existingPhotoPath;
      
      if (photo) {
        photoPath = await uploadPhoto();
      }

      const parkingData = {
        latitude: location.latitude,
        longitude: location.longitude,
        address,
        photoCloudStoragePath: photoPath ?? undefined,
        photoIsPublic: false,
        notes: notes || undefined,
        floor: floor || undefined,
        section: section || undefined,
        spotNumber: spotNumber || undefined,
        parkedAt: new Date().toISOString(),
        reminderTime: reminderEnabled
          ? new Date(Date.now() + reminderDuration * 60000).toISOString()
          : null,
      };

      if (isEditMode && id) {
        await apiService.updateParking(id, parkingData);
        Alert.alert(t('common.success'), t('saveParking.updateSuccess'));
      } else {
        await apiService.createParking(parkingData);
        Alert.alert(t('common.success'), t('saveParking.saveSuccess'));

        // Schedule reminder notification
        if (reminderEnabled) {
          const hasNotifPermission = await requestNotificationPermission();
          if (hasNotifPermission) {
            await scheduleReminderNotification(
              t('notifications.parkingReminder'),
              address,
              new Date(Date.now() + reminderDuration * 60000),
              { parkingId: id }
            );
          }
        }
      }

      router.replace('/home');
    } catch (error: any) {
      const isLimitError =
        error?.response?.status === 403 &&
        error?.response?.data?.message === 'PIN_LIMIT_REACHED';
      if (isLimitError) {
        router.push('/paywall');
      } else {
        Alert.alert(t('common.error'), t('saveParking.saveError'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (hasChanges) {
      Alert.alert(
        t('saveParking.discardChanges'),
        t('saveParking.discardMessage'),
        [
          { text: t('common.no'), style: 'cancel' },
          { text: t('common.yes'), onPress: () => router.back() },
        ]
      );
    } else {
      router.back();
    }
  };

  if (initialLoading) {
    return <LoadingSpinner message={t('common.loading')} />;
  }

  return (
    <LinearGradient colors={[Colors.bgDeep, Colors.bgPrimary]} style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top }]}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {isEditMode ? t('saveParking.editTitle') : t('saveParking.title')}
          </Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Mini Map */}
          {location && (
            <MapView
              style={styles.miniMap}
              initialRegion={{
                latitude: location.latitude,
                longitude: location.longitude,
                latitudeDelta: 0.005,
                longitudeDelta: 0.005,
              }}
              scrollEnabled={false}
              zoomEnabled={false}
            >
              <Marker coordinate={location}>
                <Ionicons name="car" size={30} color={Colors.primary} />
              </Marker>
            </MapView>
          )}
          <Text style={styles.addressText}>{address}</Text>

          {/* Photo Section */}
          <GlassCard style={styles.section}>
            <Text style={styles.sectionTitle}>{t('saveParking.addPhoto')}</Text>
            <TouchableOpacity
              style={styles.photoButton}
              onPress={handleSelectPhoto}
            >
              {photo?.uri || existingPhotoPath ? (
                <Image
                  source={{ uri: photo?.uri ?? existingPhotoPath ?? undefined }}
                  style={styles.photoPreview}
                />
              ) : (
                <View style={styles.photoPlaceholder}>
                  <Ionicons name="camera" size={40} color={Colors.textSecondary} />
                  <Text style={styles.photoPlaceholderText}>
                    {t('saveParking.addPhoto')}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </GlassCard>

          {/* Details Section */}
          <GlassCard style={styles.section}>
            <Input
              label={t('saveParking.floor')}
              value={floor}
              onChangeText={(text) => {
                setFloor(text);
                setHasChanges(true);
              }}
              placeholder="e.g., 2"
            />
            <Input
              label={t('saveParking.section')}
              value={section}
              onChangeText={(text) => {
                setSection(text);
                setHasChanges(true);
              }}
              placeholder="e.g., A"
            />
            <Input
              label={t('saveParking.spotNumber')}
              value={spotNumber}
              onChangeText={(text) => {
                setSpotNumber(text);
                setHasChanges(true);
              }}
              placeholder="e.g., 42"
            />
            <Input
              label={t('saveParking.notes')}
              value={notes}
              onChangeText={(text) => {
                setNotes(text);
                setHasChanges(true);
              }}
              multiline
              numberOfLines={3}
              style={{ height: 80 }}
            />
          </GlassCard>

          {/* Reminder Section */}
          <GlassCard style={styles.section}>
            <View style={styles.reminderRow}>
              <Text style={styles.sectionTitle}>{t('saveParking.setReminder')}</Text>
              <TouchableOpacity
                onPress={() => {
                  setReminderEnabled(!reminderEnabled);
                  setHasChanges(true);
                }}
                style={[
                  styles.toggle,
                  reminderEnabled && styles.toggleActive,
                ]}
              >
                <View
                  style={[
                    styles.toggleThumb,
                    reminderEnabled && styles.toggleThumbActive,
                  ]}
                />
              </TouchableOpacity>
            </View>
            {reminderEnabled && (
              <View style={styles.reminderOptions}>
                {[30, 60, 120, 240].map((duration) => (
                  <TouchableOpacity
                    key={duration}
                    style={[
                      styles.reminderChip,
                      reminderDuration === duration && styles.reminderChipActive,
                    ]}
                    onPress={() => {
                      setReminderDuration(duration);
                      setHasChanges(true);
                    }}
                  >
                    <Text
                      style={[
                        styles.reminderChipText,
                        reminderDuration === duration && styles.reminderChipTextActive,
                      ]}
                    >
                      {duration === 30 && t('saveParking.reminder30min')}
                      {duration === 60 && t('saveParking.reminder1h')}
                      {duration === 120 && t('saveParking.reminder2h')}
                      {duration === 240 && t('saveParking.reminder4h')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </GlassCard>

          {/* Save Button */}
          <Button
            title={
              isEditMode
                ? t('saveParking.updateButton')
                : t('saveParking.saveButton')
            }
            onPress={handleSave}
            loading={loading}
            style={styles.saveButton}
          />
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.md,
  },
  miniMap: {
    height: 200,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.sm,
  },
  addressText: {
    fontSize: FontSizes.body,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
    fontFamily: 'NunitoSans-Regular',
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
  photoButton: {
    marginTop: Spacing.sm,
  },
  photoPreview: {
    width: '100%',
    height: 200,
    borderRadius: BorderRadius.md,
  },
  photoPlaceholder: {
    width: '100%',
    height: 200,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.bgCard,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.surface,
    borderStyle: 'dashed',
  },
  photoPlaceholderText: {
    marginTop: Spacing.sm,
    fontSize: FontSizes.body,
    color: Colors.textSecondary,
    fontFamily: 'NunitoSans-Regular',
  },
  reminderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  toggle: {
    width: 50,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.surface,
    padding: 3,
  },
  toggleActive: {
    backgroundColor: Colors.primary,
  },
  toggleThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'white',
  },
  toggleThumbActive: {
    transform: [{ translateX: 20 }],
  },
  reminderOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  reminderChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.surface,
  },
  reminderChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  reminderChipText: {
    fontSize: FontSizes.caption,
    color: Colors.textSecondary,
    fontFamily: 'NunitoSans-Medium',
  },
  reminderChipTextActive: {
    color: Colors.bgDeep,
  },
  saveButton: {
    marginTop: Spacing.md,
    marginBottom: Spacing.xxl,
  },
});
