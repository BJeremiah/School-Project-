// screens/director/StatisticsScreen.tsx
// Trend statistics: revenue (week/month), admissions (month), attendance rate (week),
// each compared against the prior period with a direction + percent change.

import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { colors, fonts, fontSizes, radii, spacing, shadow } from '../../theme/theme';
import { API_URL } from '../../config/api';
import DevelopmentChart from '../../components/DevelopmentChart';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Trend = { direction: 'up' | 'down' | 'flat'; percent_change: number } | 'up' | 'flat';

type Statistics = {
  revenue: {
    this_week: number; last_week: number; week_trend: Trend;
    this_month: number; last_month: number; month_trend: Trend;
  };
  admissions: {
    this_month: number; last_month: number; trend: Trend; total_active_students: number;
  };
  attendance: {
    this_week_rate_percent: number | null; last_week_rate_percent: number | null; trend: Trend | null;
  };
};

function trendArrow(trend: Trend | null) {
  if (!trend) return '';
  const direction = typeof trend === 'string' ? trend : trend.direction;
  if (direction === 'up') return '▲';
  if (direction === 'down') return '▼';
  return '—';
}

function trendColor(trend: Trend | null) {
  if (!trend) return colors.charcoalMuted;
  const direction = typeof trend === 'string' ? trend : trend.direction;
  if (direction === 'up') return colors.leaf;
  if (direction === 'down') return colors.coral;
  return colors.charcoalMuted;
}

function trendLabel(trend: Trend | null) {
  if (!trend) return '';
  if (typeof trend === 'string') return '';
  return `${Math.abs(trend.percent_change)}%`;
}

export default function StatisticsScreen({ token, onBack }: { token: string; onBack: () => void }) {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Statistics | null>(null);
  const [chartData, setChartData] = useState<{ date: string; attendance: number | null; revenue: number; performance: number | null }[]>([]);
  const [error, setError] = useState('');

  const loadStats = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [statsRes, timeseriesRes] = await Promise.all([
        fetch(`${API_URL}/api/director/statistics`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_URL}/api/director/statistics/timeseries`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const statsData = await statsRes.json();
      if (!statsRes.ok) throw new Error(statsData.error || 'Failed to load statistics');
      const timeseriesData = await timeseriesRes.json();
      if (!timeseriesRes.ok) throw new Error(timeseriesData.error || 'Failed to load timeseries');

      setStats(statsData);

      const combined = timeseriesData.revenue_by_day.map((r: any, i: number) => ({
        date: r.date,
        attendance: timeseriesData.attendance_by_day[i]?.rate_percent ?? null,
        revenue: r.revenue,
        performance: timeseriesData.performance_by_day[i]?.avg_score ?? null,
      }));
      setChartData(combined);
    } catch (e: any) {
      setError(e.message || 'Could not reach the server.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  return (
    <View style={styles.container}>
      <Pressable onPress={onBack} style={[styles.backRow, { paddingTop: insets.top + spacing.sm }]}>
        <Text style={styles.backArrow}>‹</Text>
        <Text style={styles.backText}>Overview</Text>
      </Pressable>

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Statistics</Text>
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.indigo} />
        </View>
      ) : stats ? (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {chartData.length > 0 && <DevelopmentChart data={chartData} />}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Revenue</Text>
            <TrendRow
              label="This Week"
              value={`GHS ${stats.revenue.this_week.toFixed(2)}`}
              compareLabel={`vs GHS ${stats.revenue.last_week.toFixed(2)} last week`}
              trend={stats.revenue.week_trend}
            />
            <TrendRow
              label="This Month"
              value={`GHS ${stats.revenue.this_month.toFixed(2)}`}
              compareLabel={`vs GHS ${stats.revenue.last_month.toFixed(2)} last month`}
              trend={stats.revenue.month_trend}
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Admissions</Text>
            <TrendRow
              label="This Month"
              value={String(stats.admissions.this_month)}
              compareLabel={`vs ${stats.admissions.last_month} last month`}
              trend={stats.admissions.trend}
            />
            <View style={styles.plainRow}>
              <Text style={styles.plainLabel}>Total Active Students</Text>
              <Text style={styles.plainValue}>{stats.admissions.total_active_students}</Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Attendance</Text>
            <TrendRow
              label="This Week"
              value={stats.attendance.this_week_rate_percent !== null ? `${stats.attendance.this_week_rate_percent}%` : '—'}
              compareLabel={
                stats.attendance.last_week_rate_percent !== null
                  ? `vs ${stats.attendance.last_week_rate_percent}% last week`
                  : 'No prior data'
              }
              trend={stats.attendance.trend}
            />
          </View>
        </ScrollView>
      ) : null}
    </View>
  );
}

function TrendRow({
  label,
  value,
  compareLabel,
  trend,
}: {
  label: string;
  value: string;
  compareLabel: string;
  trend: Trend | null;
}) {
  return (
    <View style={styles.trendRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.trendLabel}>{label}</Text>
        <Text style={styles.trendCompare}>{compareLabel}</Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={styles.trendValue}>{value}</Text>
        <Text style={[styles.trendChange, { color: trendColor(trend) }]}>
          {trendArrow(trend)} {trendLabel(trend)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cloud },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { fontFamily: fonts.bodySemiBold, color: colors.coral, textAlign: 'center', marginBottom: spacing.sm },
  backRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.sm },
  backArrow: { fontFamily: fonts.bodyBold, fontSize: fontSizes.xl, color: colors.indigo, marginRight: 4 },
  backText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.base, color: colors.indigo },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  headerTitle: { fontFamily: fonts.display, fontSize: fontSizes.xxl, color: colors.indigo },
  scrollContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  section: {
    backgroundColor: colors.white, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.line,
    padding: spacing.md, marginBottom: spacing.md, ...shadow.card,
  },
  sectionTitle: { fontFamily: fonts.bodyBold, fontSize: fontSizes.base, color: colors.indigo, marginBottom: spacing.sm },
  trendRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.line },
  trendLabel: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.base, color: colors.charcoal },
  trendCompare: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.charcoalMuted, marginTop: 2 },
  trendValue: { fontFamily: fonts.bodyBold, fontSize: fontSizes.base, color: colors.charcoal },
  trendChange: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.xs, marginTop: 2 },
  plainRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.sm },
  plainLabel: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.charcoalMuted },
  plainValue: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.base, color: colors.charcoal },
});