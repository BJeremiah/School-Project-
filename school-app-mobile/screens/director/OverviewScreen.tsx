// screens/director/OverviewScreen.tsx
// Director's landing screen — school-wide snapshot for today: student counts by class,
// today's attendance, fees collected today, this month's salary payout.
// "⋮" menu links to every other Director section.

import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, ActivityIndicator, Modal } from 'react-native';
import { colors, fonts, fontSizes, radii, spacing, shadow } from '../../theme/theme';
import { API_URL } from '../../config/api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type ClassBreakdown = {
  class_name: string;
  total_students: string;
  male_count: string;
  female_count: string;
};

type Overview = {
  date: string;
  students: { total: string; male: string; female: string };
  by_class: ClassBreakdown[];
  attendance_today: { total_present: string; total_absent: string };
  fees_collected_today: number;
  salary_payout_this_month: number;
};

export default function OverviewScreen({
  token,
  onViewClasses,
  onSearchStudents,
  onViewNotifications,
  onViewStaff,
  onViewRecords,
  onViewStatistics,
  onViewProfile,
}: {
  token: string;
  onViewClasses: () => void;
  onSearchStudents: () => void;
  onViewNotifications: () => void;
  onViewStaff: () => void;
  onViewRecords: () => void;
  onViewStatistics: () => void;
  onViewProfile: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [error, setError] = useState('');
  const [menuVisible, setMenuVisible] = useState(false);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/director/overview`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load overview');
      setOverview(data);
    } catch (e: any) {
      setError(e.message || 'Could not reach the server.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  const menuAction = (action: () => void) => {
    setMenuVisible(false);
    action();
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.indigo} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <View style={styles.titleRow}>
          <View>
            <Text style={styles.headerTitle}>Overview</Text>
            <Text style={styles.headerSubtitle}>
              {overview ? new Date(overview.date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }) : ''}
            </Text>
          </View>
          <Pressable style={styles.menuButton} onPress={() => setMenuVisible(true)}>
            <Text style={styles.menuButtonText}>⋮</Text>
          </Pressable>
        </View>
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {overview && (
        <FlatList
          data={overview.by_class}
          keyExtractor={(item) => item.class_name}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <>
              <View style={styles.statsRow}>
                <StatCard label="Students" value={overview.students.total} color={colors.indigo} />
                <StatCard label="Boys" value={overview.students.male} color={colors.leaf} />
                <StatCard label="Girls" value={overview.students.female} color={colors.coral} />
              </View>

              <View style={styles.statsRow}>
                <StatCard label="Present Today" value={overview.attendance_today.total_present} color={colors.leaf} />
                <StatCard label="Absent Today" value={overview.attendance_today.total_absent} color={colors.coral} />
              </View>

              <View style={styles.moneyCard}>
                <Text style={styles.moneyLabel}>Fees Collected Today</Text>
                <Text style={styles.moneyValue}>GHS {overview.fees_collected_today.toFixed(2)}</Text>
              </View>

              <View style={styles.moneyCard}>
                <Text style={styles.moneyLabel}>Salary Payout This Month</Text>
                <Text style={styles.moneyValue}>GHS {overview.salary_payout_this_month.toFixed(2)}</Text>
              </View>

              <Text style={styles.byClassTitle}>By Class</Text>
            </>
          }
          renderItem={({ item }) => (
            <View style={styles.classRow}>
              <Text style={styles.classRowName}>{item.class_name}</Text>
              <Text style={styles.classRowDetail}>
                {item.total_students} students · {item.male_count}B · {item.female_count}G
              </Text>
            </View>
          )}
        />
      )}

      <Modal visible={menuVisible} transparent animationType="fade" onRequestClose={() => setMenuVisible(false)}>
        <Pressable style={styles.menuOverlay} onPress={() => setMenuVisible(false)}>
          <View style={styles.menuCard}>
            <MenuItem label="Classes" onPress={() => menuAction(onViewClasses)} />
            <MenuItem label="Search Students" onPress={() => menuAction(onSearchStudents)} />
            <MenuItem label="Notifications" onPress={() => menuAction(onViewNotifications)} />
            <MenuItem label="Staff Accounts" onPress={() => menuAction(onViewStaff)} />
            <MenuItem label="Records" onPress={() => menuAction(onViewRecords)} />
            <MenuItem label="Statistics" onPress={() => menuAction(onViewStatistics)} />
            <MenuItem label="Profile" onPress={() => menuAction(onViewProfile)} isLast />
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function MenuItem({ label, onPress, isLast }: { label: string; onPress: () => void; isLast?: boolean }) {
  return (
    <Pressable style={[styles.menuItem, !isLast && styles.menuItemBorder]} onPress={onPress}>
      <Text style={styles.menuItemText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cloud },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.cloud },
  errorText: { fontFamily: fonts.bodySemiBold, color: colors.coral, textAlign: 'center', marginBottom: spacing.sm },
  header: { padding: spacing.lg, paddingBottom: spacing.md },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  headerTitle: { fontFamily: fonts.display, fontSize: fontSizes.xxl, color: colors.indigo },
  headerSubtitle: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.charcoalMuted, marginTop: 2 },
  menuButton: {
    width: 44, height: 44, borderRadius: radii.pill, backgroundColor: colors.white,
    borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center',
  },
  menuButtonText: { fontFamily: fonts.bodyBold, fontSize: fontSizes.xl, color: colors.indigo },
  menuOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', paddingTop: 90, paddingRight: spacing.lg, alignItems: 'flex-end' },
  menuCard: { backgroundColor: colors.white, borderRadius: radii.lg, width: 220, overflow: 'hidden', ...shadow.glass },
  menuItem: { paddingVertical: spacing.md, paddingHorizontal: spacing.md },
  menuItemBorder: { borderBottomWidth: 1, borderBottomColor: colors.line },
  menuItemText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.base, color: colors.charcoal },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  statsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  statCard: {
    flex: 1, backgroundColor: colors.white, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.line,
    padding: spacing.md, alignItems: 'center', ...shadow.card,
  },
  statValue: { fontFamily: fonts.display, fontSize: fontSizes.xl },
  statLabel: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.charcoalMuted, marginTop: 2 },
  moneyCard: {
    backgroundColor: colors.indigo, borderRadius: radii.lg, padding: spacing.md,
    alignItems: 'center', marginBottom: spacing.sm,
  },
  moneyLabel: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.white, opacity: 0.85 },
  moneyValue: { fontFamily: fonts.display, fontSize: fontSizes.xl, color: colors.white, marginTop: 2 },
  byClassTitle: { fontFamily: fonts.bodyBold, fontSize: fontSizes.base, color: colors.indigo, marginTop: spacing.sm, marginBottom: spacing.sm },
  classRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.white,
    borderRadius: radii.md, borderWidth: 1, borderColor: colors.line, padding: spacing.md, marginBottom: spacing.sm,
  },
  classRowName: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.base, color: colors.charcoal },
  classRowDetail: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.charcoalMuted },
});