// app/subjects.tsx
// Continuous Assessment entry point — lists every subject as a bubble-glass card.
// Tapping a subject will (in the next screen we build) open score entry for that subject.

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Animated,
  TextInput,
  Alert,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { colors, fonts, fontSizes, radii, spacing, shadow } from '../theme/theme';
import GlassButton from '../components/GlassButton';
import { API_URL } from '../config/api';

type Subject = {
  id: string;
  name: string;
};

export default function SubjectsScreen({
  token,
  onSelectSubject,
}: {
  token: string;
  onSelectSubject: (subject: Subject) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [error, setError] = useState('');
  const [addingSubject, setAddingSubject] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState('');
  const [saving, setSaving] = useState(false);

  const loadSubjects = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/assessment/subjects`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load subjects');
      setSubjects(data.subjects);
    } catch (e: any) {
      setError(e.message || 'Could not reach the server.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadSubjects();
  }, [loadSubjects]);

  const deleteSubject = (subject: Subject) => {
    Alert.alert(
      'Delete Subject',
      `Delete "${subject.name}"? This will permanently remove all scores entered for this subject.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await fetch(`${API_URL}/api/assessment/subjects/${subject.id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
              });
              const data = await res.json();
              if (!res.ok) throw new Error(data.error || 'Failed to delete subject');
              loadSubjects();
            } catch (e: any) {
              setError(e.message || 'Could not delete subject.');
            }
          },
        },
      ]
    );
  };
  
  const addSubject = async () => {
    if (!newSubjectName.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/assessment/subjects`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: newSubjectName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add subject');
      setNewSubjectName('');
      setAddingSubject(false);
      loadSubjects();
    } catch (e: any) {
      setError(e.message || 'Could not add subject.');
    } finally {
      setSaving(false);
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
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Continuous Assessment</Text>
        <Text style={styles.headerSubtitle}>Pick a subject to enter scores</Text>
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <FlatList
        data={subjects}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <SubjectCard
            subject={item}
            onPress={() => onSelectSubject(item)}
            onLongPress={() => deleteSubject(item)}
          />
        )}
        ListFooterComponent={
          <View style={{ marginTop: spacing.sm }}>
            {addingSubject ? (
              <View style={styles.addCard}>
                <TextInput
                  style={styles.addInput}
                  placeholder="New subject name"
                  placeholderTextColor={colors.charcoalMuted}
                  value={newSubjectName}
                  onChangeText={setNewSubjectName}
                  autoFocus
                />
                <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
                  <View style={{ flex: 1 }}>
                    <GlassButton
                      label="Cancel"
                      variant="ghost"
                      onPress={() => {
                        setAddingSubject(false);
                        setNewSubjectName('');
                      }}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <GlassButton
                      label={saving ? 'Adding...' : 'Add'}
                      variant="success"
                      onPress={addSubject}
                      disabled={saving}
                    />
                  </View>
                </View>
              </View>
            ) : (
              <GlassButton
                label="+ Add Subject"
                variant="ghost"
                onPress={() => setAddingSubject(true)}
              />
            )}
          </View>
        }
      />
    </View>
  );
}

function SubjectCard({
  subject,
  onPress,
  onLongPress,
}: {
  subject: Subject;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const scale = React.useRef(new Animated.Value(1)).current;

  const pressIn = () =>
    Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 40, bounciness: 6 }).start();
  const pressOut = () =>
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 8 }).start();

  return (
    <Animated.View style={[{ transform: [{ scale }] }, shadow.card, styles.cardWrap]}>
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        delayLongPress={400}
        onPressIn={pressIn}
        onPressOut={pressOut}
        style={styles.card}
      >
        <BlurView intensity={25} tint="light" style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.leafLight }]} />

        <View style={styles.subjectIcon}>
          <Text style={styles.subjectIconText}>{subject.name[0].toUpperCase()}</Text>
        </View>

        <Text style={styles.subjectName}>{subject.name}</Text>

        <Text style={styles.chevron}>›</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cloud },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.cloud },
  errorText: {
    fontFamily: fonts.bodySemiBold,
    color: colors.coral,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  header: { padding: spacing.lg, paddingBottom: spacing.md },
  headerTitle: { fontFamily: fonts.display, fontSize: fontSizes.xxl, color: colors.indigo },
  headerSubtitle: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.charcoalMuted,
    marginTop: 2,
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
  subjectIcon: {
    width: 44,
    height: 44,
    borderRadius: radii.pill,
    backgroundColor: colors.leaf,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  subjectIconText: { fontFamily: fonts.bodyBold, color: colors.white, fontSize: fontSizes.base },
  subjectName: { flex: 1, fontFamily: fonts.bodySemiBold, fontSize: fontSizes.base, color: colors.charcoal },
  chevron: { fontFamily: fonts.bodyBold, fontSize: fontSizes.xl, color: colors.charcoalMuted },
  addCard: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.line,
  },
  addInput: {
    fontFamily: fonts.body,
    fontSize: fontSizes.base,
    color: colors.charcoal,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    paddingVertical: spacing.sm,
  },
});
