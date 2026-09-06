// screens/teacher/RecordsScreen.tsx
// Records tab: toggle between Attendance History (weeks → days, drill-down) and Rankings.

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Animated,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { colors, fonts, fontSizes, radii, spacing, shadow } from '../../theme/theme';
import { API_URL } from '../../config/api';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Mode = 'history' | 'rankings';

type Week = { week_start: string; week_end: string };
type Day = {
  date: string;
  is_holiday: boolean;
  boys_present?: number;
  girls_present?: number;
  total_present?: number;
  total_absent?: number;
};
type WeekDetail = {
  week_start: string;
  week_end: string;
  days: Day[];
  week_totals: { boys_present: number; girls_present: number; total_present: number; total_absent: number };
};
type DayDetail = {
  date: string;
  exists: boolean;
  is_holiday?: boolean;
  summary?: {
    boys_present: number;
    girls_present: number;
    total_present: number;
    total_absent: number;
    absent_students: string[];
  };
};
type RankingEntry = {
  student_id: string;
  first_name: string;
  last_name: string;
  overall_total: number;
  subjects_counted: number;
  position: number;
};

function formatDateLabel(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00Z');
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
}
function formatRangeLabel(start: string, end: string) {
  const s = new Date(start + 'T00:00:00Z');
  const e = new Date(end + 'T00:00:00Z');
  const sLabel = s.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  const eLabel = e.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  return `${sLabel} – ${eLabel}`;
}

export default function RecordsScreen({
  token,
  classId,
  onOpenReportCard,
}: {
  token: string;
  classId: string;
  onOpenReportCard: (studentId: string, studentName: string) => void;
}) {
  const [mode, setMode] = useState<Mode>('history');

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Records</Text>
        <View style={styles.toggleRow}>
          <ToggleButton label="Attendance" active={mode === 'history'} onPress={() => setMode('history')} />
          <ToggleButton label="Rankings" active={mode === 'rankings'} onPress={() => setMode('rankings')} />
        </View>
      </View>

      {mode === 'history' ? (
        <AttendanceHistory token={token} classId={classId} />
      ) : (
        <Rankings token={token} classId={classId} onOpenReportCard={onOpenReportCard} />
      )}
    </View>
  );
}

function ToggleButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.toggleButton, active && styles.toggleButtonActive]}
    >
      <Text style={[styles.toggleButtonText, active && styles.toggleButtonTextActive]}>{label}</Text>
    </Pressable>
  );
}

// ---------- Attendance History ----------

function AttendanceHistory({ token, classId }: { token: string; classId: string }) {
  const [loading, setLoading] = useState(true);
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [error, setError] = useState('');
  const [selectedWeek, setSelectedWeek] = useState<Week | null>(null);

  const loadWeeks = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/attendance/weeks?classId=${classId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load weeks');
      setWeeks(data.weeks);
    } catch (e: any) {
      setError(e.message || 'Could not reach the server.');
    } finally {
      setLoading(false);
    }
  }, [token, classId]);

  useEffect(() => {
    loadWeeks();
  }, [loadWeeks]);

  if (selectedWeek) {
    return (
      <WeekDetailView
        token={token}
        classId={classId}
        week={selectedWeek}
        onBack={() => setSelectedWeek(null)}
      />
    );
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.indigo} />
      </View>
    );
  }

  if (weeks.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>No attendance recorded yet.</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      <FlatList
        data={weeks}
        keyExtractor={(item) => item.week_start}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <WeekCard week={item} onPress={() => setSelectedWeek(item)} />
        )}
      />
    </View>
  );
}

function WeekCard({ week, onPress }: { week: Week; onPress: () => void }) {
  const scale = React.useRef(new Animated.Value(1)).current;
  const pressIn = () =>
    Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 40, bounciness: 6 }).start();
  const pressOut = () =>
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 8 }).start();

  return (
    <Animated.View style={[{ transform: [{ scale }] }, shadow.card, styles.cardWrap]}>
      <Pressable onPress={onPress} onPressIn={pressIn} onPressOut={pressOut} style={styles.card}>
        <BlurView intensity={25} tint="light" style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.white }]} />

        <View style={styles.weekIcon}>
          <Text style={styles.weekIconText}>W</Text>
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.weekRangeText}>{formatRangeLabel(week.week_start, week.week_end)}</Text>
          <Text style={styles.positionText}>Tap to view days</Text>
        </View>

        <Text style={styles.chevron}>›</Text>
      </Pressable>
    </Animated.View>
  );
}

function WeekDetailView({
  token,
  classId,
  week,
  onBack,
}: {
  token: string;
  classId: string;
  week: Week;
  onBack: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<WeekDetail | null>(null);
  const [error, setError] = useState('');
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  const [dayDetails, setDayDetails] = useState<Record<string, DayDetail>>({});
  const [loadingDay, setLoadingDay] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError('');
      try {
        const res = await fetch(`${API_URL}/api/attendance/week/${week.week_start}?classId=${classId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to load week');
        setDetail(data);
      } catch (e: any) {
        setError(e.message || 'Could not reach the server.');
      } finally {
        setLoading(false);
      }
    })();
  }, [token, classId, week.week_start]);

  const toggleDay = async (date: string, isHoliday: boolean) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    if (expandedDate === date) {
      setExpandedDate(null);
      return;
    }
    setExpandedDate(date);
    if (isHoliday || dayDetails[date]) return;

    setLoadingDay(date);
    try {
      const res = await fetch(`${API_URL}/api/attendance/day/${date}?classId=${classId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setDayDetails((prev) => ({ ...prev, [date]: data }));
      }
    } catch {
      // silent — day just won't expand with detail
    } finally {
      setLoadingDay(null);
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
    <View style={{ flex: 1 }}>
      <Pressable onPress={onBack} style={styles.backRow}>
        <Text style={styles.backArrow}>‹</Text>
        <Text style={styles.backText}>All Weeks</Text>
      </Pressable>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {detail && (
        <>
          <View style={styles.weekTotalsCard}>
            <Text style={styles.weekTotalsTitle}>
              {formatRangeLabel(detail.week_start, detail.week_end)}
            </Text>
            <View style={styles.statsRow}>
              <View style={[styles.statCard, { backgroundColor: colors.leafLight }]}>
                <Text style={[styles.statValue, { color: colors.leaf }]}>{detail.week_totals.total_present}</Text>
                <Text style={styles.statLabel}>Present</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: colors.coralLight }]}>
                <Text style={[styles.statValue, { color: colors.coral }]}>{detail.week_totals.total_absent}</Text>
                <Text style={styles.statLabel}>Absent</Text>
              </View>
            </View>
          </View>

          <FlatList
            data={detail.days}
            keyExtractor={(item) => item.date}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => (
              <DayCard
                day={item}
                expanded={expandedDate === item.date}
                loadingDetail={loadingDay === item.date}
                detail={dayDetails[item.date]}
                onPress={() => toggleDay(item.date, item.is_holiday)}
              />
            )}
          />
        </>
      )}
    </View>
  );
}

function DayCard({
  day,
  expanded,
  loadingDetail,
  detail,
  onPress,
}: {
  day: Day;
  expanded: boolean;
  loadingDetail: boolean;
  detail?: DayDetail;
  onPress: () => void;
}) {
  return (
    <View style={[shadow.card, styles.cardWrap]}>
      <Pressable onPress={onPress} style={styles.card}>
        <BlurView intensity={25} tint="light" style={StyleSheet.absoluteFill} />
        <View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: day.is_holiday ? colors.line : colors.white },
          ]}
        />

        <View style={{ flex: 1 }}>
          <Text style={styles.studentName}>{formatDateLabel(day.date)}</Text>
          {day.is_holiday ? (
            <Text style={styles.positionText}>Holiday</Text>
          ) : (
            <Text style={styles.positionText}>
              {day.total_present ?? 0} present · {day.total_absent ?? 0} absent
            </Text>
          )}
        </View>

        <Text style={styles.chevron}>{expanded ? '⌄' : '›'}</Text>
      </Pressable>

      {expanded && !day.is_holiday && (
        <View style={styles.expandedArea}>
          {loadingDetail ? (
            <ActivityIndicator color={colors.indigo} />
          ) : detail?.summary ? (
            <>
              <View style={styles.liveSummary}>
                <View style={styles.liveSummaryItem}>
                  <Text style={styles.liveSummaryLabel}>Boys</Text>
                  <Text style={styles.liveSummaryValue}>{detail.summary.boys_present}</Text>
                </View>
                <View style={styles.liveSummaryItem}>
                  <Text style={styles.liveSummaryLabel}>Girls</Text>
                  <Text style={styles.liveSummaryValue}>{detail.summary.girls_present}</Text>
                </View>
              </View>
              {detail.summary.absent_students.length > 0 ? (
                <View style={{ marginTop: spacing.sm }}>
                  <Text style={styles.inputLabel}>Absent:</Text>
                  {detail.summary.absent_students.map((name) => (
                    <Text key={name} style={styles.absentName}>• {name}</Text>
                  ))}
                </View>
              ) : (
                <Text style={[styles.positionText, { marginTop: spacing.sm }]}>Everyone was present 🎉</Text>
              )}
            </>
          ) : (
            <Text style={styles.positionText}>No detail available.</Text>
          )}
        </View>
      )}
    </View>
  );
}

// ---------- Rankings ----------

function Rankings({
  token,
  classId,
  onOpenReportCard,
}: {
  token: string;
  classId: string;
  onOpenReportCard: (studentId: string, studentName: string) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [rankings, setRankings] = useState<RankingEntry[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError('');
      try {
        const res = await fetch(`${API_URL}/api/assessment/rankings?classId=${classId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to load rankings');
        setRankings(data.rankings);
      } catch (e: any) {
        setError(e.message || 'Could not reach the server.');
      } finally {
        setLoading(false);
      }
    })();
  }, [token, classId]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.indigo} />
      </View>
    );
  }

  if (rankings.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>No scores entered yet.</Text>
      </View>
    );
  }

  const medal = (position: number) => (position === 1 ? '🥇' : position === 2 ? '🥈' : position === 3 ? '🥉' : null);

  return (
    <View style={{ flex: 1 }}>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      <FlatList
        data={rankings}
        keyExtractor={(item) => item.student_id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const m = medal(item.position);
          const initials = `${item.first_name[0]}${item.last_name[0]}`.toUpperCase();
          return (
            <Pressable
              onPress={() => onOpenReportCard(item.student_id, `${item.first_name} ${item.last_name}`)}
              style={[shadow.card, styles.cardWrap]}
            >
              <View style={styles.card}>
                <BlurView intensity={25} tint="light" style={StyleSheet.absoluteFill} />
                <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.white }]} />

                <View style={styles.positionBadge}>
                  <Text style={styles.positionBadgeText}>{m || item.position}</Text>
                </View>

                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{initials}</Text>
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.studentName}>
                    {item.first_name} {item.last_name}
                  </Text>
                  <Text style={styles.positionText}>{item.subjects_counted} subject(s) scored</Text>
                </View>

                <View style={styles.totalBadge}>
                  <Text style={styles.totalBadgeText}>{item.overall_total}</Text>
                </View>
              </View>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cloud },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.cloud },
  emptyText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.base, color: colors.charcoalMuted },
  errorText: {
    fontFamily: fonts.bodySemiBold,
    color: colors.coral,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  header: { padding: spacing.lg, paddingBottom: spacing.md },
  headerTitle: { fontFamily: fonts.display, fontSize: fontSizes.xxl, color: colors.indigo, marginBottom: spacing.sm },
  toggleRow: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderRadius: radii.pill,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.line,
  },
  toggleButton: { flex: 1, paddingVertical: spacing.sm, borderRadius: radii.pill, alignItems: 'center' },
  toggleButtonActive: { backgroundColor: colors.indigo },
  toggleButtonText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.charcoalMuted },
  toggleButtonTextActive: { color: colors.white },
  backRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
  backArrow: { fontFamily: fonts.bodyBold, fontSize: fontSizes.xl, color: colors.indigo, marginRight: 4 },
  backText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.base, color: colors.indigo },
  weekTotalsCard: { paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  weekTotalsTitle: { fontFamily: fonts.bodyBold, fontSize: fontSizes.lg, color: colors.charcoal, marginBottom: spacing.sm },
  statsRow: { flexDirection: 'row', gap: spacing.sm },
  statCard: { flex: 1, borderRadius: radii.md, padding: spacing.md, alignItems: 'center' },
  statValue: { fontFamily: fonts.display, fontSize: fontSizes.xl },
  statLabel: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.charcoalMuted, marginTop: 2 },
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
  weekIcon: {
    width: 44,
    height: 44,
    borderRadius: radii.pill,
    backgroundColor: colors.marigold,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  weekIconText: { fontFamily: fonts.bodyBold, color: colors.white, fontSize: fontSizes.base },
  weekRangeText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.base, color: colors.charcoal },
  positionText: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.charcoalMuted, marginTop: 2 },
  chevron: { fontFamily: fonts.bodyBold, fontSize: fontSizes.xl, color: colors.charcoalMuted },
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
  positionBadge: {
    width: 32,
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  positionBadgeText: { fontFamily: fonts.bodyBold, fontSize: fontSizes.lg, color: colors.indigo },
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
  liveSummary: {
    flexDirection: 'row',
    backgroundColor: colors.cloud,
    borderRadius: radii.md,
    padding: spacing.sm,
  },
  liveSummaryItem: { flex: 1, alignItems: 'center' },
  liveSummaryLabel: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.charcoalMuted },
  liveSummaryValue: { fontFamily: fonts.bodyBold, fontSize: fontSizes.lg, color: colors.charcoal, marginTop: 2 },
  inputLabel: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.charcoalMuted },
  absentName: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.coral, marginTop: 2 },
});