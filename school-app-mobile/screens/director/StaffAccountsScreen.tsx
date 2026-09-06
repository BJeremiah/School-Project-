// screens/director/StaffAccountsScreen.tsx
// Every staff account (excluding directors) with role and block status. Block/unblock login access.

import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { BlurView } from 'expo-blur';
import { colors, fonts, fontSizes, radii, spacing, shadow } from '../../theme/theme';
import { API_URL } from '../../config/api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type StaffAccount = {
  id: string;
  name: string;
  email: string;
  role: string;
  is_blocked: boolean;
  created_at: string;
};

const ROLE_LABELS: Record<string, string> = {
  teacher: 'Teacher',
  secretary: 'Secretary',
  accountant: 'Accountant',
};

export default function StaffAccountsScreen({ token, onBack }: { token: string; onBack: () => void }) {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [staff, setStaff] = useState<StaffAccount[]>([]);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadStaff = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/director/staff`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load staff accounts');
      setStaff(data.staff);
    } catch (e: any) {
      setError(e.message || 'Could not reach the server.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadStaff();
  }, [loadStaff]);

  const confirmToggleBlock = (account: StaffAccount) => {
    const action = account.is_blocked ? 'Unblock' : 'Block';
    Alert.alert(
      `${action} Account`,
      `${action} ${account.name}'s login access?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: action, style: account.is_blocked ? 'default' : 'destructive', onPress: () => toggleBlock(account) },
      ]
    );
  };

  const toggleBlock = async (account: StaffAccount) => {
    setBusyId(account.id);
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/director/staff/${account.id}/${account.is_blocked ? 'unblock' : 'block'}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update account');
      await loadStaff();
    } catch (e: any) {
      setError(e.message || 'Could not update account.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <View style={styles.container}>
      <Pressable onPress={onBack} style={[styles.backRow, { paddingTop: insets.top + spacing.sm }]}>
        <Text style={styles.backArrow}>‹</Text>
        <Text style={styles.backText}>Overview</Text>
      </Pressable>

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Staff Accounts</Text>
        <Text style={styles.headerSubtitle}>{staff.length} accounts</Text>
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.indigo} />
        </View>
      ) : staff.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>No staff accounts found.</Text>
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
                  <Text style={styles.staffDetail}>{item.email}</Text>
                  <Text style={styles.staffRole}>{ROLE_LABELS[item.role] || item.role}</Text>
                </View>

                {busyId === item.id ? (
                  <ActivityIndicator color={colors.indigo} />
                ) : (
                  <Pressable
                    style={[styles.toggleButton, item.is_blocked ? styles.unblockButton : styles.blockButton]}
                    onPress={() => confirmToggleBlock(item)}
                  >
                    <Text style={[styles.toggleButtonText, item.is_blocked ? styles.unblockButtonText : styles.blockButtonText]}>
                      {item.is_blocked ? 'Unblock' : 'Block'}
                    </Text>
                  </Pressable>
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
  errorText: { fontFamily: fonts.bodySemiBold, color: colors.coral, textAlign: 'center', marginBottom: spacing.sm },
  backRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  backArrow: { fontFamily: fonts.bodyBold, fontSize: fontSizes.xl, color: colors.indigo, marginRight: 4 },
  backText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.base, color: colors.indigo },
  header: { padding: spacing.lg, paddingBottom: spacing.md },
  headerTitle: { fontFamily: fonts.display, fontSize: fontSizes.xxl, color: colors.indigo },
  headerSubtitle: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.charcoalMuted, marginTop: 2 },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  cardWrap: { marginBottom: spacing.sm, borderRadius: radii.lg, overflow: 'hidden' },
  card: { flexDirection: 'row', alignItems: 'center', borderRadius: radii.lg, padding: spacing.md, overflow: 'hidden', borderWidth: 1, borderColor: colors.line },
  staffName: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.base, color: colors.charcoal },
  staffDetail: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.charcoalMuted, marginTop: 2 },
  staffRole: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.xs, color: colors.indigo, marginTop: 2 },
  toggleButton: { borderRadius: radii.pill, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  blockButton: { backgroundColor: colors.coral },
  blockButtonText: { color: colors.white },
  unblockButton: { borderWidth: 1, borderColor: colors.leaf },
  unblockButtonText: { color: colors.leaf },
  toggleButtonText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.xs },
});