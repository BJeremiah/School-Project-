// screens/secretary/NotificationsScreen.tsx
// Absence notification feed — most recent first. Tap one to mark it as read.
// Each notification with a guardian phone number shows a Call button; calling
// marks the notification as "called" (shared status, visible to Director too).

import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, ActivityIndicator, Linking, Alert } from 'react-native';
import { BlurView } from 'expo-blur';
import { colors, fonts, fontSizes, radii, spacing, shadow } from '../../theme/theme';
import { API_URL } from '../../config/api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Notification = {
  id: string;
  attendance_date: string;
  is_read: boolean;
  called: boolean;
  created_at: string;
  first_name: string;
  last_name: string;
  guardian_name: string | null;
  guardian_phone: string | null;
  class_name: string;
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function NotificationsScreen({ token, onBack }: { token: string; onBack: () => void }) {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [error, setError] = useState('');
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [callingId, setCallingId] = useState<string | null>(null);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/secretary/notifications`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load notifications');
      setNotifications(data.notifications);
    } catch (e: any) {
      setError(e.message || 'Could not reach the server.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const markAsRead = async (id: string) => {
    setMarkingId(id);
    try {
      const res = await fetch(`${API_URL}/api/secretary/notifications/${id}/read`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update notification');
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    } catch (e: any) {
      setError(e.message || 'Could not mark as read.');
    } finally {
      setMarkingId(null);
    }
  };

  const markAsCalled = async (id: string) => {
    try {
      const res = await fetch(`${API_URL}/api/secretary/notifications/${id}/called`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ called: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update notification');
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, called: true } : n)));
    } catch (e: any) {
      setError(e.message || 'Could not mark as called.');
    }
  };

  const callGuardian = async (notification: Notification) => {
    if (!notification.guardian_phone) {
      Alert.alert('No phone number', 'No guardian phone number is on file for this student.');
      return;
    }
    setCallingId(notification.id);
    try {
      const url = `tel:${notification.guardian_phone}`;
      const canOpen = await Linking.canOpenURL(url);
      if (!canOpen) {
        Alert.alert('Cannot place call', 'This device cannot make phone calls.');
        return;
      }
      await Linking.openURL(url);
      await markAsCalled(notification.id);
    } catch (e) {
      Alert.alert('Error', 'Could not start the call.');
    } finally {
      setCallingId(null);
    }
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <View style={styles.container}>
      <Pressable onPress={onBack} style={[styles.backRow, { paddingTop: insets.top + spacing.sm }]}>
        <Text style={styles.backArrow}>‹</Text>
        <Text style={styles.backText}>Back</Text>
      </Pressable>

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Notifications</Text>
        <Text style={styles.headerSubtitle}>
          {unreadCount} unread · {notifications.length} total
        </Text>
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.indigo} />
        </View>
      ) : notifications.length === 0 && !error ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>No absence notifications yet.</Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <NotificationCard
              notification={item}
              marking={markingId === item.id}
              calling={callingId === item.id}
              onPress={() => !item.is_read && markAsRead(item.id)}
              onCall={() => callGuardian(item)}
            />
          )}
        />
      )}
    </View>
  );
}

function NotificationCard({
  notification,
  marking,
  calling,
  onPress,
  onCall,
}: {
  notification: Notification;
  marking: boolean;
  calling: boolean;
  onPress: () => void;
  onCall: () => void;
}) {
  return (
    <View style={[shadow.card, styles.cardWrap]}>
      <Pressable onPress={onPress} disabled={marking || notification.is_read} style={styles.card}>
        <BlurView intensity={25} tint="light" style={StyleSheet.absoluteFill} />
        <View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: notification.is_read ? colors.white : colors.coralLight },
          ]}
        />

        <View style={styles.unreadDot}>
          {!notification.is_read && <View style={styles.dot} />}
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.studentName}>
            {notification.first_name} {notification.last_name}
            <Text style={styles.classTag}> · {notification.class_name}</Text>
          </Text>
          <Text style={styles.dateText}>Absent {formatDate(notification.attendance_date)}</Text>
          {notification.guardian_name ? (
            <Text style={styles.guardianText}>
              Guardian: {notification.guardian_name}
              {notification.guardian_phone ? ` · ${notification.guardian_phone}` : ''}
            </Text>
          ) : null}

          <View style={[styles.calledBadge, { backgroundColor: notification.called ? colors.leafLight : colors.coralLight }]}>
            <Text style={[styles.calledBadgeText, { color: notification.called ? colors.leaf : colors.coral }]}>
              {notification.called ? 'Called' : 'Not called yet'}
            </Text>
          </View>
        </View>

        {marking ? <ActivityIndicator color={colors.charcoalMuted} /> : null}
      </Pressable>

      {notification.guardian_phone ? (
        <Pressable style={styles.callButton} onPress={onCall} disabled={calling}>
          {calling ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.callButtonText}>📞 Call {notification.guardian_name || 'Guardian'}</Text>
          )}
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cloud },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.base, color: colors.charcoalMuted },
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
  headerTitle: { fontFamily: fonts.display, fontSize: fontSizes.xxl, color: colors.indigo },
  headerSubtitle: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.charcoalMuted, marginTop: 2 },
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
  unreadDot: { width: 20, alignItems: 'center', marginRight: spacing.sm },
  dot: { width: 10, height: 10, borderRadius: radii.pill, backgroundColor: colors.coral },
  studentName: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.base, color: colors.charcoal },
  classTag: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.charcoalMuted },
  dateText: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.charcoalMuted, marginTop: 2 },
  guardianText: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.charcoalMuted, marginTop: 2 },
  calledBadge: {
    alignSelf: 'flex-start',
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    marginTop: spacing.xs,
  },
  calledBadgeText: { fontFamily: fonts.bodyBold, fontSize: fontSizes.xs },
  callButton: {
    backgroundColor: colors.indigo,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  callButtonText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.white },
});