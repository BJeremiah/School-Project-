// screens/SearchScreen.tsx
// Search for a student by name or admission number, school-wide.

import React, { useState } from 'react';
import { View, Text, TextInput, FlatList, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { BlurView } from 'expo-blur';
import { colors, fonts, fontSizes, radii, spacing, shadow } from '../../theme/theme';
import { API_URL } from '../../config/api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type SearchResult = {
  id: string;
  first_name: string;
  last_name: string;
  gender: 'M' | 'F';
  admission_number: string | null;
  class_name: string;
};

export default function SearchScreen({
  token,
  onBack,
  onSelectStudent,
}: {
  token: string;
  onBack: () => void;
  onSelectStudent: (studentId: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState('');

  const runSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError('');
    setSearched(true);
    try {
      const res = await fetch(`${API_URL}/api/secretary/students/search?q=${encodeURIComponent(query.trim())}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Search failed');
      setResults(data.results);
    } catch (e: any) {
      setError(e.message || 'Could not reach the server.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Pressable onPress={onBack} style={[styles.backRow, { paddingTop: insets.top + spacing.sm }]}>
        <Text style={styles.backArrow}>‹</Text>
        <Text style={styles.backText}>Back</Text>
      </Pressable>

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Search Students</Text>
        <View style={styles.searchRow}>
          <TextInput
            style={styles.searchInput}
            placeholder="Name or admission number"
            placeholderTextColor={colors.charcoalMuted}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={runSearch}
            returnKeyType="search"
            autoFocus
          />
          <Pressable style={styles.searchButton} onPress={runSearch}>
            <Text style={styles.searchButtonText}>Go</Text>
          </Pressable>
        </View>
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.indigo} />
        </View>
      ) : searched && results.length === 0 && !error ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>No students found for "{query}".</Text>
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <ResultCard result={item} onPress={() => onSelectStudent(item.id)} />
          )}
        />
      )}
    </View>
  );
}

function ResultCard({ result, onPress }: { result: SearchResult; onPress: () => void }) {
  const initials = `${result.first_name[0]}${result.last_name[0]}`.toUpperCase();

  return (
    <Pressable onPress={onPress}>
      <View style={[shadow.card, styles.cardWrap]}>
        <View style={styles.card}>
          <BlurView intensity={25} tint="light" style={StyleSheet.absoluteFill} />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.white }]} />

          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.studentName}>
              {result.first_name} {result.last_name}
            </Text>
            <Text style={styles.studentSubtext}>
              {result.class_name} · {result.admission_number || 'No admission number'}
            </Text>
          </View>

          <Text style={styles.chevron}>›</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cloud },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.base, color: colors.charcoalMuted, textAlign: 'center', paddingHorizontal: spacing.lg },
  errorText: {
    fontFamily: fonts.bodySemiBold,
    color: colors.coral,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  backArrow: { fontFamily: fonts.bodyBold, fontSize: fontSizes.xl, color: colors.indigo, marginRight: 4 },
  backText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.base, color: colors.indigo },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  headerTitle: { fontFamily: fonts.display, fontSize: fontSizes.xxl, color: colors.indigo, marginBottom: spacing.sm },
  searchRow: { flexDirection: 'row', gap: spacing.sm },
  searchInput: {
    flex: 1,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.md,
    padding: spacing.md,
    fontFamily: fonts.body,
    fontSize: fontSizes.base,
    color: colors.charcoal,
  },
  searchButton: {
    backgroundColor: colors.indigo,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchButtonText: { fontFamily: fonts.bodyBold, fontSize: fontSizes.base, color: colors.white },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  cardWrap: { marginBottom: spacing.sm, borderRadius: radii.lg, overflow: 'hidden' },
  card: {
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
  studentSubtext: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.charcoalMuted, marginTop: 2 },
  chevron: { fontFamily: fonts.bodyBold, fontSize: fontSizes.xl, color: colors.charcoalMuted },
});
