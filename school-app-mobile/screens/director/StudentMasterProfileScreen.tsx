// screens/director/StudentMasterProfileScreen.tsx
// Full read-only master view of one student: admission details, attendance rate,
// per-subject assessment with class rank, and complete fee status + payment history.

import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { colors, fonts, fontSizes, radii, spacing, shadow } from '../../theme/theme';
import { API_URL } from '../../config/api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type MasterProfile = {
  student: {
    first_name: string;
    last_name: string;
    gender: 'M' | 'F';
    class_name: string;
    admission_number: string | null;
    status: string;
  };
  attendance: {
    total_present: number;
    total_absent: number;
    total_days_recorded: number;
    attendance_rate_percent: number | null;
  };
  assessment: {
    subjects: {
      subject_id: string;
      subject_name: string;
      total: number | null;
      position: number | null;
    }[];
    overall: { total: number | null; position: number | null };
  };
  fees: {
    sections: {
      section_id: string;
      section_name: string;
      amount: number;
      frequency: string;
      status: string;
      owed: number;
    }[];
    payment_history: { amount: number; paid_date: string; section_name: string }[];
  };
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function feeStatusColor(status: string) {
  if (status === 'paid' || status === 'exempt') return colors.leaf;
  if (status === 'unpaid') return colors.coral;
  return colors.charcoalMuted;
}

export default function StudentMasterProfileScreen({
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
  const [profile, setProfile] = useState<MasterProfile | null>(null);
  const [error, setError] = useState('');

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/director/all-students/${studentId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load student profile');
      setProfile(data);
    } catch (e: any) {
      setError(e.message || 'Could not reach the server.');
    } finally {
      setLoading(false);
    }
  }, [token, studentId]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

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
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : profile ? (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {profile.student.first_name[0]}
              {profile.student.last_name[0]}
            </Text>
          </View>
          <Text style={styles.name}>
            {profile.student.first_name} {profile.student.last_name}
          </Text>
          <Text style={styles.classLabel}>
            {profile.student.class_name} · {profile.student.admission_number || 'No admission number'}
          </Text>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Attendance</Text>
            <View style={styles.statsRow}>
              <MiniStat label="Present" value={String(profile.attendance.total_present)} color={colors.leaf} />
              <MiniStat label="Absent" value={String(profile.attendance.total_absent)} color={colors.coral} />
              <MiniStat
                label="Rate"
                value={profile.attendance.attendance_rate_percent !== null ? `${profile.attendance.attendance_rate_percent}%` : '—'}
                color={colors.indigo}
              />
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Assessment {profile.assessment.overall.total !== null && `— Overall: ${profile.assessment.overall.total} (Rank #${profile.assessment.overall.position})`}
            </Text>
            {profile.assessment.subjects.length === 0 ? (
              <Text style={styles.emptyText}>No subjects recorded.</Text>
            ) : (
              profile.assessment.subjects.map((s) => (
                <View key={s.subject_id} style={styles.subjectRow}>
                  <Text style={styles.subjectName}>{s.subject_name}</Text>
                  <Text style={styles.subjectScore}>
                    {s.total !== null ? `${s.total} (Rank #${s.position})` : 'No scores yet'}
                  </Text>
                </View>
              ))
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Fees</Text>
            {profile.fees.sections.map((f) => (
              <View key={f.section_id} style={styles.feeRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.feeName}>{f.section_name}</Text>
                  <Text style={styles.feeDetail}>GHS {f.amount.toFixed(2)} · {f.frequency === 'daily' ? 'Daily' : 'One-time'}</Text>
                </View>
                <Text style={[styles.feeStatus, { color: feeStatusColor(f.status) }]}>
                  {f.status === 'unpaid' ? `Owes GHS ${f.owed.toFixed(2)}` : f.status}
                </Text>
              </View>
            ))}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Payment History</Text>
            {profile.fees.payment_history.length === 0 ? (
              <Text style={styles.emptyText}>No payments recorded yet.</Text>
            ) : (
              profile.fees.payment_history.map((h, idx) => (
                <View key={idx} style={styles.historyRow}>
                  <Text style={styles.historySection}>{h.section_name}</Text>
                  <Text style={styles.historyDate}>{formatDate(h.paid_date)}</Text>
                  <Text style={styles.historyAmount}>GHS {Number(h.amount).toFixed(2)}</Text>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      ) : null}
    </View>
  );
}

function MiniStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={styles.miniStat}>
      <Text style={[styles.miniStatValue, { color }]}>{value}</Text>
      <Text style={styles.miniStatLabel}>{label}</Text>
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
  scrollContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, alignItems: 'center' },
  avatar: { width: 72, height: 72, borderRadius: radii.pill, backgroundColor: colors.indigo, alignItems: 'center', justifyContent: 'center', marginTop: spacing.sm },
  avatarText: { fontFamily: fonts.bodyBold, color: colors.white, fontSize: fontSizes.xl },
  name: { fontFamily: fonts.display, fontSize: fontSizes.xl, color: colors.charcoal, marginTop: spacing.sm },
  classLabel: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.charcoalMuted, marginBottom: spacing.md },
  section: {
    width: '100%', backgroundColor: colors.white, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.line,
    padding: spacing.md, marginBottom: spacing.md, ...shadow.card,
  },
  sectionTitle: { fontFamily: fonts.bodyBold, fontSize: fontSizes.base, color: colors.indigo, marginBottom: spacing.sm },
  statsRow: { flexDirection: 'row', gap: spacing.sm },
  miniStat: { flex: 1, alignItems: 'center' },
  miniStatValue: { fontFamily: fonts.display, fontSize: fontSizes.lg },
  miniStatLabel: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.charcoalMuted, marginTop: 2 },
  subjectRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.xs, borderBottomWidth: 1, borderBottomColor: colors.line },
  subjectName: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.charcoal },
  subjectScore: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.charcoalMuted },
  feeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.xs, borderBottomWidth: 1, borderBottomColor: colors.line },
  feeName: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.charcoal },
  feeDetail: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.charcoalMuted, marginTop: 2 },
  feeStatus: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm },
  historyRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.xs, borderBottomWidth: 1, borderBottomColor: colors.line },
  historySection: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.charcoal, flex: 1 },
  historyDate: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.charcoalMuted, flex: 1, textAlign: 'center' },
  historyAmount: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.leaf, flex: 1, textAlign: 'right' },
});