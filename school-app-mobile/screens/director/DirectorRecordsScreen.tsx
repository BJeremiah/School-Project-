// screens/director/DirectorRecordsScreen.tsx
// Fee records: all-time gross total, plus school-wide and per-class totals for a
// selectable range (day/week/month).

import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { colors, fonts, fontSizes, radii, spacing, shadow } from '../../theme/theme';
import { API_URL } from '../../config/api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Range = 'day' | 'week' | 'month';

type ClassTotal = {
  class_name: string;
  total: number;
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function DirectorRecordsScreen({ token, onBack }: { token: string; onBack: () => void }) {
  const insets = useSafeAreaInsets();
  const [range, setRange] = useState<Range>('day');
  const [loading, setLoading] = useState(true);
  const [grossTotal, setGrossTotal] = useState(0);
  const [rangeTotal, setRangeTotal] = useState(0);
  const [rangeStart, setRangeStart] = useState('');
  const [rangeEnd, setRangeEnd] = useState('');
  const [byClass, setByClass] = useState<ClassTotal[]>([]);
  const [error, setError] = useState('');

  const loadRecords = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/director/all-records?range=${range}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load records');
      setGrossTotal(data.gross_total_all_time);
      setRangeTotal(data.total);
      setRangeStart(data.start);
      setRangeEnd(data.end);
      setByClass(data.by_class);
    } catch (e: any) {
      setError(e.message || 'Could not reach the server.');
    } finally {
      setLoading(false);
    }
  }, [token, range]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  const rangeLabel = range === 'day' ? 'Today' : range === 'week' ? 'This Week' : 'This Month';

  return (
    <View style={styles.container}>
      <Pressable onPress={onBack} style={[styles.backRow, { paddingTop: insets.top + spacing.sm }]}>
        <Text style={styles.backArrow}>‹</Text>
        <Text style={styles.backText}>Overview</Text>
      </Pressable>

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Records</Text>
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.indigo} />
        </View>
      ) : (
        <FlatList
          data={byClass}
          keyExtractor={(item) => item.class_name}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <>
              <View style={styles.grossCard}>
                <Text style={styles.grossLabel}>All-Time Gross Total</Text>
                <Text style={styles.grossValue}>GHS {grossTotal.toFixed(2)}</Text>
              </View>

              <View style={styles.rangeRow}>
                <RangeButton label="Day" active={range === 'day'} onPress={() => setRange('day')} />
                <RangeButton label="Week" active={range === 'week'} onPress={() => setRange('week')} />
                <RangeButton label="Month" active={range === 'month'} onPress={() => setRange('month')} />
              </View>

              <View style={styles.rangeCard}>
                <Text style={styles.rangeCardLabel}>
                  {rangeLabel} ({formatDate(rangeStart)} – {formatDate(rangeEnd)})
                </Text>
                <Text style={styles.rangeCardValue}>GHS {rangeTotal.toFixed(2)}</Text>
              </View>

              <Text style={styles.byClassTitle}>By Class</Text>
            </>
          }
          renderItem={({ item }) => (
            <View style={styles.classRow}>
              <Text style={styles.classRowName}>{item.class_name}</Text>
              <Text style={styles.classRowTotal}>GHS {item.total.toFixed(2)}</Text>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.emptyText}>No classes found.</Text>}
        />
      )}
    </View>
  );
}

function RangeButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.rangeButton, active && styles.rangeButtonActive]} onPress={onPress}>
      <Text style={[styles.rangeButtonText, active && styles.rangeButtonTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cloud },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.base, color: colors.charcoalMuted, textAlign: 'center' },
  errorText: { fontFamily: fonts.bodySemiBold, color: colors.coral, textAlign: 'center', marginBottom: spacing.sm },
  backRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.sm },
  backArrow: { fontFamily: fonts.bodyBold, fontSize: fontSizes.xl, color: colors.indigo, marginRight: 4 },
  backText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.base, color: colors.indigo },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  headerTitle: { fontFamily: fonts.display, fontSize: fontSizes.xxl, color: colors.indigo },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  grossCard: { backgroundColor: colors.indigo, borderRadius: radii.lg, padding: spacing.lg, alignItems: 'center', marginBottom: spacing.md },
  grossLabel: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.white, opacity: 0.85 },
  grossValue: { fontFamily: fonts.display, fontSize: fontSizes.xxl, color: colors.white, marginTop: 2 },
  rangeRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  rangeButton: { flex: 1, borderWidth: 1, borderColor: colors.line, borderRadius: radii.pill, paddingVertical: spacing.sm, alignItems: 'center', backgroundColor: colors.white },
  rangeButtonActive: { backgroundColor: colors.indigo, borderColor: colors.indigo },
  rangeButtonText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.charcoal },
  rangeButtonTextActive: { color: colors.white },
  rangeCard: { backgroundColor: colors.white, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.line, padding: spacing.md, marginBottom: spacing.md, ...shadow.card },
  rangeCardLabel: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.charcoalMuted },
  rangeCardValue: { fontFamily: fonts.display, fontSize: fontSizes.xl, color: colors.leaf, marginTop: 2 },
  byClassTitle: { fontFamily: fonts.bodyBold, fontSize: fontSizes.base, color: colors.indigo, marginBottom: spacing.sm },
  classRow: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: colors.white, borderRadius: radii.md, borderWidth: 1, borderColor: colors.line, padding: spacing.md, marginBottom: spacing.sm },
  classRowName: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.base, color: colors.charcoal },
  classRowTotal: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.base, color: colors.leaf },
});