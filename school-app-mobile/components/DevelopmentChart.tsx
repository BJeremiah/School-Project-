// components/DevelopmentChart.tsx
// A hand-drawn SVG line chart combining Attendance, Finance, and Academic Performance
// into one composite "school development" score per day (0-100 scale), plus the three
// underlying lines shown individually beneath it.

import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Svg, { Polyline, Line, Circle, Text as SvgText } from 'react-native-svg';
import { colors, fonts, fontSizes, spacing, radii } from '../theme/theme';

type DayData = {
  date: string;
  attendance: number | null; // 0-100
  revenue: number; // raw GHS
  performance: number | null; // 0-100
};

function buildPoints(
  values: (number | null)[],
  width: number,
  height: number,
  padding: number,
  min: number,
  max: number
) {
  const usableWidth = width - padding * 2;
  const usableHeight = height - padding * 2;
  const range = max - min || 1;
  return values.map((v, i) => {
    const x = padding + (values.length > 1 ? (i / (values.length - 1)) * usableWidth : usableWidth / 2);
    if (v === null) return null;
    const y = padding + usableHeight - ((v - min) / range) * usableHeight;
    return { x, y };
  });
}

function Sparkline({
  values,
  color,
  height = 60,
}: {
  values: (number | null)[];
  color: string;
  height?: number;
}) {
  const width = Dimensions.get('window').width - spacing.lg * 2 - spacing.md * 2;
  const padding = 8;
  const nonNull = values.filter((v): v is number => v !== null);
  const min = nonNull.length ? Math.min(...nonNull) : 0;
  const max = nonNull.length ? Math.max(...nonNull) : 100;
  const points = buildPoints(values, width, height, padding, min, max === min ? min + 1 : max);

  const validPoints = points.filter((p): p is { x: number; y: number } => p !== null);
  const polylinePoints = validPoints.map((p) => `${p.x},${p.y}`).join(' ');

  return (
    <Svg width={width} height={height}>
      {polylinePoints ? (
        <Polyline points={polylinePoints} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
      ) : null}
      {validPoints.length > 0 && (
        <Circle cx={validPoints[validPoints.length - 1].x} cy={validPoints[validPoints.length - 1].y} r={4} fill={color} />
      )}
    </Svg>
  );
}

export default function DevelopmentChart({ data }: { data: DayData[] }) {
  // Composite score: normalize each metric to 0-100, average the three, weighted
  // 40% attendance, 30% finance (relative to the period's max single day), 30% performance.
  const revenues = data.map((d) => d.revenue);
  const maxRevenue = Math.max(...revenues, 1);

  const composite: (number | null)[] = data.map((d) => {
    const parts: number[] = [];
    const weights: number[] = [];
    if (d.attendance !== null) {
      parts.push(d.attendance);
      weights.push(0.4);
    }
    const revenueScore = (d.revenue / maxRevenue) * 100;
    parts.push(revenueScore);
    weights.push(0.3);
    if (d.performance !== null) {
      parts.push(d.performance);
      weights.push(0.3);
    }
    if (parts.length === 0) return null;
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    const weighted = parts.reduce((sum, p, i) => sum + p * weights[i], 0);
    return Math.round((weighted / totalWeight) * 10) / 10;
  });

  const latestComposite = [...composite].reverse().find((v) => v !== null);

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>School Development</Text>
        {latestComposite !== undefined && latestComposite !== null && (
          <Text style={styles.latestValue}>{latestComposite}/100</Text>
        )}
      </View>
      <Text style={styles.subtitle}>Composite of attendance, finance & academic performance</Text>

      <Sparkline values={composite} color={colors.indigo} height={90} />

      <View style={styles.legendGrid}>
        <View style={styles.legendItem}>
          <View style={styles.legendRow}>
            <View style={[styles.dot, { backgroundColor: colors.leaf }]} />
            <Text style={styles.legendLabel}>Attendance</Text>
          </View>
          <Sparkline values={data.map((d) => d.attendance)} color={colors.leaf} height={40} />
        </View>
        <View style={styles.legendItem}>
          <View style={styles.legendRow}>
            <View style={[styles.dot, { backgroundColor: colors.marigold }]} />
            <Text style={styles.legendLabel}>Finance</Text>
          </View>
          <Sparkline values={data.map((d) => d.revenue)} color={colors.marigold} height={40} />
        </View>
        <View style={styles.legendItem}>
          <View style={styles.legendRow}>
            <View style={[styles.dot, { backgroundColor: colors.coral }]} />
            <Text style={styles.legendLabel}>Performance</Text>
          </View>
          <Sparkline values={data.map((d) => d.performance)} color={colors.coral} height={40} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontFamily: fonts.bodyBold, fontSize: fontSizes.base, color: colors.indigo },
  latestValue: { fontFamily: fonts.display, fontSize: fontSizes.lg, color: colors.indigo },
  subtitle: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.charcoalMuted, marginBottom: spacing.sm },
  legendGrid: { marginTop: spacing.sm, gap: spacing.sm },
  legendItem: { marginBottom: spacing.xs },
  legendRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: spacing.xs },
  legendLabel: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.xs, color: colors.charcoalMuted },
});