// screens/director/DirectorNotificationsScreen.tsx
// Two-tab feed: Absences and Admissions, both read-only for the Director.

import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { BlurView } from 'expo-blur';
import { colors, fonts, fontSizes, radii, spacing, shadow } from '../../theme/theme';
import { API_URL } from '../../config/api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Tab = 'absences' | 'admissions';

type AbsenceNotification = {
  id: string;
  attendance_date: string;
  is_read: boolean;
  called: boolean;
  first_name: string;
  last_name: string;
  guardian_name: string | null;
  guardian_phone: string | null;
  class_name: string;
};

type AdmissionNotification = {
  id: string;
  is_read: boolean;
  created_at: string;
  first_name: string;
  last_name: string;
  gender: 'M' | 'F';
  admission_number: string | null;
  class_name: string;
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function DirectorNotificationsScreen({ token, onBack }: { token: string; onBack: () => void }) {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>('absences');
  const [loading, setLoading] = useState(true);
  const [absences, setAbsences] = useState<AbsenceNotification[]>([]);
  const [admissions, setAdmissions] = useState<AdmissionNotification[]>([]);
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [absRes, admRes] = await Promise.all([
        fetch(`${API_URL}/api/director/notifications/absences`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_URL}/api/director/notifications/admissions`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const absData = await absRes.json();
      if (!absRes.ok) throw new Error(absData.error || 'Failed to load absence notifications');
      const admData = await admRes.json();
      if (!admRes.ok) throw new Error(admData.error || 'Failed to load admission notifications');
      setAbsences(absData.notifications);
      setAdmissions(admData.notifications);
    } catch (e: any) {
      setError(e.message || 'Could not reach the server.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <View style={styles.container}>
      <Pressable onPress={onBack} style={[styles.backRow, { paddingTop: insets.top + spacing.sm }]}>
        <Text style={styles.backArrow}>‹</Text>
        <Text style={styles.backText}>Overview</Text>
      </Pressable>

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={styles.tabRow}>
          <TabButton label={`Absences (${absences.length})`} active={tab === 'absences'} onPress={() => setTab('absences')} />
          <TabButton label={`Admissions (${admissions.length})`} active={tab === 'admissions'} onPress={() => setTab('admissions')} />
        </View>
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.indigo} />
        </View>
      ) : tab === 'absences' ? (
        <FlatList
          data={absences}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.emptyText}>No absence notifications.</Text>}
          renderItem={({ item }) => (
            <View style={[shadow.card, styles.cardWrap]}>
              <View style={styles.card}>
                <BlurView intensity={25} tint="light" style={StyleSheet.absoluteFill} />
                <View style={[StyleSheet.absoluteFill, { backgroundColor: item.is_read ? colors.white : colors.coralLight }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName}>
                    {item.first_name} {item.last_name} <Text style={styles.itemMuted}>· {item.class_name}</Text>
                  </Text>
                  <Text style={styles.itemDetail}>Absent {formatDate(item.attendance_date)}</Text>
                  {item.guardian_name ? (
                    <Text style={styles.itemDetail}>
                      Guardian: {item.guardian_name}{item.guardian_phone ? ` · ${item.guardian_phone}` : ''}
                    </Text>
                  ) : null}
                  <View style={[styles.calledBadge, { backgroundColor: item.called ? colors.leafLight : colors.coralLight }]}>
                    <Text style={[styles.calledBadgeText, { color: item.called ? colors.leaf : colors.coral }]}>
                      {item.called ? 'Called' : 'Not called yet'}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          )}
        />
      ) : (
        <FlatList
          data={admissions}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.emptyText}>No admission notifications.</Text>}
          renderItem={({ item }) => (
            <View style={[shadow.card, styles.cardWrap]}>
              <View style={styles.card}>
                <BlurView intensity={25} tint="light" style={StyleSheet.absoluteFill} />
                <View style={[StyleSheet.absoluteFill, { backgroundColor: item.is_read ? colors.white : colors.leafLight }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName}>
                    {item.first_name} {item.last_name} <Text style={styles.itemMuted}>· {item.class_name}</Text>
                  </Text>
                  <Text style={styles.itemDetail}>
                    Admitted {formatDate(item.created_at)} · {item.admission_number || 'No admission number'}
                  </Text>
                </View>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

function TabButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.tabButton, active && styles.tabButtonActive]} onPress={onPress}>
      <Text style={[styles.tabButtonText, active && styles.tabButtonTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cloud },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.base, color: colors.charcoalMuted, textAlign: 'center' },
  errorText: { fontFamily: fonts.bodySemiBold, color: colors.coral, textAlign: 'center', marginBottom: spacing.sm },
  backRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  backArrow: { fontFamily: fonts.bodyBold, fontSize: fontSizes.xl, color: colors.indigo, marginRight: 4 },
  backText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.base, color: colors.indigo },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  headerTitle: { fontFamily: fonts.display, fontSize: fontSizes.xxl, color: colors.indigo, marginBottom: spacing.sm },
  tabRow: { flexDirection: 'row', backgroundColor: colors.white, borderRadius: radii.pill, padding: 4, borderWidth: 1, borderColor: colors.line },
  tabButton: { flex: 1, paddingVertical: spacing.sm, borderRadius: radii.pill, alignItems: 'center' },
  tabButtonActive: { backgroundColor: colors.indigo },
  tabButtonText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.charcoalMuted },
  tabButtonTextActive: { color: colors.white },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  cardWrap: { marginBottom: spacing.sm, borderRadius: radii.lg, overflow: 'hidden' },
  card: { flexDirection: 'row', alignItems: 'center', borderRadius: radii.lg, padding: spacing.md, overflow: 'hidden', borderWidth: 1, borderColor: colors.line },
  itemName: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.base, color: colors.charcoal },
  itemMuted: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.charcoalMuted },
  itemDetail: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.charcoalMuted, marginTop: 2 },
  calledBadge: {
    alignSelf: 'flex-start',
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    marginTop: spacing.xs,
  },
  calledBadgeText: { fontFamily: fonts.bodyBold, fontSize: fontSizes.xs },
});