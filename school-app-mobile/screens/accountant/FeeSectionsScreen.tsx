// screens/accountant/FeeSectionsScreen.tsx
// Manage fee sections (e.g. Tuition, Feeding) — list, add new, edit amount/frequency.

import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, Pressable, TextInput, StyleSheet, ActivityIndicator, Alert, Modal } from 'react-native';
import { BlurView } from 'expo-blur';
import { colors, fonts, fontSizes, radii, spacing, shadow } from '../../theme/theme';
import { API_URL } from '../../config/api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type FeeSection = {
  id: string;
  name: string;
  amount: number;
  frequency: 'once' | 'daily';
};

export default function FeeSectionsScreen({ token, onBack }: { token: string; onBack: () => void }) {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [sections, setSections] = useState<FeeSection[]>([]);
  const [error, setError] = useState('');

  const [modalVisible, setModalVisible] = useState(false);
  const [editingSection, setEditingSection] = useState<FeeSection | null>(null);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [frequency, setFrequency] = useState<'once' | 'daily'>('once');
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState('');

  const loadSections = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/accountant/sections`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load fee sections');
      setSections(data.sections);
    } catch (e: any) {
      setError(e.message || 'Could not reach the server.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadSections();
  }, [loadSections]);

  const openAddModal = () => {
    setEditingSection(null);
    setName('');
    setAmount('');
    setFrequency('once');
    setModalError('');
    setModalVisible(true);
  };

  const openEditModal = (section: FeeSection) => {
    setEditingSection(section);
    setName(section.name);
    setAmount(String(section.amount));
    setFrequency(section.frequency);
    setModalError('');
    setModalVisible(true);
  };

  const submit = async () => {
    const parsedAmount = parseFloat(amount);
    if (!editingSection && !name.trim()) {
      setModalError('Section name is required.');
      return;
    }
    if (isNaN(parsedAmount) || parsedAmount < 0) {
      setModalError('Enter a valid, non-negative amount.');
      return;
    }
    setSaving(true);
    setModalError('');
    try {
      if (editingSection) {
        const res = await fetch(`${API_URL}/api/accountant/sections/${editingSection.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ amount: parsedAmount, frequency }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to update section');
      } else {
        const res = await fetch(`${API_URL}/api/accountant/sections`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ name: name.trim(), amount: parsedAmount, frequency }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to add section');
      }
      setModalVisible(false);
      await loadSections();
    } catch (e: any) {
      setModalError(e.message || 'Could not reach the server.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <Pressable onPress={onBack} style={[styles.backRow, { paddingTop: insets.top + spacing.sm }]}>
        <Text style={styles.backArrow}>‹</Text>
        <Text style={styles.backText}>Back</Text>
      </Pressable>

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Fee Sections</Text>
        <Pressable style={styles.addButton} onPress={openAddModal}>
          <Text style={styles.addButtonText}>+ Add Section</Text>
        </Pressable>
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.indigo} />
        </View>
      ) : sections.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>No fee sections yet.</Text>
        </View>
      ) : (
        <FlatList
          data={sections}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Pressable onPress={() => openEditModal(item)}>
              <View style={[shadow.card, styles.cardWrap]}>
                <View style={styles.card}>
                  <BlurView intensity={25} tint="light" style={StyleSheet.absoluteFill} />
                  <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.white }]} />

                  <View style={{ flex: 1 }}>
                    <Text style={styles.sectionName}>{item.name}</Text>
                     <Text style={styles.sectionDetail}>
                      GHS {Number(item.amount).toFixed(2)} · {item.frequency === 'daily' ? 'Daily' : 'One-time'}
                    </Text>
                  </View>
                  <Text style={styles.chevron}>›</Text>
                </View>
              </View>
            </Pressable>
          )}
        />
      )}

      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{editingSection ? 'Edit Fee Section' : 'Add Fee Section'}</Text>

            {modalError ? <Text style={styles.errorText}>{modalError}</Text> : null}

            {!editingSection && (
              <TextInput style={styles.modalInput} placeholder="Name (e.g. Tuition)" value={name} onChangeText={setName} />
            )}
            {editingSection && (
              <Text style={styles.lockedName}>{editingSection.name} (name can't be changed)</Text>
            )}
            <TextInput
              style={styles.modalInput}
              placeholder="Amount"
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
            />
            <View style={styles.chipRow}>
              <Pressable style={[styles.chip, frequency === 'once' && styles.chipActive]} onPress={() => setFrequency('once')}>
                <Text style={[styles.chipText, frequency === 'once' && styles.chipTextActive]}>One-time</Text>
              </Pressable>
              <Pressable style={[styles.chip, frequency === 'daily' && styles.chipActive]} onPress={() => setFrequency('daily')}>
                <Text style={[styles.chipText, frequency === 'daily' && styles.chipTextActive]}>Daily</Text>
              </Pressable>
            </View>

            <View style={styles.modalButtonRow}>
              <Pressable style={styles.modalCancelButton} onPress={() => setModalVisible(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.modalSaveButton} onPress={submit} disabled={saving}>
                {saving ? <ActivityIndicator color={colors.white} /> : <Text style={styles.modalSaveText}>Save</Text>}
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
  backRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.sm },
  backArrow: { fontFamily: fonts.bodyBold, fontSize: fontSizes.xl, color: colors.indigo, marginRight: 4 },
  backText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.base, color: colors.indigo },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  headerTitle: { fontFamily: fonts.display, fontSize: fontSizes.xxl, color: colors.indigo },
  addButton: { backgroundColor: colors.indigo, borderRadius: radii.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  addButtonText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.white },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  cardWrap: { marginBottom: spacing.sm, borderRadius: radii.lg, overflow: 'hidden' },
  card: { flexDirection: 'row', alignItems: 'center', borderRadius: radii.lg, padding: spacing.md, overflow: 'hidden', borderWidth: 1, borderColor: colors.line },
  sectionName: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.base, color: colors.charcoal },
  sectionDetail: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.charcoalMuted, marginTop: 2 },
  chevron: { fontFamily: fonts.bodyBold, fontSize: fontSizes.xl, color: colors.charcoalMuted },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: spacing.lg },
  modalCard: { width: '100%', backgroundColor: colors.white, borderRadius: radii.lg, padding: spacing.lg },
  modalTitle: { fontFamily: fonts.display, fontSize: fontSizes.xl, color: colors.indigo, marginBottom: spacing.md },
  modalInput: {
    borderWidth: 1, borderColor: colors.line, borderRadius: radii.md, padding: spacing.md, marginBottom: spacing.sm,
    fontFamily: fonts.body, fontSize: fontSizes.base, color: colors.charcoal,
  },
  lockedName: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.base, color: colors.charcoalMuted, marginBottom: spacing.sm },
  chipRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  chip: { flex: 1, borderWidth: 1, borderColor: colors.line, borderRadius: radii.pill, paddingVertical: spacing.sm, alignItems: 'center' },
  chipActive: { backgroundColor: colors.indigo, borderColor: colors.indigo },
  chipText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.charcoal },
  chipTextActive: { color: colors.white },
  modalButtonRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  modalCancelButton: { flex: 1, borderRadius: radii.pill, paddingVertical: spacing.md, alignItems: 'center', backgroundColor: colors.cloud },
  modalCancelText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.base, color: colors.charcoalMuted },
  modalSaveButton: { flex: 1, borderRadius: radii.pill, paddingVertical: spacing.md, alignItems: 'center', backgroundColor: colors.indigo },
  modalSaveText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.base, color: colors.white },
});