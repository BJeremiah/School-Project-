// app/scores.tsx
// Score entry for one subject. New model: Class Score (SBA + Group Research + Practical
// Tasks + Projects, each /25, summed then halved to /50) + Exam (/100, halved to /50) = /100.

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  LayoutAnimation,
  Platform,
  UIManager,
  KeyboardAvoidingView,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { colors, fonts, fontSizes, radii, spacing, shadow } from '../../theme/theme';
import GlassButton from '../../components/GlassButton';
import { API_URL } from '../../config/api';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type RawScores = {
  sba_score: string;
  group_research: string;
  practical_tasks: string;
  projects: string;
  exam_score: string;
};

type StudentScore = {
  student_id: string;
  first_name: string;
  last_name: string;
  sba_score: number | null;
  group_research: number | null;
  practical_tasks: number | null;
  projects: number | null;
  exam_score: number | null;
  class_score: number | null; // out of 50, computed server-side once backend is updated
  exam_converted: number | null; // out of 50
  total: number | null; // out of 100
  position: number | null;
};

function gradeFor(total: number | null): { label: string; color: string } | null {
  if (total === null) return null;
  if (total >= 80) return { label: 'Excellent', color: colors.leaf };
  if (total >= 70) return { label: 'Very Good', color: colors.leaf };
  if (total >= 65) return { label: 'Good', color: colors.leaf };
  if (total >= 60) return { label: 'High Credit', color: colors.marigold };
  if (total >= 55) return { label: 'Credit', color: colors.marigold };
  if (total >= 50) return { label: 'Satisfactory', color: colors.marigold };
  if (total >= 45) return { label: 'Adequate', color: colors.coral };
  if (total >= 35) return { label: 'Minimally Adequate', color: colors.coral };
  return { label: 'Well Below Average', color: colors.coral };
}

// Live client-side calculation so teachers see the total update as they type,
// before saving. Mirrors what the backend will compute once updated.
function computeLive(raw: RawScores) {
  const sba = parseFloat(raw.sba_score) || 0;
  const research = parseFloat(raw.group_research) || 0;
  const practical = parseFloat(raw.practical_tasks) || 0;
  const projects = parseFloat(raw.projects) || 0;
  const exam = raw.exam_score === '' ? null : parseFloat(raw.exam_score) || 0;

  const hasAnyClassEntry =
    raw.sba_score !== '' || raw.group_research !== '' || raw.practical_tasks !== '' || raw.projects !== '';

  const classRaw = sba + research + practical + projects; // out of 100
  const classScore = hasAnyClassEntry ? Math.round((classRaw / 2) * 10) / 10 : null; // out of 50
  const examConverted = exam !== null ? Math.round((exam / 2) * 10) / 10 : null; // out of 50

  const total =
    classScore !== null || examConverted !== null
      ? Math.round(((classScore || 0) + (examConverted || 0)) * 10) / 10
      : null;

  return { classScore, examConverted, total };
}

export default function ScoresScreen({
  token,
  classId,
  subjectId,
  subjectName,
  onBack,
}: {
  token: string;
  classId: string;
  subjectId: string;
  subjectName: string;
  onBack: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<StudentScore[]>([]);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, RawScores>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const loadScores = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/assessment/subject/${subjectId}/scores?classId=${classId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load scores');

      const list: StudentScore[] = data.students;
      setStudents(list);

      const initialDrafts: Record<string, RawScores> = {};
      list.forEach((s) => {
        initialDrafts[s.student_id] = {
          sba_score: s.sba_score !== null && s.sba_score !== undefined ? String(s.sba_score) : '',
          group_research: s.group_research !== null && s.group_research !== undefined ? String(s.group_research) : '',
          practical_tasks: s.practical_tasks !== null && s.practical_tasks !== undefined ? String(s.practical_tasks) : '',
          projects: s.projects !== null && s.projects !== undefined ? String(s.projects) : '',
          exam_score: s.exam_score !== null && s.exam_score !== undefined ? String(s.exam_score) : '',
        };
      });
      setDrafts(initialDrafts);
    } catch (e: any) {
      setError(e.message || 'Could not reach the server.');
    } finally {
      setLoading(false);
    }
  }, [token, classId, subjectId]);

  useEffect(() => {
    loadScores();
  }, [loadScores]);

  const toggleExpand = (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const updateDraftField = (studentId: string, field: keyof RawScores, value: string) => {
    setDrafts((prev) => ({
      ...prev,
      [studentId]: { ...prev[studentId], [field]: value },
    }));
  };

  const saveStudent = async (studentId: string) => {
    setSavingId(studentId);
    setError('');
    try {
      const draft = drafts[studentId];
      const toNumberOrNull = (v: string) => (v === '' ? null : parseFloat(v));

      const res = await fetch(`${API_URL}/api/assessment/subject/${subjectId}/scores`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          classId,
          scores: {
            [studentId]: {
              sba_score: toNumberOrNull(draft.sba_score),
              group_research: toNumberOrNull(draft.group_research),
              practical_tasks: toNumberOrNull(draft.practical_tasks),
              projects: toNumberOrNull(draft.projects),
              exam_score: toNumberOrNull(draft.exam_score),
            },
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save score');

      await loadScores();
      setExpandedId(null);
    } catch (e: any) {
      setError(e.message || 'Could not save score.');
    } finally {
      setSavingId(null);
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
        <Pressable onPress={onBack} style={styles.backRow}>
          <Text style={styles.backArrow}>‹</Text>
          <Text style={styles.backText}>Subjects</Text>
        </Pressable>
        <Text style={styles.headerTitle}>{subjectName}</Text>
        <Text style={styles.headerSubtitle}>
          Class Score /50 · Exam /50 · Total /100
        </Text>
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
      <FlatList
        data={students}
        keyExtractor={(item) => item.student_id}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => {
          const draft = drafts[item.student_id] || {
            sba_score: '', group_research: '', practical_tasks: '', projects: '', exam_score: '',
          };
          const live = computeLive(draft);
          const grade = gradeFor(live.total);
          const isExpanded = expandedId === item.student_id;

          return (
            <StudentScoreCard
              student={item}
              draft={draft}
              live={live}
              grade={grade}
              expanded={isExpanded}
              saving={savingId === item.student_id}
              onToggle={() => toggleExpand(item.student_id)}
              onChangeField={(field, value) => updateDraftField(item.student_id, field, value)}
              onSave={() => saveStudent(item.student_id)}
            />
          );
        }}
      />
      </KeyboardAvoidingView>
    </View>
  );
}

function StudentScoreCard({
  student,
  draft,
  live,
  grade,
  expanded,
  saving,
  onToggle,
  onChangeField,
  onSave,
}: {
  student: StudentScore;
  draft: RawScores;
  live: { classScore: number | null; examConverted: number | null; total: number | null };
  grade: { label: string; color: string } | null;
  expanded: boolean;
  saving: boolean;
  onToggle: () => void;
  onChangeField: (field: keyof RawScores, value: string) => void;
  onSave: () => void;
}) {
  const initials = `${student.first_name[0]}${student.last_name[0]}`.toUpperCase();

  return (
    <View style={[shadow.card, styles.cardWrap]}>
      <Pressable onPress={onToggle} style={styles.cardHeader}>
        <BlurView intensity={25} tint="light" style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.white }]} />

        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.studentName}>
            {student.first_name} {student.last_name}
          </Text>
          {student.position ? (
            <Text style={styles.positionText}>Position {student.position}</Text>
          ) : (
            <Text style={styles.positionText}>Not yet scored</Text>
          )}
        </View>

        {live.total !== null && (
          <View style={styles.totalBadge}>
            <Text style={styles.totalBadgeText}>{live.total}</Text>
          </View>
        )}
      </Pressable>

      {expanded && (
        <View style={styles.expandedArea}>
          <View style={styles.inputGrid}>
            <ScoreInput label="SBA /25" value={draft.sba_score} onChangeText={(v) => onChangeField('sba_score', v)} max={25} />
            <ScoreInput label="Group Research /25" value={draft.group_research} onChangeText={(v) => onChangeField('group_research', v)} max={25} />
            <ScoreInput label="Practical Tasks /25" value={draft.practical_tasks} onChangeText={(v) => onChangeField('practical_tasks', v)} max={25} />
            <ScoreInput label="Projects /25" value={draft.projects} onChangeText={(v) => onChangeField('projects', v)} max={25} />
          </View>

          <ScoreInput label="Exam /100" value={draft.exam_score} onChangeText={(v) => onChangeField('exam_score', v)} max={100} fullWidth />

          <View style={styles.liveSummary}>
            <View style={styles.liveSummaryItem}>
              <Text style={styles.liveSummaryLabel}>Class /50</Text>
              <Text style={styles.liveSummaryValue}>{live.classScore ?? '—'}</Text>
            </View>
            <View style={styles.liveSummaryItem}>
              <Text style={styles.liveSummaryLabel}>Exam /50</Text>
              <Text style={styles.liveSummaryValue}>{live.examConverted ?? '—'}</Text>
            </View>
            <View style={styles.liveSummaryItem}>
              <Text style={styles.liveSummaryLabel}>Total /100</Text>
              <Text style={[styles.liveSummaryValue, { color: colors.indigo }]}>{live.total ?? '—'}</Text>
            </View>
          </View>

          {grade && (
            <View style={[styles.gradePill, { backgroundColor: grade.color }]}>
              <Text style={styles.gradePillText}>{grade.label}</Text>
            </View>
          )}

          <View style={{ marginTop: spacing.md }}>
            <GlassButton
              label={saving ? 'Saving...' : 'Save Score'}
              variant="success"
              onPress={onSave}
              disabled={saving}
            />
          </View>
        </View>
      )}
    </View>
  );
}

function clampInput(text: string, max: number): string {
  // Keep only digits and a single decimal point
  let cleaned = text.replace(/[^0-9.]/g, '');
  const parts = cleaned.split('.');
  if (parts.length > 2) cleaned = parts[0] + '.' + parts.slice(1).join('');
  if (cleaned === '' || cleaned === '.') return cleaned;

  const num = parseFloat(cleaned);
  if (!isNaN(num) && num > max) return String(max);
  return cleaned;
}

function ScoreInput({
  label,
  value,
  onChangeText,
  max,
  fullWidth = false,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  max: number;
  fullWidth?: boolean;
}) {
  return (
    <View style={[styles.inputBox, fullWidth && { width: '100%' }]}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput
        style={styles.input}
        keyboardType="numeric"
        value={value}
        onChangeText={(text) => onChangeText(clampInput(text, max))}
        placeholder="—"
        placeholderTextColor={colors.charcoalMuted}
      />
    </View>
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
  backRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs },
  backArrow: { fontFamily: fonts.bodyBold, fontSize: fontSizes.xl, color: colors.indigo, marginRight: 4 },
  backText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.base, color: colors.indigo },
  headerTitle: { fontFamily: fonts.display, fontSize: fontSizes.xxl, color: colors.indigo },
  headerSubtitle: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.charcoalMuted,
    marginTop: 2,
  },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  cardWrap: { marginBottom: spacing.sm, borderRadius: radii.lg, overflow: 'hidden' },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radii.lg,
    padding: spacing.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.line,
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
  studentName: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.base, color: colors.charcoal },
  positionText: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.charcoalMuted, marginTop: 2 },
  totalBadge: {
    backgroundColor: colors.leafLight,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  totalBadgeText: { fontFamily: fonts.bodyBold, color: colors.leaf, fontSize: fontSizes.base },
  expandedArea: {
    backgroundColor: colors.white,
    borderBottomLeftRadius: radii.lg,
    borderBottomRightRadius: radii.lg,
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: colors.line,
    padding: spacing.md,
  },
  inputGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm },
  inputBox: { width: '47%' },
  inputLabel: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.charcoalMuted, marginBottom: 4 },
  input: {
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSizes.base,
    color: colors.charcoal,
    backgroundColor: colors.cloud,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.line,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  liveSummary: {
    flexDirection: 'row',
    marginTop: spacing.sm,
    backgroundColor: colors.cloud,
    borderRadius: radii.md,
    padding: spacing.sm,
  },
  liveSummaryItem: { flex: 1, alignItems: 'center' },
  liveSummaryLabel: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.charcoalMuted },
  liveSummaryValue: { fontFamily: fonts.bodyBold, fontSize: fontSizes.lg, color: colors.charcoal, marginTop: 2 },
  gradePill: {
    alignSelf: 'flex-start',
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    marginTop: spacing.sm,
  },
  gradePillText: { fontFamily: fonts.bodyBold, color: colors.white, fontSize: fontSizes.sm },
});