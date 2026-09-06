// screens/teacher/ReportCardScreen.tsx
// Fill in a student's term remarks (attendance, talent & interest, conduct, teacher/head remarks),
// save them, then generate and download the PDF report card.

import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { colors, fonts, fontSizes, radii, spacing, shadow } from '../../theme/theme';
import { API_URL } from '../../config/api';

export default function ReportCardScreen({
  token,
  classId,
  studentId,
  studentName,
  onBack,
}: {
  token: string;
  classId: string;
  studentId: string;
  studentName: string;
  onBack: () => void;
}) {
  const [term, setTerm] = useState('Term One');
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [nextTermBegins, setNextTermBegins] = useState('');
  const [attendancePresent, setAttendancePresent] = useState('');
  const [attendanceTotal, setAttendanceTotal] = useState('');
  const [talentAndInterest, setTalentAndInterest] = useState('');
  const [conduct, setConduct] = useState('');
  const [classTeacherRemarks, setClassTeacherRemarks] = useState('');
  const [headTeacherRemarks, setHeadTeacherRemarks] = useState('');

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  const loadRemarks = useCallback(async () => {
    if (!term || !year) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/reportcards/${studentId}?term=${encodeURIComponent(term)}&year=${encodeURIComponent(year)}&classId=${classId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load remarks');
      const r = data.remarks;
      if (r) {
        setNextTermBegins(r.next_term_begins ? r.next_term_begins.slice(0, 10) : '');
        setAttendancePresent(r.attendance_present !== null ? String(r.attendance_present) : '');
        setAttendanceTotal(r.attendance_total !== null ? String(r.attendance_total) : '');
        setTalentAndInterest(r.talent_and_interest || '');
        setConduct(r.conduct || '');
        setClassTeacherRemarks(r.class_teacher_remarks || '');
        setHeadTeacherRemarks(r.head_teacher_remarks || '');
      } else {
        setNextTermBegins('');
        setAttendancePresent('');
        setAttendanceTotal('');
        setTalentAndInterest('');
        setConduct('');
        setClassTeacherRemarks('');
        setHeadTeacherRemarks('');
      }
    } catch (e: any) {
      setError(e.message || 'Could not reach the server.');
    } finally {
      setLoading(false);
    }
  }, [token, classId, studentId, term, year]);

  useEffect(() => {
    loadRemarks();
  }, [loadRemarks]);

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/reportcards/${studentId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          term,
          year,
          classId,
          next_term_begins: nextTermBegins.trim() || undefined,
          attendance_present: attendancePresent.trim() ? Number(attendancePresent) : undefined,
          attendance_total: attendanceTotal.trim() ? Number(attendanceTotal) : undefined,
          talent_and_interest: talentAndInterest.trim() || undefined,
          conduct: conduct.trim() || undefined,
          class_teacher_remarks: classTeacherRemarks.trim() || undefined,
          head_teacher_remarks: headTeacherRemarks.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save');
      Alert.alert('Saved', 'Report card details saved.');
    } catch (e: any) {
      setError(e.message || 'Could not save.');
    } finally {
      setSaving(false);
    }
  };

  const generatePdf = async () => {
    console.log('generatePdf: started');
    setGenerating(true);
    setError('');
    try {
      // Save first, so the PDF reflects the latest entered remarks
      await fetch(`${API_URL}/api/reportcards/${studentId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          term,
          year,
          classId,
          next_term_begins: nextTermBegins.trim() || undefined,
          attendance_present: attendancePresent.trim() ? Number(attendancePresent) : undefined,
          attendance_total: attendanceTotal.trim() ? Number(attendanceTotal) : undefined,
          talent_and_interest: talentAndInterest.trim() || undefined,
          conduct: conduct.trim() || undefined,
          class_teacher_remarks: classTeacherRemarks.trim() || undefined,
          head_teacher_remarks: headTeacherRemarks.trim() || undefined,
        }),
      });

      const url = `${API_URL}/api/reportcards/${studentId}/pdf?term=${encodeURIComponent(term)}&year=${encodeURIComponent(year)}&classId=${classId}`;
      const fileUri = `${FileSystem.cacheDirectory}${studentName.replace(/\s+/g, '_')}_ReportCard.pdf`;

      console.log('generatePdf: about to download from', url);
      const downloadResult = await FileSystem.downloadAsync(url, fileUri, {
        headers: { Authorization: `Bearer ${token}` },
      });
      console.log('generatePdf: download finished, status:', downloadResult.status);

      if (downloadResult.status !== 200) {
        throw new Error(`Server returned status ${downloadResult.status}`);
      }

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(downloadResult.uri, { mimeType: 'application/pdf' });
      } else {
        Alert.alert('Downloaded', `Saved to: ${downloadResult.uri}`);
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not generate the report card.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <View style={styles.container}>
      <Pressable onPress={onBack} style={styles.backRow}>
        <Text style={styles.backArrow}>‹</Text>
        <Text style={styles.backText}>Back</Text>
      </Pressable>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Report Card</Text>
        <Text style={styles.subtitle}>{studentName}</Text>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <View style={styles.section}>
          <LabeledInput label="Term" value={term} onChangeText={setTerm} />
          <LabeledInput label="Year" value={year} onChangeText={setYear} />
          <LabeledInput label="Next Term Begins (YYYY-MM-DD)" value={nextTermBegins} onChangeText={setNextTermBegins} />
        </View>

        {loading ? (
          <ActivityIndicator color={colors.indigo} style={{ marginVertical: spacing.md }} />
        ) : (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Attendance</Text>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <View style={{ flex: 1 }}>
                  <LabeledInput label="Present" value={attendancePresent} onChangeText={setAttendancePresent} keyboardType="number-pad" />
                </View>
                <View style={{ flex: 1 }}>
                  <LabeledInput label="Out of Total" value={attendanceTotal} onChangeText={setAttendanceTotal} keyboardType="number-pad" />
                </View>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Talent and Interest</Text>
              <TextInput
                style={[styles.input, { height: 60, textAlignVertical: 'top' }]}
                value={talentAndInterest}
                onChangeText={setTalentAndInterest}
                multiline
              />
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Conduct</Text>
              <Text style={styles.hint}>Courtesy, emotional control, initiative, dependability, sense of co-operation</Text>
              <TextInput
                style={[styles.input, { height: 60, textAlignVertical: 'top' }]}
                value={conduct}
                onChangeText={setConduct}
                multiline
              />
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Class Teacher's Remarks</Text>
              <TextInput
                style={[styles.input, { height: 60, textAlignVertical: 'top' }]}
                value={classTeacherRemarks}
                onChangeText={setClassTeacherRemarks}
                multiline
              />
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Head Teacher's Remarks</Text>
              <TextInput
                style={[styles.input, { height: 60, textAlignVertical: 'top' }]}
                value={headTeacherRemarks}
                onChangeText={setHeadTeacherRemarks}
                multiline
              />
            </View>

            <Pressable style={styles.saveButton} onPress={save} disabled={saving}>
              {saving ? <ActivityIndicator color={colors.white} /> : <Text style={styles.saveButtonText}>Save</Text>}
            </Pressable>

            <Pressable style={styles.generateButton} onPress={generatePdf} disabled={generating}>
              {generating ? <ActivityIndicator color={colors.white} /> : <Text style={styles.generateButtonText}>Generate PDF Report Card</Text>}
            </Pressable>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function LabeledInput({
  label,
  value,
  onChangeText,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  keyboardType?: 'default' | 'number-pad';
}) {
  return (
    <View style={{ marginBottom: spacing.sm }}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput style={styles.input} value={value} onChangeText={onChangeText} keyboardType={keyboardType || 'default'} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cloud },
  errorText: { fontFamily: fonts.bodySemiBold, color: colors.coral, textAlign: 'center', marginBottom: spacing.sm },
  backRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.sm },
  backArrow: { fontFamily: fonts.bodyBold, fontSize: fontSizes.xl, color: colors.indigo, marginRight: 4 },
  backText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.base, color: colors.indigo },
  scrollContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  title: { fontFamily: fonts.display, fontSize: fontSizes.xxl, color: colors.indigo },
  subtitle: { fontFamily: fonts.body, fontSize: fontSizes.base, color: colors.charcoalMuted, marginBottom: spacing.md },
  section: {
    backgroundColor: colors.white, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.line,
    padding: spacing.md, marginBottom: spacing.md, ...shadow.card,
  },
  sectionTitle: { fontFamily: fonts.bodyBold, fontSize: fontSizes.base, color: colors.indigo, marginBottom: spacing.xs },
  hint: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.charcoalMuted, marginBottom: spacing.sm },
  inputLabel: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.charcoalMuted, marginBottom: 2 },
  input: {
    borderWidth: 1, borderColor: colors.line, borderRadius: radii.md, padding: spacing.sm,
    fontFamily: fonts.body, fontSize: fontSizes.base, color: colors.charcoal,
  },
  saveButton: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.indigo, borderRadius: radii.pill, paddingVertical: spacing.md, alignItems: 'center', marginBottom: spacing.sm },
  saveButtonText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.base, color: colors.indigo },
  generateButton: { backgroundColor: colors.indigo, borderRadius: radii.pill, paddingVertical: spacing.md, alignItems: 'center' },
  generateButtonText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.base, color: colors.white },
});