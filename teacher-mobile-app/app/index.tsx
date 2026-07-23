import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';

// IMPORTANT: replace with YOUR computer's IPv4 address (from ipconfig)
const API_URL = 'http://192.168.163.5:4000';

export default function App() {
  const [token, setToken] = useState(null);
  const [userName, setUserName] = useState('');

  // Login form state
  const [email, setEmail] = useState('teacher@testschool.com');
  const [password, setPassword] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);

  // Daily report form state
  const [presentCount, setPresentCount] = useState('');
  const [absentCount, setAbsentCount] = useState('');
  const [tuition, setTuition] = useState('');
  const [canteen, setCanteen] = useState('');
  const [bus, setBus] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const cashTotal =
    (parseFloat(tuition) || 0) + (parseFloat(canteen) || 0) + (parseFloat(bus) || 0);

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
      Alert.alert('Connection error', 'Could not reach the server. Check the API_URL and that your phone is on the same Wi-Fi as your computer.');
    } finally {
      setLoggingIn(false);
    }
  }

  async function handleSubmitReport() {
    if (!presentCount || !absentCount) {
      Alert.alert('Missing info', 'Please enter both present and absent counts.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/api/reports/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          present_count: parseInt(presentCount, 10),
          absent_count: parseInt(absentCount, 10),
          tuition_arrears: parseFloat(tuition) || 0,
          canteen_fees: parseFloat(canteen) || 0,
          bus_fares: parseFloat(bus) || 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        Alert.alert('Submission failed', data.error || 'Unknown error');
        return;
      }
      setSubmitted(true);
      Alert.alert('Success', 'Report submitted for today!');
    } catch (err) {
      Alert.alert('Connection error', 'Could not reach the server.');
    } finally {
      setSubmitting(false);
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
        <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loggingIn}>
          {loggingIn ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Log In</Text>}
        </TouchableOpacity>
      </View>
    );
  }

  // --- DAILY REPORT FORM SCREEN ---
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Welcome, {userName}</Text>
      <Text style={styles.subtitle}>Today's Report</Text>

      <Text style={styles.label}>Attendance</Text>
      <TextInput
        style={styles.input}
        placeholder="Present Count"
        keyboardType="numeric"
        value={presentCount}
        onChangeText={setPresentCount}
        editable={!submitted}
      />
      <TextInput
        style={styles.input}
        placeholder="Absent Count"
        keyboardType="numeric"
        value={absentCount}
        onChangeText={setAbsentCount}
        editable={!submitted}
      />

      <Text style={styles.label}>Cash Received Today (GHS)</Text>
      <TextInput
        style={styles.input}
        placeholder="Tuition / Arrears"
        keyboardType="numeric"
        value={tuition}
        onChangeText={setTuition}
        editable={!submitted}
      />
      <TextInput
        style={styles.input}
        placeholder="Canteen / Feeding"
        keyboardType="numeric"
        value={canteen}
        onChangeText={setCanteen}
        editable={!submitted}
      />
      <TextInput
        style={styles.input}
        placeholder="Bus / Transport"
        keyboardType="numeric"
        value={bus}
        onChangeText={setBus}
        editable={!submitted}
      />

      <Text style={styles.totalText}>Total: GHS {cashTotal.toFixed(2)}</Text>

      <TouchableOpacity
        style={[styles.button, submitted && styles.buttonDisabled]}
        onPress={handleSubmitReport}
        disabled={submitting || submitted}
      >
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>{submitted ? 'Submitted for Today' : 'Submit'}</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#f5f5f5' },
  container: { flexGrow: 1, padding: 24, paddingTop: 60, backgroundColor: '#f5f5f5' },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 8, color: '#1a1a1a' },
  subtitle: { fontSize: 16, color: '#666', marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '600', marginTop: 16, marginBottom: 8, color: '#333' },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    fontSize: 16,
  },
  totalText: { fontSize: 18, fontWeight: '700', marginTop: 12, marginBottom: 20, color: '#2a7a2a' },
  button: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: { backgroundColor: '#999' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
