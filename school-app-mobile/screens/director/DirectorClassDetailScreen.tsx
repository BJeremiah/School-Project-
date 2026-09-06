// screens/director/DirectorClassDetailScreen.tsx
// Students in one class with today's attendance status (present/absent/holiday/not_submitted).
// Tap a student to open their full master profile.

import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { BlurView } from 'expo-blur';
import { colors, fonts, fontSizes, radii, spacing, shadow } from '../../theme/theme';
import { API_URL } from '../../config/api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type StudentAttendance = {
  id: string;
  first_name: string;
  last_name: string;
  gender: 'M' | 'F';
  attendance_today: 'present' | 'absent' | 'holiday' | 'not_submitted';
};

function statusColor(status: string) {
  if (status === 'present') return colors.leaf;
  if (status === 'absent') return colors.coral;
  if (status === 'holiday') return colors.marigold;
  return colors.charcoalMuted;
}

function statusLabel(status: string) {
  if (status === 'present') return 'Present';
  if (status === 'absent') return 'Absent';
  if (status === 'holiday') return 'Holiday';
  return 'Not Submitted';
}

export default function DirectorClassDetailScreen({
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
  const [students, setStudents] = useState<StudentAttendance[]>([]);
  const [error, setError] = useState('');

  const loadDetail = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/director/all-classes/${classId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load class detail');
      setStudents(data.students);
    } catch (e: any) {
      setError(e.message || 'Could not reach the server.');
    } finally {
      setLoading(false);
    }
  }, [token, classId]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  return (
    <View style={styles.container}>
      <Pressable onPress={onBack} style={[styles.backRow, { paddingTop: insets.top + spacing.sm }]}>
        <Text style={styles.backArrow}>‹</Text>
        <Text style={styles.backText}>All Classes</Text>
      </Pressable>

      <View style={styles.header}>
        <Text style={styles.headerTitle}>{className}</Text>
        <Text style={styles.headerSubtitle}>{students.length} students · today's attendance</Text>
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
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Pressable onPress={() => onSelectStudent(item.id)}>
              <View style={[shadow.card, styles.cardWrap]}>
                <View style={styles.card}>
                  <BlurView intensity={25} tint="light" style={StyleSheet.absoluteFill} />
                  <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.white }]} />

                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                      {item.first_name[0]}
                      {item.last_name[0]}
                    </Text>
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.studentName}>
                      {item.first_name} {item.last_name}
                    </Text>
                  </View>

                  <View style={[styles.statusPill, { backgroundColor: statusColor(item.attendance_today) }]}>
                    <Text style={styles.statusPillText}>{statusLabel(item.attendance_today)}</Text>
                  </View>
                </View>
              </View>
            </Pressable>
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
  avatar: { width: 44, height: 44, borderRadius: radii.pill, backgroundColor: colors.indigo, alignItems: 'center', justifyContent: 'center', marginRight: spacing.md },
  avatarText: { fontFamily: fonts.bodyBold, color: colors.white, fontSize: fontSizes.base },
  studentName: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.base, color: colors.charcoal },
  statusPill: { borderRadius: radii.pill, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  statusPillText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.xs, color: colors.white },
});