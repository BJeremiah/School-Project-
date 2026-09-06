// screens/teacher/TeacherClassPickerScreen.tsx
// Shown right after a Teacher logs in — pick which class to work in for this session.

import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { BlurView } from 'expo-blur';
import { colors, fonts, fontSizes, radii, spacing, shadow } from '../../theme/theme';
import { API_URL } from '../../config/api';

type ClassOption = { id: string; class_name: string };

export default function TeacherClassPickerScreen({
  token,
  onSelectClass,
}: {
  token: string;
  onSelectClass: (classId: string, className: string) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [error, setError] = useState('');

  const loadClasses = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/students/all-classes`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load classes');
      setClasses(data.classes);
    } catch (e: any) {
      setError(e.message || 'Could not reach the server.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadClasses();
  }, [loadClasses]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Select Your Class</Text>
        <Text style={styles.headerSubtitle}>Which class are you teaching today?</Text>
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.indigo} />
        </View>
      ) : classes.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>No classes found.</Text>
        </View>
      ) : (
        <FlatList
          data={classes}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Pressable onPress={() => onSelectClass(item.id, item.class_name)}>
              <View style={[shadow.card, styles.cardWrap]}>
                <View style={styles.card}>
                  <BlurView intensity={25} tint="light" style={StyleSheet.absoluteFill} />
                  <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.white }]} />

                  <View style={styles.classIcon}>
                    <Text style={styles.classIconText}>{item.class_name.charAt(0).toUpperCase()}</Text>
                  </View>

                  <Text style={styles.className}>{item.class_name}</Text>
                  <Text style={styles.chevron}>›</Text>
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
  header: { padding: spacing.lg, paddingBottom: spacing.md },
  headerTitle: { fontFamily: fonts.display, fontSize: fontSizes.xxl, color: colors.indigo },
  headerSubtitle: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.charcoalMuted, marginTop: 2 },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  cardWrap: { marginBottom: spacing.sm, borderRadius: radii.lg, overflow: 'hidden' },
  card: {
    flexDirection: 'row', alignItems: 'center', borderRadius: radii.lg, padding: spacing.md,
    overflow: 'hidden', borderWidth: 1, borderColor: colors.line,
  },
  classIcon: {
    width: 44, height: 44, borderRadius: radii.pill, backgroundColor: colors.indigo,
    alignItems: 'center', justifyContent: 'center', marginRight: spacing.md,
  },
  classIconText: { fontFamily: fonts.bodyBold, color: colors.white, fontSize: fontSizes.base },
  className: { flex: 1, fontFamily: fonts.bodySemiBold, fontSize: fontSizes.base, color: colors.charcoal },
  chevron: { fontFamily: fonts.bodyBold, fontSize: fontSizes.xl, color: colors.charcoalMuted },
});