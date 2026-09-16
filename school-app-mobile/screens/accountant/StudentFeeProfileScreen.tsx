// screens/accountant/StudentFeeProfileScreen.tsx
// One student's full fee picture: per-section status (start tracking, record payment,
// exempt/unexempt) plus payment history.

import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, TextInput, Pressable, StyleSheet, ActivityIndicator, Alert, Modal } from 'react-native';
import { colors, fonts, fontSizes, radii, spacing, shadow } from '../../theme/theme';
import { API_URL } from '../../config/api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type FeeStatus = {
  section_id: string;
  section_name: string;
  amount: number;
  frequency: 'once' | 'daily';
  started: boolean;
  exempted: boolean;
  balance: number;
  status: 'not_started' | 'paid' | 'unpaid' | 'exempt';
  owed: number;
};

type PaymentHistoryEntry = {
  amount: number;
  paid_date: string;
  section_name: string;
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function statusLabel(status: string) {
  if (status === 'paid') return 'Paid';
  if (status === 'unpaid') return 'Unpaid';
  if (status === 'exempt') return 'Exempt';
  return 'Not Started';
}

function statusColor(status: string) {
  if (status === 'paid') return colors.leaf;
  if (status === 'unpaid') return colors.coral;
  if (status === 'exempt') return colors.indigo;
  return colors.charcoalMuted;
}

export default function StudentFeeProfileScreen({
  token,
  studentId,
  onBack,
}: {
  token: string;
  studentId: string;
  onBack: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [studentName, setStudentName] = useState('');
  const [className, setClassName] = useState('');
  const [fees, setFees] = useState<FeeStatus[]>([]);
  const [history, setHistory] = useState<PaymentHistoryEntry[]>([]);
  const [error, setError] = useState('');
  const [busySectionId, setBusySectionId] = useState<string | null>(null);

  const [payModalVisible, setPayModalVisible] = useState(false);
  const [payingSection, setPayingSection] = useState<FeeStatus | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [paySubmitting, setPaySubmitting] = useState(false);
  const [payError, setPayError] = useState('');

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/accountant/students/${studentId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load fee profile');
      setStudentName(`${data.student.first_name} ${data.student.last_name}`);
      setClassName(data.student.class_name);
      setFees(data.fees);
      setHistory(data.payment_history);
    } catch (e: any) {
      setError(e.message || 'Could not reach the server.');
    } finally {
      setLoading(false);
    }
  }, [token, studentId]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const startTracking = async (sectionId: string) => {
    setBusySectionId(sectionId);
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/accountant/students/${studentId}/fees/${sectionId}/start`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to start fee tracking');
      await loadProfile();
    } catch (e: any) {
      setError(e.message || 'Could not start fee tracking.');
    } finally {
      setBusySectionId(null);
    }
  };

  const toggleExempt = async (section: FeeStatus) => {
    setBusySectionId(section.section_id);
    setError('');
    try {
      const method = section.exempted ? 'DELETE' : 'POST';
      const res = await fetch(`${API_URL}/api/accountant/students/${studentId}/fees/${section.section_id}/exempt`, {
        method,
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update exemption');
      await loadProfile();
    } catch (e: any) {
      setError(e.message || 'Could not update exemption.');
    } finally {
      setBusySectionId(null);
    }
  };

  const openPayModal = (section: FeeStatus) => {
    setPayingSection(section);
    setPayAmount(section.owed > 0 ? String(section.owed) : '');
    setPayError('');
    setPayModalVisible(true);
  };

  const submitPayment = async () => {
    if (!payingSection) return;
    const amount = parseFloat(payAmount);
    if (isNaN(amount) || amount <= 0) {
      setPayError('Enter a valid, positive amount.');
      return;
    }
    setPaySubmitting(true);
    setPayError('');
    try {
      const res = await fetch(`${API_URL}/api/accountant/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          student_id: studentId,
          fee_section_id: payingSection.section_id,
          amount,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to record payment');
      setPayModalVisible(false);
      await loadProfile();
    } catch (e: any) {
      setPayError(e.message || 'Could not reach the server.');
    } finally {
      setPaySubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Pressable onPress={onBack} style={[styles.backRow, { paddingTop: insets.top + spacing.sm }]}>
        <Text style={styles.backArrow}>‹</Text>
        <Text style={styles.backText}>Back</Text>
      </Pressable>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.indigo} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Text style={styles.name}>{studentName}</Text>
          <Text style={styles.classLabel}>{className}</Text>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Fee Sections</Text>
            {fees.map((f) => (
              <View key={f.section_id} style={styles.feeRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.feeName}>{f.section_name}</Text>
                  <Text style={styles.feeDetail}>
                    GHS {f.amount.toFixed(2)} · {f.frequency === 'daily' ? 'Daily' : 'One-time'}
                  </Text>
                  <Text style={[styles.feeStatus, { color: statusColor(f.status) }]}>
                    {statusLabel(f.status)}
                    {f.status === 'unpaid' ? ` — owes GHS ${f.owed.toFixed(2)}` : ''}
                  </Text>
                </View>

                {busySectionId === f.section_id ? (
                  <ActivityIndicator color={colors.indigo} />
                ) : (
                  <View style={styles.feeActions}>
                    {!f.started ? (
                      <Pressable style={styles.actionButtonPrimary} onPress={() => startTracking(f.section_id)}>
                        <Text style={styles.actionButtonPrimaryText}>Start</Text>
                      </Pressable>
                    ) : (
                      <>
                        {!f.exempted && f.status === 'unpaid' && (
                          <Pressable style={styles.actionButtonPrimary} onPress={() => openPayModal(f)}>
                            <Text style={styles.actionButtonPrimaryText}>Pay</Text>
                          </Pressable>
                        )}
                        <Pressable style={styles.actionButtonGhost} onPress={() => toggleExempt(f)}>
                          <Text style={styles.actionButtonGhostText}>{f.exempted ? 'Unexempt' : 'Exempt'}</Text>
                        </Pressable>
                      </>
                    )}
                  </View>
                )}
              </View>
            ))}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Payment History</Text>
            {history.length === 0 ? (
              <Text style={styles.emptyText}>No payments recorded yet.</Text>
            ) : (
              history.map((h, idx) => (
                <View key={idx} style={styles.historyRow}>
                  <Text style={styles.historySection}>{h.section_name}</Text>
                  <Text style={styles.historyDate}>{formatDate(h.paid_date)}</Text>
                  <Text style={styles.historyAmount}>GHS {Number(h.amount).toFixed(2)}</Text>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      )}

      <Modal visible={payModalVisible} transparent animationType="fade" onRequestClose={() => setPayModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Record Payment</Text>
            <Text style={styles.modalSubtitle}>{payingSection?.section_name}</Text>
            {payError ? <Text style={styles.errorText}>{payError}</Text> : null}
            <TextInput
              style={styles.modalInput}
              placeholder="Amount"
              placeholderTextColor={colors.charcoalMuted}
              value={payAmount}
              onChangeText={setPayAmount}
              keyboardType="decimal-pad"
            />
            <View style={styles.modalButtonRow}>
              <Pressable style={styles.modalCancelButton} onPress={() => setPayModalVisible(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.modalSaveButton} onPress={submitPayment} disabled={paySubmitting}>
                {paySubmitting ? <ActivityIndicator color={colors.white} /> : <Text style={styles.modalSaveText}>Record</Text>}
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
  emptyText: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.charcoalMuted },
  errorText: { fontFamily: fonts.bodySemiBold, color: colors.coral, textAlign: 'center', marginBottom: spacing.sm },
  backRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.sm },
  backArrow: { fontFamily: fonts.bodyBold, fontSize: fontSizes.xl, color: colors.indigo, marginRight: 4 },
  backText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.base, color: colors.indigo },
  scrollContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  name: { fontFamily: fonts.display, fontSize: fontSizes.xl, color: colors.charcoal },
  classLabel: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.charcoalMuted, marginBottom: spacing.md },
  section: {
    backgroundColor: colors.white, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.line,
    padding: spacing.md, marginBottom: spacing.md, ...shadow.card,
  },
  sectionTitle: { fontFamily: fonts.bodyBold, fontSize: fontSizes.base, color: colors.indigo, marginBottom: spacing.sm },
  feeRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.line,
  },
  feeName: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.base, color: colors.charcoal },
  feeDetail: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.charcoalMuted, marginTop: 2 },
  feeStatus: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, marginTop: 2 },
  feeActions: { flexDirection: 'row', gap: spacing.xs },
  actionButtonPrimary: { backgroundColor: colors.indigo, borderRadius: radii.pill, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  actionButtonPrimaryText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.xs, color: colors.white },
  actionButtonGhost: { borderWidth: 1, borderColor: colors.line, borderRadius: radii.pill, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  actionButtonGhostText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.xs, color: colors.charcoalMuted },
  historyRow: {
    flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.xs,
    borderBottomWidth: 1, borderBottomColor: colors.line,
  },
  historySection: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.charcoal, flex: 1 },
  historyDate: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.charcoalMuted, flex: 1, textAlign: 'center' },
  historyAmount: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.leaf, flex: 1, textAlign: 'right' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: spacing.lg },
  modalCard: { width: '100%', backgroundColor: colors.white, borderRadius: radii.lg, padding: spacing.lg },
  modalTitle: { fontFamily: fonts.display, fontSize: fontSizes.xl, color: colors.indigo },
  modalSubtitle: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.charcoalMuted, marginBottom: spacing.md },
  modalInput: {
    borderWidth: 1, borderColor: colors.line, borderRadius: radii.md, padding: spacing.md, marginBottom: spacing.sm,
    fontFamily: fonts.body, fontSize: fontSizes.base, color: colors.charcoal,
  },
  modalButtonRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  modalCancelButton: { flex: 1, borderRadius: radii.pill, paddingVertical: spacing.md, alignItems: 'center', backgroundColor: colors.cloud },
  modalCancelText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.base, color: colors.charcoalMuted },
  modalSaveButton: { flex: 1, borderRadius: radii.pill, paddingVertical: spacing.md, alignItems: 'center', backgroundColor: colors.indigo },
  modalSaveText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.base, color: colors.white },
});
