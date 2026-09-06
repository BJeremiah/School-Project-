// screens/RemovedStaffScreen.tsx
// Lists soft-deleted (inactive) staff. Reactivate brings them back; Delete Permanently removes them for good.

import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { BlurView } from 'expo-blur';
import { colors, fonts, fontSizes, radii, spacing, shadow } from '../../theme/theme';
import { API_URL } from '../../config/api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type InactiveStaff = {
  id: string;
  name: string;
  position: string | null;
  account_number: string | null;
};

export default function RemovedStaffScreen({ token, onBack }: { token: string; onBack: () => void }) {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [staff, setStaff] = useState<InactiveStaff[]>([]);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadInactiveStaff = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/secretary/staff/inactive`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load removed staff');
      setStaff(data.staff);
    } catch (e: any) {
      setError(e.message || 'Could not reach the server.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadInactiveStaff();
  }, [loadInactiveStaff]);

  const reactivate = async (id: string) => {
    setBusyId(id);
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/secretary/staff/${id}/reactivate`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reactivate');
      await loadInactiveStaff();
    } catch (e: any) {
      setError(e.message || 'Could not reactivate staff member.');
    } finally {
      setBusyId(null);
    }
  };

  const confirmPermanentDelete = (member: InactiveStaff) => {
    Alert.alert(
      'Delete Permanently',
      `This will permanently delete ${member.name} and ALL their salary history. This cannot be undone. Are you absolutely sure?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete Forever', style: 'destructive', onPress: () => permanentDelete(member.id) },
      ]
    );
  };

  const permanentDelete = async (id: string) => {
    setBusyId(id);
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/secretary/staff/${id}/permanent`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete');
      await loadInactiveStaff();
    } catch (e: any) {
      setError(e.message || 'Could not delete staff member.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <View style={styles.container}>
      <Pressable onPress={onBack} style={[styles.backRow, { paddingTop: insets.top + spacing.sm }]}>
        <Text style={styles.backArrow}>‹</Text>
        <Text style={styles.backText}>Back</Text>
      </Pressable>

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Removed Staff</Text>
        <Text style={styles.headerSubtitle}>{staff.length} removed</Text>
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.indigo} />
        </View>
      ) : staff.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>No removed staff members.</Text>
        </View>
      ) : (
        <FlatList
          data={staff}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={[shadow.card, styles.cardWrap]}>
              <View style={styles.card}>
                <BlurView intensity={25} tint="light" style={StyleSheet.absoluteFill} />
                <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.white }]} />

                <View style={{ flex: 1 }}>
                  <Text style={styles.staffName}>{item.name}</Text>
                  <Text style={styles.staffSubtext}>{item.position || 'No position set'}</Text>
                </View>

                {busyId === item.id ? (
                  <ActivityIndicator color={colors.indigo} />
                ) : (
                  <View style={{ flexDirection: 'row', gap: spacing.xs }}>
                    <Pressable style={styles.reactivateButton} onPress={() => reactivate(item.id)}>
                      <Text style={styles.reactivateButtonText}>Reactivate</Text>
                    </Pressable>
                    <Pressable style={styles.deleteButton} onPress={() => confirmPermanentDelete(item)}>
                      <Text style={styles.deleteButtonText}>Delete</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cloud },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.base, color: colors.charcoalMuted },
  errorText: {
    fontFamily: fonts.bodySemiBold,
    color: colors.coral,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  backArrow: { fontFamily: fonts.bodyBold, fontSize: fontSizes.xl, color: colors.indigo, marginRight: 4 },
  backText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.base, color: colors.indigo },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  headerTitle: { fontFamily: fonts.display, fontSize: fontSizes.xxl, color: colors.indigo },
  headerSubtitle: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.charcoalMuted, marginTop: 2 },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  cardWrap: { marginBottom: spacing.sm, borderRadius: radii.lg, overflow: 'hidden' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radii.lg,
    padding: spacing.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.line,
  },
  staffName: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.base, color: colors.charcoal },
  staffSubtext: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.charcoalMuted, marginTop: 2 },
  reactivateButton: {
    backgroundColor: colors.leaf,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  reactivateButtonText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.xs, color: colors.white },
  deleteButton: {
    backgroundColor: colors.coral,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  deleteButtonText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.xs, color: colors.white },
});