import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Alert, ScrollView, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, fontSizes, radii, spacing, shadow } from '../../theme/theme';
import { API_URL } from '../../config/api';
import PasswordInput from '../../components/PasswordInput';

type TeacherOption = {
  id: string;
  name: string;
  email: string;
};

type ClassAssignment = {
  id: string;
  class_name: string;
  teacher_id: string | null;
  teacher_name: string | null;
  teacher_email: string | null;
};

export default function AssignTeachersScreen({
  token,
  onBack,
}: {
  token: string;
  onBack: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [classes, setClasses] = useState<ClassAssignment[]>([]);
  const [teachers, setTeachers] = useState<TeacherOption[]>([]);
  const [error, setError] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [selectedNewClassId, setSelectedNewClassId] = useState<string | null>(null);
  const [creatingTeacher, setCreatingTeacher] = useState(false);
  const unassignedClasses = classes.filter((cls) => !cls.teacher_id);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/director/teacher-assignments`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load teacher assignments');
      setClasses(data.classes || []);
      setTeachers(data.teachers || []);
    } catch (e: any) {
      setError(e.message || 'Could not load teacher assignments.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const updateTeacher = async (classId: string, teacherId: string | null) => {
    setSaving((prev) => ({ ...prev, [classId]: true }));
    try {
      const res = await fetch(`${API_URL}/api/director/classes/${classId}/teacher`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ teacher_id: teacherId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update teacher assignment');

      setClasses((prev) =>
        prev.map((cls) =>
          cls.id === classId
            ? {
                ...cls,
                teacher_id: data.class.teacher_id,
                teacher_name: data.class.teacher_name,
                teacher_email: teachers.find((t) => t.id === data.class.teacher_id)?.email || null,
              }
            : cls
        )
      );
      Alert.alert('Saved', data.message || 'Teacher assignment updated.');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not update assignment.');
    } finally {
      setSaving((prev) => ({ ...prev, [classId]: false }));
    }
  };

  const createTeacher = async () => {
    if (!newName.trim() || !newEmail.trim() || !newPassword || !selectedNewClassId) {
      Alert.alert('Missing info', 'Please fill in name, email, temporary password, and class.');
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert('Password too short', 'The temporary password must be at least 6 characters.');
      return;
    }

    setCreatingTeacher(true);
    try {
      const res = await fetch(`${API_URL}/api/director/teacher-accounts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: newName.trim(),
          email: newEmail.trim(),
          password: newPassword,
          classId: selectedNewClassId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create teacher account');

      setTeachers((prev) => [
        ...prev,
        { id: data.teacher.id, name: data.teacher.name, email: data.teacher.email },
      ]);
      setClasses((prev) =>
        prev.map((cls) =>
          cls.id === selectedNewClassId
            ? {
                ...cls,
                teacher_id: data.teacher.id,
                teacher_name: data.teacher.name,
                teacher_email: data.teacher.email,
              }
            : cls
        )
      );
      setNewName('');
      setNewEmail('');
      setNewPassword('');
      setSelectedNewClassId(null);
      setShowCreateForm(false);
      Alert.alert('Teacher created', `${data.teacher.name} has been created and assigned to the selected class.`);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not create teacher account.');
    } finally {
      setCreatingTeacher(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.indigo} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={onBack} style={styles.backRow}>
          <Text style={styles.backArrow}>‹</Text>
          <Text style={styles.backText}>Overview</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Assign Teachers</Text>
        <Text style={styles.headerSubtitle}>Each class must have one teacher account.</Text>
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <ScrollView contentContainerStyle={styles.list}>
        <View style={[styles.card, shadow.card]}>
          <Pressable style={styles.addTeacherButton} onPress={() => setShowCreateForm((prev) => !prev)}>
            <Text style={styles.addTeacherButtonText}>{showCreateForm ? 'Hide Form' : '+ Add Teacher'}</Text>
          </Pressable>

          {showCreateForm ? (
            <View style={styles.formWrap}>
              <TextInput
                style={styles.input}
                placeholder="Teacher name"
                placeholderTextColor={colors.charcoalMuted}
                value={newName}
                onChangeText={setNewName}
              />
              <TextInput
                style={styles.input}
                placeholder="Teacher email"
                placeholderTextColor={colors.charcoalMuted}
                keyboardType="email-address"
                autoCapitalize="none"
                value={newEmail}
                onChangeText={setNewEmail}
              />
              <PasswordInput
                style={styles.input}
                placeholder="Temporary password"
                placeholderTextColor={colors.charcoalMuted}
                value={newPassword}
                onChangeText={setNewPassword}
              />

              <Text style={styles.label}>Assign to class</Text>
              {unassignedClasses.length === 0 ? (
                <Text style={styles.classMeta}>Every class already has a teacher assigned.</Text>
              ) : (
                <View style={styles.classList}>
                  {unassignedClasses.map((cls) => (
                    <Pressable
                      key={cls.id}
                      onPress={() => setSelectedNewClassId(cls.id)}
                      style={[
                        styles.classPill,
                        selectedNewClassId === cls.id && styles.classPillSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.classPillText,
                          selectedNewClassId === cls.id && styles.classPillTextSelected,
                        ]}
                      >
                        {cls.class_name}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}

              <Pressable style={styles.primaryButton} onPress={createTeacher} disabled={creatingTeacher}>
                {creatingTeacher ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryButtonText}>Create Teacher</Text>}
              </Pressable>
            </View>
          ) : null}
        </View>

        {classes.map((cls) => (
          <View key={cls.id} style={[styles.card, shadow.card]}>
            <View style={styles.classHeader}>
              <Text style={styles.className}>{cls.class_name}</Text>
              <Text style={styles.classMeta}>Teacher is required to log in.</Text>
            </View>

            <Text style={styles.label}>Assigned Teacher</Text>
            <View style={styles.pickerWrap}>
              <Pressable
                style={styles.pickerButton}
                onPress={() => {
                  const teacherId = cls.teacher_id || '';
                  const nextTeacher = teachers.find((teacher) => teacher.id !== teacherId && teacher.id !== '');
                  if (nextTeacher) {
                    updateTeacher(cls.id, nextTeacher.id);
                  } else {
                    updateTeacher(cls.id, null);
                  }
                }}
              >
                <Text style={styles.pickerText}>
                  {cls.teacher_name ? `${cls.teacher_name} (${cls.teacher_email || 'teacher'})` : 'Unassigned'}
                </Text>
                <Text style={styles.pickerChevron}>▾</Text>
              </Pressable>
            </View>

            <View style={styles.teacherList}>
              <Pressable style={[styles.optionButton, !cls.teacher_id && styles.optionButtonSelected]} onPress={() => updateTeacher(cls.id, null)}>
                <Text style={[styles.optionText, !cls.teacher_id && styles.optionTextSelected]}>Unassigned</Text>
              </Pressable>

              {teachers.map((teacher) => (
                <Pressable
                  key={teacher.id}
                  style={[styles.optionButton, cls.teacher_id === teacher.id && styles.optionButtonSelected]}
                  onPress={() => updateTeacher(cls.id, teacher.id)}
                  disabled={saving[cls.id]}
                >
                  <Text style={[styles.optionText, cls.teacher_id === teacher.id && styles.optionTextSelected]}>
                    {teacher.name}
                  </Text>
                </Pressable>
              ))}
            </View>

            {saving[cls.id] ? <ActivityIndicator style={styles.saving} color={colors.indigo} /> : null}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cloud },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.cloud },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  backRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs },
  backArrow: { fontFamily: fonts.bodyBold, fontSize: fontSizes.xl, color: colors.indigo, marginRight: 4 },
  backText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.base, color: colors.indigo },
  headerTitle: { fontFamily: fonts.display, fontSize: fontSizes.xxl, color: colors.indigo },
  headerSubtitle: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.charcoalMuted, marginTop: 2 },
  errorText: { fontFamily: fonts.bodySemiBold, color: colors.coral, textAlign: 'center', marginBottom: spacing.sm },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  card: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  classHeader: { marginBottom: spacing.sm },
  className: { fontFamily: fonts.bodyBold, fontSize: fontSizes.base, color: colors.charcoal },
  classMeta: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.charcoalMuted, marginTop: 2 },
  label: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.charcoalMuted, marginBottom: spacing.xs },
  pickerWrap: { marginBottom: spacing.sm },
  pickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.md,
    padding: spacing.md,
    backgroundColor: colors.cloud,
  },
  pickerText: { fontFamily: fonts.body, fontSize: fontSizes.base, color: colors.charcoal },
  pickerChevron: { fontFamily: fonts.bodyBold, fontSize: fontSizes.lg, color: colors.charcoalMuted },
  teacherList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  optionButton: {
    backgroundColor: colors.cloud,
    borderRadius: radii.pill,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.line,
    marginRight: spacing.xs,
    marginBottom: spacing.xs,
  },
  optionButtonSelected: {
    backgroundColor: colors.indigo,
    borderColor: colors.indigo,
  },
  optionText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.charcoal },
  optionTextSelected: { color: colors.white },
  saving: { marginTop: spacing.sm },
  addTeacherButton: {
    backgroundColor: colors.indigo,
    borderRadius: radii.md,
    padding: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  addTeacherButtonText: { fontFamily: fonts.bodyBold, fontSize: fontSizes.base, color: colors.white },
  formWrap: { marginTop: spacing.sm },
  input: {
    backgroundColor: colors.cloud,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    fontFamily: fonts.body,
    fontSize: fontSizes.base,
    color: colors.charcoal,
  },
  classList: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.sm },
  classPill: {
    backgroundColor: colors.cloud,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.pill,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    marginRight: spacing.xs,
    marginBottom: spacing.xs,
  },
  classPillSelected: {
    backgroundColor: colors.indigo,
    borderColor: colors.indigo,
  },
  classPillText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.charcoal },
  classPillTextSelected: { color: colors.white },
  primaryButton: {
    backgroundColor: colors.indigo,
    borderRadius: radii.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  primaryButtonText: { fontFamily: fonts.bodyBold, color: colors.white, fontSize: fontSizes.base },
});
