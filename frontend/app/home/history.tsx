import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Image,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { GlassCard } from '../../components/ui/GlassCard';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { Colors, Spacing, BorderRadius, FontSizes, FontWeights } from '../../constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { apiService } from '../../services/api';
import { ParkingRecord } from '../../types';
import { formatDateTime } from '../../utils/time';
import { Swipeable } from 'react-native-gesture-handler';
import { useAuth } from '../../contexts/AuthContext';
import { BANNER_AD_UNIT_ID } from '../../services/ads';
import Constants from 'expo-constants';

const isExpoGo = Constants.appOwnership === 'expo';
const { BannerAd, BannerAdSize } = isExpoGo ? ({} as any) : require('react-native-google-mobile-ads');

const AD_INTERVAL = 4; // Her 4 park itemından sonra 1 reklam

type FilterType = 'all' | 'active' | 'past';
type ListItem = ParkingRecord | { type: 'ad'; id: string };

export default function HistoryScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [parkingRecords, setParkingRecords] = useState<ParkingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterType>('all');

  const loadParkingRecords = async () => {
    try {
      const params: any = { page: 1, limit: 100 };
      if (filter === 'active') params.isActive = true;
      if (filter === 'past') params.isActive = false;

      const response = await apiService.getParkingList(params);
      setParkingRecords(response?.items ?? []);
    } catch (error) {
      Alert.alert(t('common.error'), t('history.loadingError'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadParkingRecords();
  }, [filter]);

  useFocusEffect(
    React.useCallback(() => {
      loadParkingRecords();
    }, [filter])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    loadParkingRecords();
  };

  const handleDelete = async (id: string) => {
    Alert.alert(
      t('history.deleteConfirm'),
      '',
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await apiService.deleteParking(id);
              Alert.alert(t('common.success'), t('history.deleteSuccess'));
              loadParkingRecords();
            } catch (error) {
              Alert.alert(t('common.error'), t('history.deleteError'));
            }
          },
        },
      ]
    );
  };

  // Her 4 park itemından sonra reklam ekleyerek mixed list oluştur
  const buildListData = (records: ParkingRecord[]): ListItem[] => {
    if (user?.isSubscribed || isExpoGo) return records;
    const result: ListItem[] = [];
    records.forEach((record, index) => {
      result.push(record);
      if ((index + 1) % AD_INTERVAL === 0) {
        result.push({ type: 'ad', id: `ad_${index}` });
      }
    });
    return result;
  };

  const renderRightActions = (id: string) => (
    <TouchableOpacity
      style={styles.deleteButton}
      onPress={() => handleDelete(id)}
    >
      <Ionicons name="trash-outline" size={24} color="white" />
    </TouchableOpacity>
  );

  const renderAdItem = () => (
    <View style={styles.adItem}>
      <BannerAd
        unitId={BANNER_AD_UNIT_ID}
        size={BannerAdSize.INLINE_ADAPTIVE_BANNER}
      />
    </View>
  );

  const renderItem = ({ item }: { item: ListItem }) => {
    if ('type' in item && item.type === 'ad') {
      return renderAdItem();
    }
    const record = item as ParkingRecord;
    return (
      <Swipeable renderRightActions={() => renderRightActions(record.id)}>
        <TouchableOpacity
          onPress={() => router.push(`/home/parking/${record.id}`)}
          style={styles.itemContainer}
        >
          <GlassCard style={styles.itemCard}>
            <View style={styles.itemContent}>
              <View style={styles.itemLeft}>
                {record?.photoCloudStoragePath ? (
                  <Image
                    source={{ uri: record.photoCloudStoragePath }}
                    style={styles.thumbnail}
                  />
                ) : (
                  <View style={styles.thumbnailPlaceholder}>
                    <Ionicons name="car-outline" size={24} color={Colors.textSecondary} />
                  </View>
                )}
              </View>
              <View style={styles.itemCenter}>
                <Text style={styles.itemAddress} numberOfLines={1}>
                  {record?.address ?? 'Unknown location'}
                </Text>
                <Text style={styles.itemDate}>
                  {formatDateTime(record.parkedAt)}
                </Text>
                {(record?.floor || record?.section) && (
                  <Text style={styles.itemDetails}>
                    {record?.floor ? `Floor ${record.floor}` : ''}
                    {record?.floor && record?.section ? ' • ' : ''}
                    {record?.section ? `Section ${record.section}` : ''}
                  </Text>
                )}
              </View>
              <View style={styles.itemRight}>
                {record.isActive && <View style={styles.activeIndicator} />}
                <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
              </View>
            </View>
          </GlassCard>
        </TouchableOpacity>
      </Swipeable>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="car-outline" size={80} color={Colors.textSecondary} />
      <Text style={styles.emptyTitle}>{t('history.empty')}</Text>
      <Text style={styles.emptySubtitle}>{t('history.emptySubtitle')}</Text>
    </View>
  );

  if (loading) {
    return <LoadingSpinner message={t('common.loading')} />;
  }

  return (
    <LinearGradient colors={[Colors.bgDeep, Colors.bgPrimary]} style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('history.title')}</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Filter Chips */}
      <View style={styles.filterContainer}>
        {(['all', 'active', 'past'] as FilterType[]).map((filterType) => (
          <TouchableOpacity
            key={filterType}
            style={[
              styles.filterChip,
              filter === filterType && styles.filterChipActive,
            ]}
            onPress={() => setFilter(filterType)}
          >
            <Text
              style={[
                styles.filterChipText,
                filter === filterType && styles.filterChipTextActive,
              ]}
            >
              {t(`history.${filterType}`)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* List */}
      <FlatList<ListItem>
        data={buildListData(parkingRecords)}
        renderItem={renderItem}
        keyExtractor={(item) => ('type' in item ? item.id : (item as ParkingRecord).id)}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + Spacing.md }]}
        ListEmptyComponent={renderEmpty}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={Colors.primary}
          />
        }
      />
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
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
    gap: Spacing.sm,
  },
  filterChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.surface,
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterChipText: {
    fontSize: FontSizes.caption,
    color: Colors.textSecondary,
    fontFamily: 'NunitoSans-Medium',
  },
  filterChipTextActive: {
    color: Colors.bgDeep,
    fontWeight: FontWeights.semibold,
  },
  listContent: {
    padding: Spacing.md,
  },
  adItem: {
    marginVertical: Spacing.xs,
    alignItems: 'center',
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
  },
  itemContainer: {
    marginBottom: Spacing.md,
  },
  itemCard: {
    padding: Spacing.md,
  },
  itemContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemLeft: {
    marginRight: Spacing.md,
  },
  thumbnail: {
    width: 60,
    height: 60,
    borderRadius: 10,
  },
  thumbnailPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 10,
    backgroundColor: Colors.bgCard,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemCenter: {
    flex: 1,
  },
  itemAddress: {
    fontSize: FontSizes.body,
    color: Colors.textPrimary,
    marginBottom: 4,
    fontFamily: 'NunitoSans-Medium',
  },
  itemDate: {
    fontSize: FontSizes.caption,
    color: Colors.textSecondary,
    fontFamily: 'NunitoSans-Regular',
  },
  itemDetails: {
    fontSize: FontSizes.caption,
    color: Colors.textSecondary,
    marginTop: 2,
    fontFamily: 'NunitoSans-Regular',
  },
  itemRight: {
    alignItems: 'center',
    marginLeft: Spacing.sm,
  },
  activeIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.success,
    marginBottom: 4,
  },
  deleteButton: {
    backgroundColor: Colors.error,
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    marginBottom: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
  },
  emptyTitle: {
    fontSize: FontSizes.heading,
    fontWeight: FontWeights.semibold,
    color: Colors.textPrimary,
    marginTop: Spacing.md,
    fontFamily: 'Poppins-SemiBold',
  },
  emptySubtitle: {
    fontSize: FontSizes.body,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
    fontFamily: 'NunitoSans-Regular',
  },
});
