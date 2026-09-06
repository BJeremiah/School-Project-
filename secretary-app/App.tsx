import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import {
  useFonts as useBaloo2Fonts,
  Baloo2_600SemiBold,
  Baloo2_700Bold,
} from '@expo-google-fonts/baloo-2';
import {
  useFonts as useNunitoSansFonts,
  NunitoSans_400Regular,
  NunitoSans_600SemiBold,
  NunitoSans_700Bold,
} from '@expo-google-fonts/nunito-sans';
import { colors, fonts, fontSizes, radii, spacing } from './theme/theme';
import { API_URL } from './config/api';
import ClassListScreen from './screens/ClassListScreen';
import StudentListScreen from './screens/StudentListScreen';
import StudentProfileScreen from './screens/StudentProfileScreen';
import AdmissionsScreen from './screens/AdmissionsScreen';
import NotificationsScreen from './screens/NotificationsScreen';
import SalariesScreen from './screens/SalariesScreen';
import RemovedStaffScreen from './screens/RemovedStaffScreen';
import SearchScreen from './screens/SearchScreen';
import AdmissionsOverviewScreen from './screens/AdmissionsOverviewScreen';


SplashScreen.preventAutoHideAsync();

export type RootStackParamList = {
  ClassList: undefined;
  StudentList: {
    classId: string;
    className: string;
  };
  StudentProfile: {
    studentId: string;
  };
  Admissions: undefined;
  Notifications: undefined;
  Salaries: undefined;
  RemovedStaff: undefined;
  Search: undefined;
  AdmissionsOverview: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();


export default function App() {
  const [baloo2Loaded] = useBaloo2Fonts({ Baloo2_600SemiBold, Baloo2_700Bold });
  const [nunitoSansLoaded] = useNunitoSansFonts({
    NunitoSans_400Regular,
    NunitoSans_600SemiBold,
    NunitoSans_700Bold,
  });
  const fontsLoaded = baloo2Loaded && nunitoSansLoaded;

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  const [token, setToken] = useState<string | null>(null);
  const [userName, setUserName] = useState('');

  const [email, setEmail] = useState('secretary@testschool.com');
  const [password, setPassword] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);

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

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: colors.cloud }} />;
  }

  if (!token) {
    return (
      <View style={styles.centered}>
        <Text style={styles.title}>Secretary Login</Text>
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
        <StatusBar style="auto" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="ClassList">
          {({ navigation }) => (
            <ClassListScreen
              token={token}
              onSelectClass={(classId, className) =>
                navigation.navigate('StudentList', { classId, className })
              }
              onAddStudent={() => navigation.navigate('Admissions')}
              onViewNotifications={() => navigation.navigate('Notifications')}
              onViewSalaries={() => navigation.navigate('Salaries')}
              onSearch={() => navigation.navigate('Search')}
              onViewAdmissions={() => navigation.navigate('AdmissionsOverview')}
            />
          )}
        </Stack.Screen>
        <Stack.Screen name="StudentList">
          {({ navigation, route }) => (
            <StudentListScreen
              token={token}
              classId={route.params.classId}
              className={route.params.className}
              onBack={() => navigation.goBack()}
              onSelectStudent={(studentId) => navigation.navigate('StudentProfile', { studentId })}
            />
          )}
        </Stack.Screen>
        <Stack.Screen name="StudentProfile">
          {({ navigation, route }) => (
            <StudentProfileScreen
              token={token}
              studentId={route.params.studentId}
              onBack={() => navigation.goBack()}
            />
          )}
        </Stack.Screen>
        <Stack.Screen name="Admissions">
          {({ navigation }) => (
            <AdmissionsScreen
              token={token}
              onBack={() =>
                 navigation.goBack()}
              onAdmitted={() => navigation.goBack()}
            />
          )}
        </Stack.Screen>
        <Stack.Screen name="Notifications">
          {({ navigation }) => (
            <NotificationsScreen token={token} onBack={() => navigation.goBack()} />
          )}
        </Stack.Screen>
        <Stack.Screen name="Salaries">
          {({ navigation }) => (
            <SalariesScreen
              token={token}
              onBack={() => navigation.goBack()}
              onViewRemovedStaff={() => navigation.navigate('RemovedStaff')}
            />
          )}
        </Stack.Screen>
        <Stack.Screen name="RemovedStaff">
          {({ navigation }) => (
            <RemovedStaffScreen token={token} onBack={() => navigation.goBack()} />
          )}
        </Stack.Screen>
        <Stack.Screen name="Search">
          {({ navigation }) => (
            <SearchScreen
              token={token}
              onBack={() => navigation.goBack()}
              onSelectStudent={(studentId) => navigation.navigate('StudentProfile', { studentId })}
            />
          )}
        </Stack.Screen>
        <Stack.Screen name="AdmissionsOverview">
          {({ navigation }) => (
            <AdmissionsOverviewScreen
              token={token}
              onBack={() => navigation.goBack()}
              onSelectStudent={(studentId) => navigation.navigate('StudentProfile', { studentId })}
            />
          )}
        </Stack.Screen>
      </Stack.Navigator>
      <StatusBar style="auto" />
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
    backgroundColor: colors.cloud,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: fontSizes.xxl,
    color: colors.indigo,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
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
});