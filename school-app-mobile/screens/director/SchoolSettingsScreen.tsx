// screens/director/SchoolSettingsScreen.tsx
// Director-only: view/edit the school's name, shown on the login screen
// and used as the domain for every user's login email.

import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, fontSizes, radii, spacing, shadow } from '../../theme/theme';
import { API_URL } from '../../config/api';

export default function SchoolSettingsScreen({ token, onBack }: { token: string; onBack: () => void }) {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [schoolName, setSchoolName] = useState('');
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/auth/school-name`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load school name');
      setSchoolName(data.school_name);
      setDraft(data.school_name);
    } catch (e: any) {
      setError(e.message || 'Could not reach the server.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    if (!draft.trim()) {
      Alert.alert('Name required', 'Please enter a school name.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/director/settings/school-name`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ school_name: draft.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update school name');
      setSchoolName(data.school_name);
      Alert.alert('Saved', 'The school name has been updated. It will now show on the login screen.');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not save school name.');
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
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={onBack} style={styles.backRow}>
          <Text style={styles.backArrow}>‹</Text>
          <Text style={styles.backText}>Overview</Text>
        </Pressable>
        <Text style={styles.headerTitle}>School Settings</Text>
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>School Name</Text>
        <Text style={styles.hint}>
          Shown on the login screen. Also used as the login email domain for every account
          (e.g. name@{schoolName.trim().toLowerCase().replace(/\s+/g, '-')}).
        </Text>
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          placeholder="School name"
        />
        <Pressable style={styles.saveButton} onPress={save} disabled={saving}>
          {saving ? <ActivityIndicator color={colors.white} /> : <Text style={styles.saveButtonText}>Save</Text>}
        </Pressable>
      </View>
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
  errorText: { fontFamily: fonts.bodySemiBold, color: colors.coral, textAlign: 'center', marginBottom: spacing.sm },
  section: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.md,
    marginHorizontal: spacing.lg,
    ...shadow.card,
  },
  sectionTitle: { fontFamily: fonts.bodyBold, fontSize: fontSizes.base, color: colors.indigo, marginBottom: spacing.xs },
  hint: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.charcoalMuted, marginBottom: spacing.sm },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.md,
    padding: spacing.md,
    fontFamily: fonts.body,
    fontSize: fontSizes.base,
    color: colors.charcoal,
  },
  saveButton: {
    backgroundColor: colors.indigo,
    borderRadius: radii.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  saveButtonText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.base, color: colors.white },
});