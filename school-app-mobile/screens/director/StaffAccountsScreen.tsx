// screens/director/StaffAccountsScreen.tsx
// Every staff account (excluding directors) with role and block status. Block/unblock login access.

import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, ActivityIndicator, Alert, Modal, TextInput } from 'react-native';
import { BlurView } from 'expo-blur';
import { colors, fonts, fontSizes, radii, spacing, shadow } from '../../theme/theme';
import { API_URL } from '../../config/api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import PasswordInput from '../../components/PasswordInput';

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
  const [resetTarget, setResetTarget] = useState<StaffAccount | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [resetError, setResetError] = useState('');
  const [resetSubmitting, setResetSubmitting] = useState(false);

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

  const openResetModal = (account: StaffAccount) => {
    setResetTarget(account);
    setNewPassword('');
    setConfirmNewPassword('');
    setResetError('');
  };

  const submitResetPassword = async () => {
    if (!resetTarget) return;
    if (!newPassword || !confirmNewPassword) {
      setResetError('Please enter and confirm a new temporary password.');
      return;
    }
    if (newPassword.length < 6) {
      setResetError('Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setResetError('Passwords do not match.');
      return;
    }

    setResetSubmitting(true);
    setResetError('');
    try {
      const res = await fetch(`${API_URL}/api/director/staff/${resetTarget.id}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ password: newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reset password');

      const targetName = resetTarget.name;
      setResetTarget(null);
      setNewPassword('');
      setConfirmNewPassword('');
      Alert.alert(
        'Password Reset',
        `${targetName}'s password has been reset. Share the new temporary password with them — they'll be asked to set their own at next login.`
      );
    } catch (e: any) {
      setResetError(e.message || 'Could not reset password.');
    } finally {
      setResetSubmitting(false);
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

                <View style={styles.actionsCol}>
                  {busyId === item.id ? (
                    <ActivityIndicator color={colors.indigo} />
                  ) : (
                    <>
                      <Pressable
                        style={[styles.toggleButton, item.is_blocked ? styles.unblockButton : styles.blockButton]}
                        onPress={() => confirmToggleBlock(item)}
                      >
                        <Text style={[styles.toggleButtonText, item.is_blocked ? styles.unblockButtonText : styles.blockButtonText]}>
                          {item.is_blocked ? 'Unblock' : 'Block'}
                        </Text>
                      </Pressable>
                      <Pressable style={styles.resetButton} onPress={() => openResetModal(item)}>
                        <Text style={styles.resetButtonText}>Reset Password</Text>
                      </Pressable>
                    </>
                  )}
                </View>
              </View>
            </View>
          )}
        />
      )}

      <Modal
        visible={resetTarget !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setResetTarget(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Reset Password</Text>
            <Text style={styles.modalSubtitle}>
              Set a new temporary password for {resetTarget?.name}. They'll be asked to set their own at next login.
            </Text>

            {resetError ? <Text style={styles.errorText}>{resetError}</Text> : null}

            <PasswordInput
              style={styles.modalInput}
              placeholder="New temporary password"
              placeholderTextColor={colors.charcoalMuted}
              value={newPassword}
              onChangeText={setNewPassword}
            />
            <PasswordInput
              style={styles.modalInput}
              placeholder="Confirm temporary password"
              placeholderTextColor={colors.charcoalMuted}
              value={confirmNewPassword}
              onChangeText={setConfirmNewPassword}
            />

            <View style={styles.modalButtonRow}>
              <Pressable style={styles.modalCancelButton} onPress={() => setResetTarget(null)} disabled={resetSubmitting}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.modalSaveButton} onPress={submitResetPassword} disabled={resetSubmitting}>
                {resetSubmitting ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={styles.modalSaveText}>Reset</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
  actionsCol: { alignItems: 'flex-end', gap: spacing.xs },
  toggleButton: { borderRadius: radii.pill, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  blockButton: { backgroundColor: colors.coral },
  blockButtonText: { color: colors.white },
  unblockButton: { borderWidth: 1, borderColor: colors.leaf },
  unblockButtonText: { color: colors.leaf },
  toggleButtonText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.xs },
  resetButton: {
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderWidth: 1,
    borderColor: colors.indigo,
  },
  resetButtonText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.xs, color: colors.indigo },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: spacing.lg },
  modalCard: { width: '100%', backgroundColor: colors.white, borderRadius: radii.lg, padding: spacing.lg },
  modalTitle: { fontFamily: fonts.display, fontSize: fontSizes.xl, color: colors.indigo, marginBottom: spacing.xs },
  modalSubtitle: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.charcoalMuted, marginBottom: spacing.md },
  modalInput: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    fontFamily: fonts.body,
    fontSize: fontSizes.base,
    color: colors.charcoal,
  },
  modalButtonRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  modalCancelButton: {
    flex: 1,
    borderRadius: radii.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
    backgroundColor: colors.cloud,
  },
  modalCancelText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.base, color: colors.charcoalMuted },
  modalSaveButton: {
    flex: 1,
    borderRadius: radii.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
    backgroundColor: colors.indigo,
  },
  modalSaveText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.base, color: colors.white },
});