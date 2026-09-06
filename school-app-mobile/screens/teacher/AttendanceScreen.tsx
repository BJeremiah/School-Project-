// screens/teacher/AttendanceScreen.tsx
// Daily attendance marking screen — bubble-glass, Duolingo-style.
// Lists every student in the selected class as a card with a Present/Absent toggle.
// Long-press a card to remove that student. "+ Add Student" opens a quick-add form.

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Animated,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, fontSizes, radii, spacing, shadow } from '../../theme/theme';
import GlassButton from '../../components/GlassButton';
import { API_URL } from '../../config/api';

type Student = {
  id: string;
  first_name: string;
  last_name: string;
  gender: 'M' | 'F';
};

type AttendanceResponse = {
  class_id: string;
  term_ended: boolean;
  submitted: boolean;
  is_holiday: boolean;
  is_weekend: boolean;
  students: Student[];
  marks: Record<string, boolean>;
};

type ActionName = 'holiday' | 'end-term' | 'reopen';

export default function AttendanceScreen({ token, classId }: { token: string; classId: string }) {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [students, setStudents] = useState<Student[]>([]);
  const [marks, setMarks] = useState<Record<string, boolean>>({});
  const [termEnded, setTermEnded] = useState(false);
  const [isHoliday, setIsHoliday] = useState(false);
  const [isWeekend, setIsWeekend] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState<ActionName | null>(null);

  // Add Student modal state
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [newFirstName, setNewFirstName] = useState('');
  const [newLastName, setNewLastName] = useState('');
  const [newGender, setNewGender] = useState<'M' | 'F'>('M');
  const [newAdmissionNumber, setNewAdmissionNumber] = useState('');
  const [addingStudent, setAddingStudent] = useState(false);
  const [addError, setAddError] = useState('');

  const [removingId, setRemovingId] = useState<string | null>(null);

  const loadAttendance = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/attendance/today?classId=${classId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data: AttendanceResponse = await res.json();
      if (!res.ok) throw new Error((data as any).error || 'Failed to load');

      setStudents(data.students);
      setTermEnded(data.term_ended);
      setIsHoliday(data.is_holiday);
      setIsWeekend(data.is_weekend);
      setIsSubmitted(data.submitted);

      const initialMarks: Record<string, boolean> = {};
      data.students.forEach((s) => {
        initialMarks[s.id] = data.marks[s.id] !== undefined ? data.marks[s.id] : true;
      });
      setMarks(initialMarks);
    } catch (e: any) {
      setError(e.message || 'Could not reach the server.');
    } finally {
      setLoading(false);
    }
  }, [token, classId]);

  useEffect(() => {
    loadAttendance();
  }, [loadAttendance]);

  const toggleStudent = (id: string) => {
    setMarks((prev) => ({ ...prev, [id]: !prev[id] }));
    setIsSubmitted(false);
  };

  const submitAttendance = async () => {
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/attendance/today`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ marks, classId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save');
      await loadAttendance();
    } catch (e: any) {
      setError(e.message || 'Could not save attendance.');
    } finally {
      setSaving(false);
    }
  };

  const runAction = async (endpoint: ActionName) => {
    setActionLoading(endpoint);
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/attendance/${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ classId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Action failed');
      await loadAttendance();
    } catch (e: any) {
      setError(e.message || 'Could not complete that action.');
    } finally {
      setActionLoading(null);
    }
  };

  const confirmAction = (endpoint: ActionName, title: string, message: string) => {
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Yes', style: 'destructive', onPress: () => runAction(endpoint) },
    ]);
  };

  const openAddModal = () => {
    setNewFirstName('');
    setNewLastName('');
    setNewGender('M');
    setNewAdmissionNumber('');
    setAddError('');
    setAddModalVisible(true);
  };

  const submitAddStudent = async () => {
    if (!newFirstName.trim() || !newLastName.trim()) {
      setAddError('First name and last name are required.');
      return;
    }
    setAddingStudent(true);
    setAddError('');
    try {
      const res = await fetch(`${API_URL}/api/students`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          first_name: newFirstName.trim(),
          last_name: newLastName.trim(),
          gender: newGender,
          admission_number: newAdmissionNumber.trim() || undefined,
          classId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add student');
      setAddModalVisible(false);
      await loadAttendance();
    } catch (e: any) {
      setAddError(e.message || 'Could not reach the server.');
    } finally {
      setAddingStudent(false);
    }
  };

  const confirmRemoveStudent = (student: Student) => {
    Alert.alert(
      'Remove Student',
      `Remove ${student.first_name} ${student.last_name} from this class?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => removeStudent(student.id),
        },
      ]
    );
  };

  const removeStudent = async (id: string) => {
    setRemovingId(id);
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/students/${id}?classId=${classId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to remove student');
      await loadAttendance();
    } catch (e: any) {
      setError(e.message || 'Could not remove student.');
    } finally {
      setRemovingId(null);
    }
  };

  const presentCount = Object.values(marks).filter(Boolean).length;
  const absentCount = students.length - presentCount;

  const genderStats = students.reduce(
    (acc, s) => {
      const isPresent = marks[s.id];
      if (s.gender === 'M') {
        isPresent ? acc.malePresent++ : acc.maleAbsent++;
      } else {
        isPresent ? acc.femalePresent++ : acc.femaleAbsent++;
      }
      return acc;
    },
    { malePresent: 0, maleAbsent: 0, femalePresent: 0, femaleAbsent: 0 }
  );

  const todayLabel = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.indigo} />
      </View>
    );
  }

  if (termEnded) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>The register has been ended for this term.</Text>
        <View style={{ marginTop: spacing.lg, width: '80%' }}>
          <GlassButton
            label={actionLoading === 'reopen' ? 'Reopening...' : 'Reopen Register'}
            onPress={() =>
              confirmAction('reopen', 'Reopen Register', 'This will allow attendance to be taken again this term.')
            }
            variant="primary"
            disabled={actionLoading !== null}
          />
        </View>
      </View>
    );
  }

  if (isWeekend) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>Today is Weekend</Text>
        <Text style={[styles.hintText, { marginTop: spacing.sm }]}>
          Attendance is not taken on Saturdays and Sundays.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <View style={styles.titleRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Today's Attendance</Text>
            <Text style={styles.dateLabel}>{todayLabel}</Text>
          </View>
          <Pressable style={styles.addStudentButton} onPress={openAddModal}>
            <Text style={styles.addStudentButtonText}>+ Add</Text>
          </Pressable>
        </View>

        {!isHoliday && (
          <>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${students.length ? (presentCount / students.length) * 100 : 0}%` },
                ]}
              />
            </View>
            <Text style={styles.headerSubtitle}>
              {presentCount} / {students.length} present
            </Text>

            <View style={styles.statsRow}>
              <View style={[styles.statCard, { backgroundColor: colors.leafLight }]}>
                <Text style={[styles.statValue, { color: colors.leaf }]}>{presentCount}</Text>
                <Text style={styles.statLabel}>Present</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: colors.coralLight }]}>
                <Text style={[styles.statValue, { color: colors.coral }]}>{absentCount}</Text>
                <Text style={styles.statLabel}>Absent</Text>
              </View>
            </View>

            <View style={styles.statsRow}>
              <View style={styles.statCardSmall}>
                <Text style={styles.statValueSmall}>{genderStats.malePresent}/{genderStats.malePresent + genderStats.maleAbsent}</Text>
                <Text style={styles.statLabel}>Boys present</Text>
              </View>
              <View style={styles.statCardSmall}>
                <Text style={styles.statValueSmall}>{genderStats.femalePresent}/{genderStats.femalePresent + genderStats.femaleAbsent}</Text>
                <Text style={styles.statLabel}>Girls present</Text>
              </View>
            </View>
          </>
        )}

        <View style={styles.actionRow}>
          <Pressable
            style={styles.actionButton}
            onPress={() =>
              confirmAction(
                'holiday',
                'Mark Today as Holiday',
                'This will clear any attendance marks already taken today and mark it as a holiday.'
              )
            }
            disabled={actionLoading !== null}
          >
            <Text style={styles.actionButtonText}>
              {actionLoading === 'holiday' ? 'Marking...' : '🌴 Mark Holiday'}
            </Text>
          </Pressable>
          <Pressable
            style={styles.actionButton}
            onPress={() =>
              confirmAction(
                'end-term',
                'End Term',
                'This will lock the attendance register for this class until it is reopened. Continue?'
              )
            }
            disabled={actionLoading !== null}
          >
            <Text style={styles.actionButtonText}>
              {actionLoading === 'end-term' ? 'Ending...' : '🔒 End Term'}
            </Text>
          </Pressable>
        </View>

        {!isHoliday && students.length > 0 && (
          <Text style={styles.hintText}>Long-press a student to remove them</Text>
        )}
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {isHoliday ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>Today is marked as a Holiday.</Text>
          <View style={{ marginTop: spacing.lg, width: '80%' }}>
            <GlassButton
              label={saving ? 'Undoing...' : 'Not a Holiday — Undo'}
              onPress={submitAttendance}
              variant="primary"
              disabled={saving}
            />
          </View>
        </View>
      ) : (
        <>
          <FlatList
            data={students}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => (
              <StudentCard
                student={item}
                present={marks[item.id]}
                removing={removingId === item.id}
                onToggle={() => toggleStudent(item.id)}
                onLongPress={() => confirmRemoveStudent(item)}
              />
            )}
          />

          <View style={styles.footer}>
            <GlassButton
              label={saving ? 'Saving...' : isSubmitted ? 'Submitted ✓' : 'Submit Attendance'}
              onPress={submitAttendance}
              variant={isSubmitted ? 'success' : 'primary'}
              disabled={saving || students.length === 0}
            />
          </View>
        </>
      )}

      <Modal visible={addModalVisible} transparent animationType="fade" onRequestClose={() => setAddModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Add Student</Text>

            <TextInput
              style={styles.modalInput}
              placeholder="First Name"
              value={newFirstName}
              onChangeText={setNewFirstName}
            />
            <TextInput
              style={styles.modalInput}
              placeholder="Last Name"
              value={newLastName}
              onChangeText={setNewLastName}
            />

            <View style={styles.genderRow}>
              <Pressable
                style={[styles.genderOption, newGender === 'M' && styles.genderOptionActive]}
                onPress={() => setNewGender('M')}
              >
                <Text style={[styles.genderOptionText, newGender === 'M' && styles.genderOptionTextActive]}>Male</Text>
              </Pressable>
              <Pressable
                style={[styles.genderOption, newGender === 'F' && styles.genderOptionActive]}
                onPress={() => setNewGender('F')}
              >
                <Text style={[styles.genderOptionText, newGender === 'F' && styles.genderOptionTextActive]}>Female</Text>
              </Pressable>
            </View>

            <TextInput
              style={styles.modalInput}
              placeholder="Admission Number (optional)"
              value={newAdmissionNumber}
              onChangeText={setNewAdmissionNumber}
            />

            {addError ? <Text style={styles.errorText}>{addError}</Text> : null}

            <View style={styles.modalButtonRow}>
              <Pressable style={styles.modalCancelButton} onPress={() => setAddModalVisible(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.modalSaveButton} onPress={submitAddStudent} disabled={addingStudent}>
                {addingStudent ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={styles.modalSaveText}>Add</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function StudentCard({
  student,
  present,
  removing,
  onToggle,
  onLongPress,
}: {
  student: Student;
  present: boolean;
  removing: boolean;
  onToggle: () => void;
  onLongPress: () => void;
}) {
  const scale = React.useRef(new Animated.Value(1)).current;

  const pressIn = () =>
    Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 40, bounciness: 6 }).start();
  const pressOut = () =>
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 8 }).start();

  const initials = `${student.first_name[0]}${student.last_name[0]}`.toUpperCase();

  return (
    <Animated.View style={[{ transform: [{ scale }] }, shadow.card, styles.cardWrap]}>
      <Pressable
        onPress={onToggle}
        onLongPress={onLongPress}
        onPressIn={pressIn}
        onPressOut={pressOut}
        style={styles.card}
        disabled={removing}
      >
        <BlurView intensity={25} tint="light" style={StyleSheet.absoluteFill} />
        <View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: present ? colors.leafLight : colors.coralLight },
          ]}
        />

        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>

        <View style={styles.nameBlock}>
          <Text style={styles.studentName}>
            {student.first_name} {student.last_name}
          </Text>
          <Text style={styles.statusLabel}>{removing ? 'Removing...' : present ? 'Present' : 'Absent'}</Text>
        </View>

        {removing ? (
          <ActivityIndicator color={colors.charcoalMuted} />
        ) : (
          <View style={[styles.statusPill, { backgroundColor: present ? colors.leaf : colors.coral }]}>
            <Text style={styles.statusPillText}>{present ? '✓' : '✕'}</Text>
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cloud },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.cloud },
  emptyText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.base, color: colors.charcoalMuted, textAlign: 'center' },
  errorText: {
    fontFamily: fonts.bodySemiBold,
    color: colors.coral,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  header: { padding: spacing.lg, paddingBottom: spacing.md },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontFamily: fonts.display, fontSize: fontSizes.xxl, color: colors.indigo },
  dateLabel: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.charcoalMuted,
    marginTop: 2,
    marginBottom: spacing.sm,
  },
  addStudentButton: {
    backgroundColor: colors.indigo,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  addStudentButtonText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.white },
  headerSubtitle: {
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSizes.base,
    color: colors.charcoalMuted,
    marginTop: spacing.xs,
  },
  progressTrack: {
    height: 10,
    borderRadius: radii.pill,
    backgroundColor: colors.line,
    marginTop: spacing.sm,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: radii.pill,
    backgroundColor: colors.marigold,
  },
  statsRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  statCard: {
    flex: 1,
    borderRadius: radii.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  statCardSmall: {
    flex: 1,
    borderRadius: radii.md,
    padding: spacing.sm,
    alignItems: 'center',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
  },
  statValue: { fontFamily: fonts.display, fontSize: fontSizes.xl },
  statValueSmall: { fontFamily: fonts.bodyBold, fontSize: fontSizes.lg, color: colors.indigo },
  statLabel: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.charcoalMuted, marginTop: 2 },
  actionRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  actionButton: {
    flex: 1,
    borderRadius: radii.pill,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
  },
  actionButtonText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.charcoal },
  hintText: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    color: colors.charcoalMuted,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  cardWrap: { marginBottom: spacing.sm, borderRadius: radii.lg },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radii.lg,
    padding: spacing.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: radii.pill,
    backgroundColor: colors.indigo,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  avatarText: { fontFamily: fonts.bodyBold, color: colors.white, fontSize: fontSizes.base },
  nameBlock: { flex: 1 },
  studentName: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.base, color: colors.charcoal },
  statusLabel: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.charcoalMuted, marginTop: 2 },
  statusPill: {
    width: 36,
    height: 36,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusPillText: { fontFamily: fonts.bodyBold, color: colors.white, fontSize: fontSizes.lg },
  footer: { padding: spacing.lg, paddingTop: spacing.sm },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalCard: {
    width: '100%',
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: spacing.lg,
  },
  modalTitle: {
    fontFamily: fonts.display,
    fontSize: fontSizes.xl,
    color: colors.indigo,
    marginBottom: spacing.md,
  },
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
  genderRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  genderOption: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.pill,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  genderOptionActive: { backgroundColor: colors.indigo, borderColor: colors.indigo },
  genderOptionText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.charcoal },
  genderOptionTextActive: { color: colors.white },
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