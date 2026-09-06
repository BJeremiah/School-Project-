// screens/accountant/ClassFeeStatusScreen.tsx
// Students in one class with fee status per section. Toggle "Absent today" (for daily fee
// calculation purposes). Tap a student to open their full fee profile.

import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { BlurView } from 'expo-blur';
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
  status: 'not_started' | 'paid' | 'unpaid' | 'exempt';
  owed: number;
};

type StudentFeeRow = {
  student_id: string;
  first_name: string;
  last_name: string;
  absent_today: boolean;
  fees: FeeStatus[];
};

function statusColor(status: string) {
  if (status === 'paid' || status === 'exempt') return colors.leaf;
  if (status === 'unpaid') return colors.coral;
  return colors.charcoalMuted;
}

export default function ClassFeeStatusScreen({
  token,
  classId,
  className,
  onBack,
  onSelectStudent,
}: {
  token: string;
  classId: string;
  className: string;
  onBack: () => void;
  onSelectStudent: (studentId: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<StudentFeeRow[]>([]);
  const [error, setError] = useState('');
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/accountant/classes/${classId}/students`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load fee status');
      setStudents(data.students);
    } catch (e: any) {
      setError(e.message || 'Could not reach the server.');
    } finally {
      setLoading(false);
    }
  }, [token, classId]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const toggleAbsent = async (studentId: string, currentlyAbsent: boolean) => {
    setTogglingId(studentId);
    try {
      if (currentlyAbsent) {
        const res = await fetch(`${API_URL}/api/accountant/students/${studentId}/absent`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Failed to unmark absent');
        }
      } else {
        const res = await fetch(`${API_URL}/api/accountant/students/${studentId}/absent`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({}),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Failed to mark absent');
        }
      }
      await loadStatus();
    } catch (e: any) {
      setError(e.message || 'Could not update absence.');
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <View style={styles.container}>
      <Pressable onPress={onBack} style={[styles.backRow, { paddingTop: insets.top + spacing.sm }]}>
        <Text style={styles.backArrow}>‹</Text>
        <Text style={styles.backText}>All Classes</Text>
      </Pressable>

      <View style={styles.header}>
        <Text style={styles.headerTitle}>{className}</Text>
        <Text style={styles.headerSubtitle}>{students.length} students · fee status</Text>
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.indigo} />
        </View>
      ) : students.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>No students in this class.</Text>
        </View>
      ) : (
        <FlatList
          data={students}
          keyExtractor={(item) => item.student_id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <StudentRow
              student={item}
              toggling={togglingId === item.student_id}
              onPress={() => onSelectStudent(item.student_id)}
              onToggleAbsent={() => toggleAbsent(item.student_id, item.absent_today)}
            />
          )}
        />
      )}
    </View>
  );
}

function StudentRow({
  student,
  toggling,
  onPress,
  onToggleAbsent,
}: {
  student: StudentFeeRow;
  toggling: boolean;
  onPress: () => void;
  onToggleAbsent: () => void;
}) {
  const unpaidCount = student.fees.filter((f) => f.status === 'unpaid').length;
  const initials = `${student.first_name[0]}${student.last_name[0]}`.toUpperCase();

  return (
    <View style={[shadow.card, styles.cardWrap]}>
      <View style={styles.card}>
        <BlurView intensity={25} tint="light" style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.white }]} />

        <Pressable style={styles.rowMain} onPress={onPress}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.studentName}>
              {student.first_name} {student.last_name}
            </Text>
            <Text style={[styles.statusText, { color: unpaidCount > 0 ? colors.coral : colors.leaf }]}>
              {unpaidCount > 0 ? `${unpaidCount} unpaid fee${unpaidCount > 1 ? 's' : ''}` : 'All fees up to date'}
            </Text>
          </View>
        </Pressable>

        <Pressable
          style={[styles.absentToggle, student.absent_today && styles.absentToggleActive]}
          onPress={onToggleAbsent}
          disabled={toggling}
        >
          {toggling ? (
            <ActivityIndicator size="small" color={student.absent_today ? colors.white : colors.charcoalMuted} />
          ) : (
            <Text style={[styles.absentToggleText, student.absent_today && styles.absentToggleTextActive]}>
              {student.absent_today ? 'Absent' : 'Present'}
            </Text>
          )}
        </Pressable>
      </View>
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
  card: {
    flexDirection: 'row', alignItems: 'center', borderRadius: radii.lg, padding: spacing.md,
    overflow: 'hidden', borderWidth: 1, borderColor: colors.line,
  },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: 44, height: 44, borderRadius: radii.pill, backgroundColor: colors.indigo,
    alignItems: 'center', justifyContent: 'center', marginRight: spacing.md,
  },
  avatarText: { fontFamily: fonts.bodyBold, color: colors.white, fontSize: fontSizes.base },
  studentName: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.base, color: colors.charcoal },
  statusText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, marginTop: 2 },
  absentToggle: {
    borderWidth: 1, borderColor: colors.line, borderRadius: radii.pill,
    paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, minWidth: 72, alignItems: 'center',
  },
  absentToggleActive: { backgroundColor: colors.coral, borderColor: colors.coral },
  absentToggleText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.xs, color: colors.charcoalMuted },
  absentToggleTextActive: { color: colors.white },
});