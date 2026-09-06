// screens/SalariesScreen.tsx
// Staff salary sheet for a selected month — editable amounts, running total.
// Tap a staff card's name/details to edit them; long-press to remove. "+ Add Staff" adds a new one.

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { colors, fonts, fontSizes, radii, spacing, shadow } from '../theme/theme';
import { API_URL } from '../config/api';

type StaffSalary = {
  staff_id: string;
  name: string;
  position: string | null;
  account_number: string | null;
  salary_id: string | null;
  amount: number | null;
};

function currentMonthStr() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function shiftMonth(monthStr: string, delta: number) {
  const [y, m] = monthStr.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function formatMonthLabel(monthStr: string) {
  const [y, m] = monthStr.split('-').map(Number);
  const d = new Date(y, m - 1, 1);
  return d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

export default function SalariesScreen({
  token,
  onBack,
  onViewRemovedStaff,
}: {
  token: string;
  onBack: () => void;
  onViewRemovedStaff: () => void;
}) {
  const [month, setMonth] = useState(currentMonthStr());
  const [loading, setLoading] = useState(true);
  const [staff, setStaff] = useState<StaffSalary[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const [addModalVisible, setAddModalVisible] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPosition, setNewPosition] = useState('');
  const [newAccountNumber, setNewAccountNumber] = useState('');
  const [addingStaff, setAddingStaff] = useState(false);

  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingStaffId, setEditingStaffId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editPosition, setEditPosition] = useState('');
  const [editAccountNumber, setEditAccountNumber] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const loadSalaries = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/secretary/salaries?month=${month}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load salaries');
      setStaff(data.staff);
      setTotal(data.total);
      const initialDrafts: Record<string, string> = {};
      data.staff.forEach((s: StaffSalary) => {
        initialDrafts[s.staff_id] = s.amount !== null ? String(s.amount) : '';
      });
      setDrafts(initialDrafts);
    } catch (e: any) {
      setError(e.message || 'Could not reach the server.');
    } finally {
      setLoading(false);
    }
  }, [token, month]);

  useEffect(() => {
    loadSalaries();
  }, [loadSalaries]);

  const saveSalary = async (staffId: string) => {
    const raw = drafts[staffId];
    const amount = parseFloat(raw);
    if (raw.trim() === '' || isNaN(amount) || amount < 0) {
      Alert.alert('Invalid amount', 'Enter a valid, non-negative number.');
      return;
    }
    setSavingId(staffId);
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/secretary/salaries`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ staff_id: staffId, month, amount }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save salary');
      await loadSalaries();
    } catch (e: any) {
      setError(e.message || 'Could not save salary.');
    } finally {
      setSavingId(null);
    }
  };

  const confirmRemoveStaff = (s: StaffSalary) => {
    Alert.alert('Remove Staff Member', `Remove ${s.name} from the staff list?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => removeStaff(s.staff_id) },
    ]);
  };

  const removeStaff = async (staffId: string) => {
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/secretary/staff/${staffId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to remove staff member');
      await loadSalaries();
    } catch (e: any) {
      setError(e.message || 'Could not remove staff member.');
    }
  };

  const submitAddStaff = async () => {
    if (!newName.trim()) {
      Alert.alert('Missing name', 'Staff name is required.');
      return;
    }
    setAddingStaff(true);
    try {
      const res = await fetch(`${API_URL}/api/secretary/staff`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: newName.trim(),
          position: newPosition.trim() || undefined,
          account_number: newAccountNumber.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add staff member');
      setAddModalVisible(false);
      setNewName('');
      setNewPosition('');
      setNewAccountNumber('');
      await loadSalaries();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not reach the server.');
    } finally {
      setAddingStaff(false);
    }
  };

  const openEditModal = (s: StaffSalary) => {
    setEditingStaffId(s.staff_id);
    setEditName(s.name);
    setEditPosition(s.position || '');
    setEditAccountNumber(s.account_number || '');
    setEditModalVisible(true);
  };

  const submitEditStaff = async () => {
    if (!editName.trim() || !editingStaffId) {
      Alert.alert('Missing name', 'Staff name is required.');
      return;
    }
    setSavingEdit(true);
    try {
      const res = await fetch(`${API_URL}/api/secretary/staff/${editingStaffId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: editName.trim(),
          position: editPosition.trim() || undefined,
          account_number: editAccountNumber.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update staff member');
      setEditModalVisible(false);
      await loadSalaries();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not reach the server.');
    } finally {
      setSavingEdit(false);
    }
  };

  return (
    <View style={styles.container}>
      <Pressable onPress={onBack} style={styles.backRow}>
        <Text style={styles.backArrow}>‹</Text>
        <Text style={styles.backText}>Back</Text>
      </Pressable>

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Salaries</Text>

        <View style={styles.monthRow}>
          <Pressable style={styles.monthArrow} onPress={() => setMonth((m) => shiftMonth(m, -1))}>
            <Text style={styles.monthArrowText}>‹</Text>
          </Pressable>
          <Text style={styles.monthLabel}>{formatMonthLabel(month)}</Text>
          <Pressable style={styles.monthArrow} onPress={() => setMonth((m) => shiftMonth(m, 1))}>
            <Text style={styles.monthArrowText}>›</Text>
          </Pressable>
        </View>

        <View style={styles.totalCard}>
          <Text style={styles.totalLabel}>Total for {formatMonthLabel(month)}</Text>
          <Text style={styles.totalValue}>GHS {total.toFixed(2)}</Text>
        </View>

        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Pressable style={[styles.addStaffButton, { flex: 1 }]} onPress={() => setAddModalVisible(true)}>
            <Text style={styles.addStaffButtonText}>+ Add Staff</Text>
          </Pressable>
          <Pressable style={[styles.addStaffButton, { flex: 1 }]} onPress={onViewRemovedStaff}>
            <Text style={styles.addStaffButtonText}>Removed Staff</Text>
          </Pressable>
        </View>
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.indigo} />
        </View>
      ) : staff.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>No staff members yet.</Text>
        </View>
      ) : (
        <FlatList
          data={staff}
          keyExtractor={(item) => item.staff_id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <StaffCard
              staffMember={item}
              draftValue={drafts[item.staff_id] ?? ''}
              saving={savingId === item.staff_id}
              onChangeDraft={(v) => setDrafts((prev) => ({ ...prev, [item.staff_id]: v }))}
              onSave={() => saveSalary(item.staff_id)}
              onLongPress={() => confirmRemoveStaff(item)}
              onEdit={() => openEditModal(item)}
            />
          )}
        />
      )}

      <Modal visible={addModalVisible} transparent animationType="fade" onRequestClose={() => setAddModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Add Staff Member</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Name"
              value={newName}
              onChangeText={setNewName}
            />
            <TextInput
              style={styles.modalInput}
              placeholder="Position (optional)"
              value={newPosition}
              onChangeText={setNewPosition}
            />
            <TextInput
              style={styles.modalInput}
              placeholder="Account Number (optional)"
              value={newAccountNumber}
              onChangeText={setNewAccountNumber}
            />
            <View style={styles.modalButtonRow}>
              <Pressable style={styles.modalCancelButton} onPress={() => setAddModalVisible(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.modalSaveButton} onPress={submitAddStaff} disabled={addingStaff}>
                {addingStaff ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={styles.modalSaveText}>Add</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={editModalVisible} transparent animationType="fade" onRequestClose={() => setEditModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Edit Staff Member</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Name"
              value={editName}
              onChangeText={setEditName}
            />
            <TextInput
              style={styles.modalInput}
              placeholder="Position (optional)"
              value={editPosition}
              onChangeText={setEditPosition}
            />
            <TextInput
              style={styles.modalInput}
              placeholder="Account Number (optional)"
              value={editAccountNumber}
              onChangeText={setEditAccountNumber}
            />
            <View style={styles.modalButtonRow}>
              <Pressable style={styles.modalCancelButton} onPress={() => setEditModalVisible(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.modalSaveButton} onPress={submitEditStaff} disabled={savingEdit}>
                {savingEdit ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={styles.modalSaveText}>Save</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function StaffCard({
  staffMember,
  draftValue,
  saving,
  onChangeDraft,
  onSave,
  onLongPress,
  onEdit,
}: {
  staffMember: StaffSalary;
  draftValue: string;
  saving: boolean;
  onChangeDraft: (v: string) => void;
  onSave: () => void;
  onLongPress: () => void;
  onEdit: () => void;
}) {
  const isDirty = draftValue !== (staffMember.amount !== null ? String(staffMember.amount) : '');

  return (
    <Pressable onLongPress={onLongPress}>
      <View style={[shadow.card, styles.cardWrap]}>
        <View style={styles.card}>
          <BlurView intensity={25} tint="light" style={StyleSheet.absoluteFill} />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.white }]} />

          <Pressable style={{ flex: 1 }} onPress={onEdit}>
            <Text style={styles.staffName}>{staffMember.name}</Text>
            <Text style={styles.staffPosition}>{staffMember.position || 'No position set'}</Text>
            <Text style={styles.staffAccount}>
              {staffMember.account_number ? `Acct: ${staffMember.account_number}` : 'No account number'}
            </Text>
          </Pressable>

          <TextInput
            style={styles.amountInput}
            value={draftValue}
            onChangeText={onChangeDraft}
            keyboardType="decimal-pad"
            placeholder="0.00"
          />

          {saving ? (
            <ActivityIndicator color={colors.indigo} style={{ marginLeft: spacing.sm }} />
          ) : isDirty ? (
            <Pressable style={styles.saveButton} onPress={onSave}>
              <Text style={styles.saveButtonText}>Save</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </Pressable>
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
  headerTitle: { fontFamily: fonts.display, fontSize: fontSizes.xxl, color: colors.indigo, marginBottom: spacing.sm },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
  monthArrow: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  monthArrowText: { fontFamily: fonts.bodyBold, fontSize: fontSizes.xl, color: colors.indigo },
  monthLabel: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.lg, color: colors.charcoal, minWidth: 160, textAlign: 'center' },
  totalCard: {
    backgroundColor: colors.indigo,
    borderRadius: radii.lg,
    padding: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  totalLabel: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.white, opacity: 0.85 },
  totalValue: { fontFamily: fonts.display, fontSize: fontSizes.xxl, color: colors.white, marginTop: 2 },
  addStaffButton: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.indigo,
    borderRadius: radii.pill,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  addStaffButtonText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.indigo },
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
  staffPosition: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.charcoalMuted, marginTop: 2 },
  staffAccount: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.charcoalMuted, marginTop: 2 },
  amountInput: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    width: 90,
    textAlign: 'right',
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSizes.base,
    color: colors.charcoal,
  },
  saveButton: {
    backgroundColor: colors.leaf,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    marginLeft: spacing.sm,
  },
  saveButtonText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.xs, color: colors.white },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalCard: { width: '100%', backgroundColor: colors.white, borderRadius: radii.lg, padding: spacing.lg },
  modalTitle: { fontFamily: fonts.display, fontSize: fontSizes.xl, color: colors.indigo, marginBottom: spacing.md },
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