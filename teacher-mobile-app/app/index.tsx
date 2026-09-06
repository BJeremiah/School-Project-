import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import AttendanceScreen from './attendance';
import SubjectsScreen from './subjects';
import ScoresScreen from './scores';
import RecordsScreen from './records';
import { API_URL } from '../config/api';
import { colors, fonts, fontSizes, radii, spacing } from '../theme/theme';

type Tab = 'attendance' | 'assessment' | 'records';
type Subject = { id: string; name: string };

export default function App() {
  const [token, setToken] = useState<string | null>(null);
  const [userName, setUserName] = useState('');

  // Login form state
  const [email, setEmail] = useState('teacher@testschool.com');
  const [password, setPassword] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);

  // Navigation state
  const [activeTab, setActiveTab] = useState<Tab>('attendance');
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);

  async function handleLogin() {
    if (!email || !password) {
      Alert.alert('Missing info', 'Please enter both email and password.');
      return;
    }
    setLoggingIn(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        Alert.alert('Login failed', data.error || 'Unknown error');
        return;
      }
      setToken(data.token);
      setUserName(data.user.name);
    } catch (err) {
      Alert.alert(
        'Connection error',
        'Could not reach the server. Check the API_URL and that your phone is on the same Wi-Fi as your computer.'
      );
    } finally {
      setLoggingIn(false);
    }
  }

  // --- LOGIN SCREEN ---
  if (!token) {
    return (
      <View style={styles.centered}>
        <Text style={styles.title}>Teacher Login</Text>
        <TextInput
          style={styles.input}
          placeholder="Email"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
        <Pressable style={styles.loginButton} onPress={handleLogin} disabled={loggingIn}>
          {loggingIn ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.loginButtonText}>Log In</Text>
          )}
        </Pressable>
      </View>
    );
  }

  // --- MAIN APP (logged in) ---
  return (
    <View style={{ flex: 1, backgroundColor: colors.cloud }}>
      <View style={{ flex: 1 }}>
        {activeTab === 'attendance' && <AttendanceScreen token={token} />}

        {activeTab === 'assessment' && !selectedSubject && (
          <SubjectsScreen token={token} onSelectSubject={setSelectedSubject} />
        )}

        {activeTab === 'assessment' && selectedSubject && (
          <ScoresScreen
            token={token}
            subjectId={selectedSubject.id}
            subjectName={selectedSubject.name}
            onBack={() => setSelectedSubject(null)}
          />
        )}

        {activeTab === 'records' && <RecordsScreen token={token} />}
      </View>

      <View style={styles.tabBar}>
        <TabButton
          label="Attendance"
          active={activeTab === 'attendance'}
          onPress={() => setActiveTab('attendance')}
        />
        <TabButton
          label="Assessment"
          active={activeTab === 'assessment'}
          onPress={() => {
            setActiveTab('assessment');
            setSelectedSubject(null);
          }}
        />
        <TabButton
          label="Records"
          active={activeTab === 'records'}
          onPress={() => setActiveTab('records')}
        />
      </View>
    </View>
  );
}

function TabButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable style={styles.tabButton} onPress={onPress}>
      <View style={[styles.tabDot, active && styles.tabDotActive]} />
      <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.lg, backgroundColor: colors.cloud },
  title: { fontFamily: fonts.display, fontSize: fontSizes.xxl, color: colors.indigo, marginBottom: spacing.sm },
  input: {
    width: '100%',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    fontFamily: fonts.body,
    fontSize: fontSizes.base,
    color: colors.charcoal,
  },
  loginButton: {
    width: '100%',
    backgroundColor: colors.indigo,
    borderRadius: radii.pill,
    padding: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  loginButtonText: { fontFamily: fonts.bodyBold, color: colors.white, fontSize: fontSizes.base },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
  },
  tabButton: { flex: 1, alignItems: 'center' },
  tabDot: {
    width: 8,
    height: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.line,
    marginBottom: spacing.xs,
  },
  tabDotActive: { backgroundColor: colors.marigold },
  tabLabel: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.charcoalMuted },
  tabLabelActive: { color: colors.indigo },
});