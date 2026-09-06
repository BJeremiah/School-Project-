// screens/ClassListScreen.tsx
// Lists every class with student counts (total, boys, girls). Tap a class to view its students.
// Header has a "⋮" menu button that drops down to Search, Admissions List, Notifications,
// Salaries, and Admit Student — instead of five separate buttons crowding the header.

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Animated,
  Modal,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { colors, fonts, fontSizes, radii, spacing, shadow } from '../theme/theme';
import { API_URL } from '../config/api';

type ClassOverview = {
  id: string;
  class_name: string;
  total_students: string; // Postgres COUNT() returns as string in JSON
  male_count: string;
  female_count: string;
};

export default function ClassListScreen({
  token,
  onSelectClass,
  onAddStudent,
  onViewNotifications,
  onViewSalaries,
  onSearch,
  onViewAdmissions,
}: {
  token: string;
  onSelectClass: (classId: string, className: string) => void;
  onAddStudent: () => void;
  onViewNotifications: () => void;
  onViewSalaries: () => void;
  onSearch: () => void;
  onViewAdmissions: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState<ClassOverview[]>([]);
  const [error, setError] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const [menuVisible, setMenuVisible] = useState(false);

  const loadClasses = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/secretary/classes`, {
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

  const loadUnreadCount = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/secretary/notifications`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setUnreadCount(data.notifications.filter((n: any) => !n.is_read).length);
      }
    } catch {
      // silent — badge just won't show a count if this fails
    }
  }, [token]);

  useEffect(() => {
    loadClasses();
  }, [loadClasses]);

  useEffect(() => {
    loadUnreadCount();
  }, [loadUnreadCount]);

  const menuAction = (action: () => void) => {
    setMenuVisible(false);
    action();
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
        <View style={styles.titleRow}>
          <View>
            <Text style={styles.headerTitle}>Classes</Text>
            <Text style={styles.headerSubtitle}>{classes.length} classes</Text>
          </View>
          <Pressable style={styles.menuButton} onPress={() => setMenuVisible(true)}>
            <Text style={styles.menuButtonText}>⋮</Text>
            {unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
              </View>
            )}
          </Pressable>
        </View>
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {classes.length === 0 && !error ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>No classes found.</Text>
        </View>
      ) : (
        <FlatList
          data={classes}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <ClassCard classItem={item} onPress={() => onSelectClass(item.id, item.class_name)} />
          )}
        />
      )}

      <Modal visible={menuVisible} transparent animationType="fade" onRequestClose={() => setMenuVisible(false)}>
        <Pressable style={styles.menuOverlay} onPress={() => setMenuVisible(false)}>
          <View style={styles.menuCard}>
            <MenuItem label="Search" onPress={() => menuAction(onSearch)} />
            <MenuItem label="Admissions List" onPress={() => menuAction(onViewAdmissions)} />
            <MenuItem
              label="Notifications"
              badge={unreadCount > 0 ? unreadCount : undefined}
              onPress={() => menuAction(onViewNotifications)}
            />
            <MenuItem label="Salaries" onPress={() => menuAction(onViewSalaries)} />
            <MenuItem label="+ Admit Student" onPress={() => menuAction(onAddStudent)} isLast />
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

function MenuItem({
  label,
  onPress,
  badge,
  isLast,
}: {
  label: string;
  onPress: () => void;
  badge?: number;
  isLast?: boolean;
}) {
  return (
    <Pressable style={[styles.menuItem, !isLast && styles.menuItemBorder]} onPress={onPress}>
      <Text style={styles.menuItemText}>{label}</Text>
      {badge ? (
        <View style={styles.menuItemBadge}>
          <Text style={styles.menuItemBadgeText}>{badge > 99 ? '99+' : badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

function ClassCard({ classItem, onPress }: { classItem: ClassOverview; onPress: () => void }) {
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

        <View style={styles.classIcon}>
          <Text style={styles.classIconText}>{classItem.class_name.charAt(0).toUpperCase()}</Text>
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.className}>{classItem.class_name}</Text>
          <Text style={styles.classSubtext}>
            {classItem.total_students} students · {classItem.male_count} boys · {classItem.female_count} girls
          </Text>
        </View>

        <Text style={styles.chevron}>›</Text>
      </Pressable>
    </Animated.View>
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
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  menuButton: {
    width: 44,
    height: 44,
    borderRadius: radii.pill,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  menuButtonText: { fontFamily: fonts.bodyBold, fontSize: fontSizes.xl, color: colors.indigo },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: colors.coral,
    borderRadius: radii.pill,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.white,
  },
  badgeText: { fontFamily: fonts.bodyBold, fontSize: 10, color: colors.white },
  headerTitle: { fontFamily: fonts.display, fontSize: fontSizes.xxl, color: colors.indigo },
  headerSubtitle: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.charcoalMuted,
    marginTop: 2,
  },
  menuOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', paddingTop: 90, paddingRight: spacing.lg, alignItems: 'flex-end' },
  menuCard: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    width: 220,
    overflow: 'hidden',
    ...shadow.glass,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  menuItemBorder: { borderBottomWidth: 1, borderBottomColor: colors.line },
  menuItemText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.base, color: colors.charcoal },
  menuItemBadge: {
    backgroundColor: colors.coral,
    borderRadius: radii.pill,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuItemBadgeText: { fontFamily: fonts.bodyBold, fontSize: 11, color: colors.white },
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
  classIcon: {
    width: 44,
    height: 44,
    borderRadius: radii.pill,
    backgroundColor: colors.indigo,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  classIconText: { fontFamily: fonts.bodyBold, color: colors.white, fontSize: fontSizes.base },
  className: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.base, color: colors.charcoal },
  classSubtext: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.charcoalMuted, marginTop: 2 },
  chevron: { fontFamily: fonts.bodyBold, fontSize: fontSizes.xl, color: colors.charcoalMuted },
});