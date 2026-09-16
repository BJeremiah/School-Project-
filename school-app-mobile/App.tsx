import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
  Dimensions,
  Animated,
} from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
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
import AsyncStorage from '@react-native-async-storage/async-storage';

import AttendanceScreen from './screens/teacher/AttendanceScreen';
import SubjectsScreen from './screens/teacher/SubjectsScreen';
import ScoresScreen from './screens/teacher/ScoresScreen';
import RecordsScreen from './screens/teacher/RecordsScreen';
import ReportCardScreen from './screens/teacher/ReportCardScreen';
import ProfileScreen from './screens/shared/ProfileScreen';
import ClassListScreen from './screens/secretary/ClassListScreen';
import StudentListScreen from './screens/secretary/StudentListScreen';
import StudentProfileScreen from './screens/secretary/StudentProfileScreen';
import AdmissionsScreen from './screens/secretary/AdmissionsScreen';
import AdmissionsOverviewScreen from './screens/secretary/AdmissionsOverviewScreen';
import NotificationsScreen from './screens/secretary/NotificationsScreen';
import SalariesScreen from './screens/secretary/SalariesScreen';
import RemovedStaffScreen from './screens/secretary/RemovedStaffScreen';
import SearchScreen from './screens/secretary/SearchScreen';
import AccountantClassListScreen from './screens/accountant/AccountantClassListScreen';
import ClassFeeStatusScreen from './screens/accountant/ClassFeeStatusScreen';
import StudentFeeProfileScreen from './screens/accountant/StudentFeeProfileScreen';
import FeeSectionsScreen from './screens/accountant/FeeSectionsScreen';
import AccountantRecordsScreen from './screens/accountant/RecordsScreen';
import OverviewScreen from './screens/director/OverviewScreen';
import DirectorClassListScreen from './screens/director/DirectorClassListScreen';
import DirectorClassDetailScreen from './screens/director/DirectorClassDetailScreen';
import AssignTeachersScreen from './screens/director/AssignTeachersScreen';
import DirectorSearchScreen from './screens/director/DirectorSearchScreen';
import StudentMasterProfileScreen from './screens/director/StudentMasterProfileScreen';
import DirectorNotificationsScreen from './screens/director/DirectorNotificationsScreen';
import StaffAccountsScreen from './screens/director/StaffAccountsScreen';
import DirectorRecordsScreen from './screens/director/DirectorRecordsScreen';
import StatisticsScreen from './screens/director/StatisticsScreen';
import SchoolSettingsScreen from './screens/director/SchoolSettingsScreen';
import PasswordInput from './components/PasswordInput';

SplashScreen.preventAutoHideAsync();

// Global 401 handling: any authenticated request that comes back Unauthorized
// (expired/invalid token, or the account no longer exists) triggers an automatic
// logout back to the login screen, instead of leaving the user stuck on a broken
// screen. Patched once here so every screen's plain `fetch(...)` calls are covered
// without having to thread a special fetch helper through the whole app.
const originalFetch = globalThis.fetch.bind(globalThis);
let unauthorizedHandler: (() => void) | null = null;
let hasShownExpiryAlert = false;

function requestHasAuthHeader(headers: HeadersInit | undefined): boolean {
  if (!headers) return false;
  if (headers instanceof Headers) return headers.has('Authorization');
  if (Array.isArray(headers)) return headers.some(([key]) => key.toLowerCase() === 'authorization');
  return Object.keys(headers).some((key) => key.toLowerCase() === 'authorization');
}

globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const response = await originalFetch(input, init);
  if (response.status === 401 && requestHasAuthHeader(init?.headers) && unauthorizedHandler) {
    if (!hasShownExpiryAlert) {
      hasShownExpiryAlert = true;
      Alert.alert('Session Expired', 'Please log in again.');
    }
    unauthorizedHandler();
  }
  return response;
}) as typeof fetch;

type Role = 'teacher' | 'secretary' | 'accountant' | 'director';

const ROLE_LABELS: Record<Role, string> = {
  teacher: 'Teacher',
  secretary: 'Secretary',
  accountant: 'Accountant',
  director: 'Director',
};

export type SecretaryStackParamList = {
  ClassList: undefined;
  StudentList: { classId: string; className: string };
  StudentProfile: { studentId: string };
  Admissions: undefined;
  AdmissionsOverview: undefined;
  Notifications: undefined;
  Salaries: undefined;
  RemovedStaff: undefined;
  Search: undefined;
  Profile: undefined;
};

const SecretaryStack = createNativeStackNavigator<SecretaryStackParamList>();
type TeacherTab = 'attendance' | 'assessment' | 'records' | 'profile';
type Subject = { id: string; name: string };
const TEACHER_TABS: TeacherTab[] = ['attendance', 'assessment', 'records', 'profile'];


function TeacherHome({
  token,
  onLogout,
  classId,
  className,
}: {
  token: string;
  onLogout: () => void;
  classId: string;
  className: string;
}) {
  const insets = useSafeAreaInsets();
  const windowWidth = Dimensions.get('window').width;
  const [activeTab, setActiveTab] = useState<TeacherTab>('attendance');
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [reportCardStudent, setReportCardStudent] = useState<{ id: string; name: string } | null>(null);

  const scrollRef = React.useRef<ScrollView>(null);
  const scrollX = React.useRef(new Animated.Value(0)).current;
  const [barWidth, setBarWidth] = useState(windowWidth);

  if (reportCardStudent) {
    return (
      <ReportCardScreen
        token={token}
        classId={classId}
        studentId={reportCardStudent.id}
        studentName={reportCardStudent.name}
        onBack={() => setReportCardStudent(null)}
      />
    );
  }

  const goToTab = (tab: TeacherTab) => {
    const index = TEACHER_TABS.indexOf(tab);
    scrollRef.current?.scrollTo({ x: index * windowWidth, animated: true });
    setActiveTab(tab);
  };

  const handleMomentumScrollEnd = (e: any) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / windowWidth);
    setActiveTab(TEACHER_TABS[index]);
  };

  const indicatorTranslate = scrollX.interpolate({
    inputRange: [0, windowWidth, windowWidth * 2, windowWidth * 3],
    outputRange: [0, barWidth / 4, (barWidth / 4) * 2, (barWidth / 4) * 3],
    extrapolate: 'clamp',
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.cloud }}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
          useNativeDriver: false,
        })}
        scrollEventThrottle={16}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        style={{ flex: 1 }}
      >
        <View style={{ width: windowWidth, flex: 1 }}>
          <AttendanceScreen token={token} classId={classId} />
        </View>
        <View style={{ width: windowWidth, flex: 1 }}>
          {!selectedSubject ? (
            <SubjectsScreen token={token} classId={classId} onSelectSubject={setSelectedSubject} />
          ) : (
            <ScoresScreen
              token={token}
              classId={classId}
              subjectId={selectedSubject.id}
              subjectName={selectedSubject.name}
              onBack={() => setSelectedSubject(null)}
            />
          )}
        </View>
        <View style={{ width: windowWidth, flex: 1 }}>
          <RecordsScreen
            token={token}
            classId={classId}
            onOpenReportCard={(studentId, studentName) => setReportCardStudent({ id: studentId, name: studentName })}
          />
        </View>
        <View style={{ width: windowWidth, flex: 1 }}>
          <ProfileScreen token={token} onLogout={onLogout} />
        </View>
      </ScrollView>
      <View style={[teacherStyles.tabBarOuter, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
        <View style={teacherStyles.tabBar} onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}>
          <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill} />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,255,255,0.55)' }]} />

          <Animated.View
            style={[
              teacherStyles.tabIndicator,
              { width: barWidth / 4 - spacing.xs * 2, transform: [{ translateX: indicatorTranslate }] },
            ]}
          />
          <TeacherTabButton
            icon="people-outline"
            activeIcon="people"
            label="Attendance"
            active={activeTab === 'attendance'}
            onPress={() => goToTab('attendance')}
          />
          <TeacherTabButton
            icon="bar-chart-outline"
            activeIcon="bar-chart"
            label="Assessment"
            active={activeTab === 'assessment'}
            onPress={() => goToTab('assessment')}
          />
          <TeacherTabButton
            icon="time-outline"
            activeIcon="time"
            label="Records"
            active={activeTab === 'records'}
            onPress={() => goToTab('records')}
          />
          <TeacherTabButton
            icon="person-circle-outline"
            activeIcon="person-circle"
            label="Profile"
            active={activeTab === 'profile'}
            onPress={() => goToTab('profile')}
          />
        </View>
      </View>
    </View>
  );
}
function TeacherTabButton({
  icon,
  activeIcon,
  label,
  active,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  activeIcon: keyof typeof Ionicons.glyphMap;
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={teacherStyles.tabButton} onPress={onPress} accessibilityLabel={label}>
      <Ionicons
        name={active ? activeIcon : icon}
        size={24}
        color={active ? colors.white : colors.charcoalMuted}
      />
    </Pressable>
  );
}
const teacherStyles = StyleSheet.create({
  tabBarOuter: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    backgroundColor: colors.cloud,
  },
  tabBar: {
    flexDirection: 'row',
    borderRadius: radii.pill,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.glassBorder,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.xs,
    position: 'relative',
  },
  tabIndicator: {
    position: 'absolute',
    top: spacing.xs,
    bottom: spacing.xs,
    left: spacing.xs,
    borderRadius: radii.pill,
    backgroundColor: colors.indigo,
  },
  tabButton: { flex: 1, alignItems: 'center', paddingVertical: spacing.sm, zIndex: 1 },
});
function SecretaryNavigator({ token, onLogout }: { token: string; onLogout: () => void }) {
  return (
    <NavigationContainer>
      <SecretaryStack.Navigator screenOptions={{ headerShown: false }}>
        <SecretaryStack.Screen name="ClassList">
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
              onViewProfile={() => navigation.navigate('Profile')}
            />
          )}
        </SecretaryStack.Screen>
        <SecretaryStack.Screen name="Profile">
          {({ navigation }) => (
            <ProfileScreen token={token} onLogout={onLogout} onBack={() => navigation.goBack()} />
          )}
        </SecretaryStack.Screen>
        <SecretaryStack.Screen name="StudentList">
          {({ navigation, route }) => (
            <StudentListScreen
              token={token}
              classId={route.params.classId}
              className={route.params.className}
              onBack={() => navigation.goBack()}
              onSelectStudent={(studentId) => navigation.navigate('StudentProfile', { studentId })}
            />
          )}
        </SecretaryStack.Screen>
        <SecretaryStack.Screen name="StudentProfile">
          {({ navigation, route }) => (
            <StudentProfileScreen
              token={token}
              studentId={route.params.studentId}
              onBack={() => navigation.goBack()}
            />
          )}
        </SecretaryStack.Screen>
        <SecretaryStack.Screen name="Admissions">
          {({ navigation }) => (
            <AdmissionsScreen
              token={token}
              onBack={() => navigation.goBack()}
              onAdmitted={() => navigation.goBack()}
            />
          )}
        </SecretaryStack.Screen>
        <SecretaryStack.Screen name="AdmissionsOverview">
          {({ navigation }) => (
            <AdmissionsOverviewScreen
              token={token}
              onBack={() => navigation.goBack()}
              onSelectStudent={(studentId) => navigation.navigate('StudentProfile', { studentId })}
            />
          )}
        </SecretaryStack.Screen>
        <SecretaryStack.Screen name="Notifications">
          {({ navigation }) => (
            <NotificationsScreen token={token} onBack={() => navigation.goBack()} />
          )}
        </SecretaryStack.Screen>
        <SecretaryStack.Screen name="Salaries">
          {({ navigation }) => (
            <SalariesScreen
              token={token}
              onBack={() => navigation.goBack()}
              onViewRemovedStaff={() => navigation.navigate('RemovedStaff')}
            />
          )}
        </SecretaryStack.Screen>
        <SecretaryStack.Screen name="RemovedStaff">
          {({ navigation }) => (
            <RemovedStaffScreen token={token} onBack={() => navigation.goBack()} />
          )}
        </SecretaryStack.Screen>
        <SecretaryStack.Screen name="Search">
          {({ navigation }) => (
            <SearchScreen
              token={token}
              onBack={() => navigation.goBack()}
              onSelectStudent={(studentId) => navigation.navigate('StudentProfile', { studentId })}
            />
          )}
        </SecretaryStack.Screen>
      </SecretaryStack.Navigator>
    </NavigationContainer>
  );
}

export type AccountantStackParamList = {
  AccountantClassList: undefined;
  ClassFeeStatus: { classId: string; className: string };
  StudentFeeProfile: { studentId: string };
  FeeSections: undefined;
  AccountantRecords: undefined;
  Profile: undefined;
};

const AccountantStack = createNativeStackNavigator<AccountantStackParamList>();

function AccountantNavigator({ token, onLogout }: { token: string; onLogout: () => void }) {
  return (
    <NavigationContainer>
      <AccountantStack.Navigator screenOptions={{ headerShown: false }}>
        <AccountantStack.Screen name="AccountantClassList">
          {({ navigation }) => (
            <AccountantClassListScreen
              token={token}
              onSelectClass={(classId, className) =>
                navigation.navigate('ClassFeeStatus', { classId, className })
              }
              onViewFeeSections={() => navigation.navigate('FeeSections')}
              onViewRecords={() => navigation.navigate('AccountantRecords')}
              onViewProfile={() => navigation.navigate('Profile')}
            />
          )}
        </AccountantStack.Screen>
        <AccountantStack.Screen name="Profile">
          {({ navigation }) => (
            <ProfileScreen token={token} onLogout={onLogout} onBack={() => navigation.goBack()} />
          )}
        </AccountantStack.Screen>
        <AccountantStack.Screen name="ClassFeeStatus">
          {({ navigation, route }) => (
            <ClassFeeStatusScreen
              token={token}
              classId={route.params.classId}
              className={route.params.className}
              onBack={() => navigation.goBack()}
              onSelectStudent={(studentId) => navigation.navigate('StudentFeeProfile', { studentId })}
            />
          )}
        </AccountantStack.Screen>
        <AccountantStack.Screen name="StudentFeeProfile">
          {({ navigation, route }) => (
            <StudentFeeProfileScreen
              token={token}
              studentId={route.params.studentId}
              onBack={() => navigation.goBack()}
            />
          )}
        </AccountantStack.Screen>
        <AccountantStack.Screen name="FeeSections">
          {({ navigation }) => (
            <FeeSectionsScreen token={token} onBack={() => navigation.goBack()} />
          )}
        </AccountantStack.Screen>
        <AccountantStack.Screen name="AccountantRecords">
          {({ navigation }) => (
            <AccountantRecordsScreen token={token} onBack={() => navigation.goBack()} />
          )}
        </AccountantStack.Screen>
      </AccountantStack.Navigator>
    </NavigationContainer>
  );
}

export type DirectorStackParamList = {
  Overview: undefined;
  DirectorClassList: undefined;
  DirectorClassDetail: { classId: string; className: string };
  AssignTeachers: undefined;
  DirectorSearch: undefined;
  StudentMasterProfile: { studentId: string };
  DirectorNotifications: undefined;
  StaffAccounts: undefined;
  DirectorRecords: undefined;
  Statistics: undefined;
  Profile: undefined;
  SchoolSettings: undefined;
};

const DirectorStack = createNativeStackNavigator<DirectorStackParamList>();

function DirectorNavigator({ token, onLogout }: { token: string; onLogout: () => void }) {
  return (
    <NavigationContainer>
      <DirectorStack.Navigator screenOptions={{ headerShown: false }}>
        <DirectorStack.Screen name="Overview">
          {({ navigation }) => (
            <OverviewScreen
              token={token}
              onViewClasses={() => navigation.navigate('DirectorClassList')}
              onSearchStudents={() => navigation.navigate('DirectorSearch')}
              onViewNotifications={() => navigation.navigate('DirectorNotifications')}
              onViewStaff={() => navigation.navigate('StaffAccounts')}
              onViewRecords={() => navigation.navigate('DirectorRecords')}
              onViewStatistics={() => navigation.navigate('Statistics')}
              onAssignTeachers={() => navigation.navigate('AssignTeachers')}
              onViewProfile={() => navigation.navigate('Profile')}
              onViewSchoolSettings={() => navigation.navigate('SchoolSettings')}
            />
          )}
        </DirectorStack.Screen>
        <DirectorStack.Screen name="Profile">
          {({ navigation }) => (
            <ProfileScreen token={token} onLogout={onLogout} onBack={() => navigation.goBack()} />
          )}
        </DirectorStack.Screen>
        <DirectorStack.Screen name="SchoolSettings">
          {({ navigation }) => (
            <SchoolSettingsScreen token={token} onBack={() => navigation.goBack()} />
          )}
        </DirectorStack.Screen>
        <DirectorStack.Screen name="DirectorClassList">
          {({ navigation }) => (
            <DirectorClassListScreen
              token={token}
              onBack={() => navigation.goBack()}
              onSelectClass={(classId, className) =>
                navigation.navigate('DirectorClassDetail', { classId, className })
              }
            />
          )}
        </DirectorStack.Screen>
        <DirectorStack.Screen name="AssignTeachers">
          {({ navigation }) => (
            <AssignTeachersScreen token={token} onBack={() => navigation.goBack()} />
          )}
        </DirectorStack.Screen>
        <DirectorStack.Screen name="DirectorClassDetail">
          {({ navigation, route }) => (
            <DirectorClassDetailScreen
              token={token}
              classId={route.params.classId}
              className={route.params.className}
              onBack={() => navigation.goBack()}
              onSelectStudent={(studentId) => navigation.navigate('StudentMasterProfile', { studentId })}
            />
          )}
        </DirectorStack.Screen>
        <DirectorStack.Screen name="DirectorSearch">
          {({ navigation }) => (
            <DirectorSearchScreen
              token={token}
              onBack={() => navigation.goBack()}
              onSelectStudent={(studentId) => navigation.navigate('StudentMasterProfile', { studentId })}
            />
          )}
        </DirectorStack.Screen>
        <DirectorStack.Screen name="StudentMasterProfile">
          {({ navigation, route }) => (
            <StudentMasterProfileScreen
              token={token}
              studentId={route.params.studentId}
              onBack={() => navigation.goBack()}
            />
          )}
        </DirectorStack.Screen>
        <DirectorStack.Screen name="DirectorNotifications">
          {({ navigation }) => (
            <DirectorNotificationsScreen token={token} onBack={() => navigation.goBack()} />
          )}
        </DirectorStack.Screen>
        <DirectorStack.Screen name="StaffAccounts">
          {({ navigation }) => (
            <StaffAccountsScreen token={token} onBack={() => navigation.goBack()} />
          )}
        </DirectorStack.Screen>
        <DirectorStack.Screen name="DirectorRecords">
          {({ navigation }) => (
            <DirectorRecordsScreen token={token} onBack={() => navigation.goBack()} />
          )}
        </DirectorStack.Screen>
        <DirectorStack.Screen name="Statistics">
          {({ navigation }) => (
            <StatisticsScreen token={token} onBack={() => navigation.goBack()} />
          )}
        </DirectorStack.Screen>
      </DirectorStack.Navigator>
    </NavigationContainer>
  );
}

function AppContent() {
  const [baloo2Loaded] = useBaloo2Fonts({ Baloo2_600SemiBold, Baloo2_700Bold });
  const [nunitoSansLoaded] = useNunitoSansFonts({
    NunitoSans_400Regular,
    NunitoSans_600SemiBold,
    NunitoSans_700Bold,
  });
  const fontsLoaded = baloo2Loaded && nunitoSansLoaded;
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [selectedClassName, setSelectedClassName] = useState<string | null>(null);
  const [classList, setClassList] = useState<{ id: string; class_name: string }[]>([]);
  const [classesLoading, setClassesLoading] = useState(false);
  const [loggedInClass, setLoggedInClass] = useState<{ id: string; name: string } | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string>('');
  const [userName, setUserName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);
  const [restoringSession, setRestoringSession] = useState(true);
  const [schoolName, setSchoolName] = useState('School');
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [showTeacherClassPicker, setShowTeacherClassPicker] = useState(false);
  const [classError, setClassError] = useState('');
  const [resetPassword, setResetPassword] = useState('');
  const [confirmResetPassword, setConfirmResetPassword] = useState('');
  const [resettingPassword, setResettingPassword] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/api/auth/school-name`)
      .then((res) => res.json())
      .then((data) => {
        if (data.school_name) setSchoolName(data.school_name);
      })
      .catch(() => {
        // silent — keep the default fallback name if this fails
      });
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem('auth');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.token && parsed.role) {
            setToken(parsed.token);
            setUserRole(parsed.role);
            setUserName(parsed.name || '');
            setSelectedRole(parsed.role as Role);
            setMustChangePassword(Boolean(parsed.mustChangePassword));
            if (parsed.classId && parsed.className) {
              setLoggedInClass({ id: parsed.classId, name: parsed.className });
              setSelectedClassId(parsed.classId);
              setSelectedClassName(parsed.className);
            }
          }
        }
      } catch (e) {
        // ignore -- just fall through to normal login
      } finally {
        setRestoringSession(false);
      }
    })();
  }, []);

  const loadTeacherClasses = useCallback(async () => {
    setClassesLoading(true);
    setClassError('');
    try {
      const res = await fetch(`${API_URL}/api/auth/classes`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load classes');
      setClassList(data.classes || []);
    } catch (err) {
      setClassList([]);
      setClassError('Could not load classes.');
    } finally {
      setClassesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedRole !== 'teacher' || token) return;
    loadTeacherClasses();
  }, [selectedRole, token, loadTeacherClasses]);

  useEffect(() => {
    if (fontsLoaded && !restoringSession) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, restoringSession]);

  async function handleLogin() {
    if (!email || !password) {
      Alert.alert('Missing info', 'Please enter both email and password.');
      return;
    }
    if (selectedRole === 'teacher' && !selectedClassId) {
      Alert.alert('Missing info', 'Please select your class first.');
      return;
    }
    setLoggingIn(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          classId: selectedRole === 'teacher' ? selectedClassId : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        Alert.alert('Login failed', data.error || 'Unknown error');
        return;
      }
      if (data.user.role !== selectedRole) {
        Alert.alert(
          'Wrong role',
          `This account is a ${data.user.role}, not a ${selectedRole}. Please go back and pick the correct role.`
        );
        return;
      }
      setToken(data.token);
      setUserRole(data.user.role);
      setUserName(data.user.name);
      setMustChangePassword(Boolean(data.must_change_password));
      setLoggedInClass(data.class ? { id: data.class.id, name: data.class.name } : null);
      if (data.class) {
        setSelectedClassId(data.class.id);
        setSelectedClassName(data.class.name);
      }
      try {
        await AsyncStorage.setItem(
          'auth',
          JSON.stringify({
            token: data.token,
            role: data.user.role,
            name: data.user.name,
            classId: data.class ? data.class.id : undefined,
            className: data.class ? data.class.name : undefined,
            mustChangePassword: Boolean(data.must_change_password),
          })
        );
      } catch (e) {
        // non-fatal — session just won't persist this time
      }
    } catch (err) {
      Alert.alert(
        'Connection error',
        'Could not reach the server. Check the API_URL and that your phone is on the same Wi-Fi as your computer.'
      );
    } finally {
      setLoggingIn(false);
    }
  }

  async function handleForcedPasswordChange() {
    if (!resetPassword || !confirmResetPassword) {
      Alert.alert('Missing info', 'Please enter and confirm a new password.');
      return;
    }
    if (resetPassword.length < 6) {
      Alert.alert('Password too short', 'New password must be at least 6 characters.');
      return;
    }
    if (resetPassword !== confirmResetPassword) {
      Alert.alert('Password mismatch', 'The new password and confirm password do not match.');
      return;
    }

    setResettingPassword(true);
    try {
      const res = await fetch(`${API_URL}/api/profile/password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ newPassword: resetPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update password');

      setMustChangePassword(false);
      setResetPassword('');
      setConfirmResetPassword('');
      try {
        const saved = await AsyncStorage.getItem('auth');
        if (saved) {
          const parsed = JSON.parse(saved);
          await AsyncStorage.setItem(
            'auth',
            JSON.stringify({
              ...parsed,
              mustChangePassword: false,
            })
          );
        }
      } catch (e) {
        // non-fatal
      }
    } catch (err: any) {
      Alert.alert('Could not save password', err.message || 'Please try again.');
    } finally {
      setResettingPassword(false);
    }
  }

  const performLogout = useCallback(() => {
    setToken(null);
    setUserRole('');
    setUserName('');
    setEmail('');
    setPassword('');
    setSelectedRole(null);
    setSelectedClassId(null);
    setSelectedClassName('');
    setLoggedInClass(null);
    setMustChangePassword(false);
    setShowTeacherClassPicker(false);
    setResetPassword('');
    setConfirmResetPassword('');
    AsyncStorage.removeItem('auth').catch(() => {});
    hasShownExpiryAlert = false;
  }, []);

  useEffect(() => {
    unauthorizedHandler = performLogout;
    return () => {
      if (unauthorizedHandler === performLogout) unauthorizedHandler = null;
    };
  }, [performLogout]);

  if (!fontsLoaded || restoringSession) {
    return <View style={{ flex: 1, backgroundColor: colors.cloud }} />;
  }

  if (mustChangePassword && token) {
    return (
      <View style={[styles.centered, { justifyContent: 'center' }]}>
        <Text style={styles.title}>Set a New Password</Text>
        <Text style={styles.subtitle}>This account requires a password change before continuing.</Text>

        <PasswordInput
          style={styles.input}
          placeholder="New Password"
          placeholderTextColor={colors.charcoalMuted}
          value={resetPassword}
          onChangeText={setResetPassword}
        />
        <PasswordInput
          style={styles.input}
          placeholder="Confirm New Password"
          placeholderTextColor={colors.charcoalMuted}
          value={confirmResetPassword}
          onChangeText={setConfirmResetPassword}
        />

        <Pressable style={styles.loginButton} onPress={handleForcedPasswordChange} disabled={resettingPassword}>
          {resettingPassword ? <ActivityIndicator color={colors.white} /> : <Text style={styles.loginButtonText}>Continue</Text>}
        </Pressable>
        <StatusBar style="auto" />
      </View>
    );
  }

  // --- ROLE PICKER ---
  if (!selectedRole) {
    return (
      <View style={styles.centered}>
        <Text style={styles.title}>{schoolName}</Text>
        <Text style={styles.subtitle}>Who are you signing in as?</Text>
        {(Object.keys(ROLE_LABELS) as Role[]).map((role) => (
          <Pressable key={role} style={styles.roleButton} onPress={() => setSelectedRole(role)}>
            <Text style={styles.roleButtonText}>{ROLE_LABELS[role]}</Text>
          </Pressable>
        ))}
        <StatusBar style="auto" />
      </View>
    );
  }

  // --- LOGIN SCREEN ---
  if (!token) {
    return (
      <View style={[styles.centered, { justifyContent: 'flex-start', alignItems: 'stretch' }]}> 
        <Pressable
          onPress={() => {
            setSelectedRole(null);
            setSelectedClassId(null);
            setSelectedClassName(null);
            setShowTeacherClassPicker(false);
            setClassError('');
          }}
          style={styles.backRow}
        >
          <Text style={styles.backArrow}>‹</Text>
          <Text style={styles.backText}>Change role</Text>
        </Pressable>

        <Text style={styles.title}>{ROLE_LABELS[selectedRole]} Login</Text>

        {selectedRole === 'teacher' ? (
          <>
            <Pressable
              style={styles.inputBox}
              onPress={() => {
                if (classError) {
                  loadTeacherClasses();
                  return;
                }
                setShowTeacherClassPicker((prev) => !prev);
              }}
            >
              <Text style={[styles.inputLabel, !selectedClassName && styles.inputPlaceholder]}>
                {selectedClassName || 'Class'}
              </Text>
            </Pressable>

            {classError ? (
              <View style={styles.inlineErrorWrap}>
                <Text style={styles.inlineErrorText}>{classError}</Text>
                <Pressable onPress={loadTeacherClasses}>
                  <Text style={styles.retryText}>Retry</Text>
                </Pressable>
              </View>
            ) : null}

            {showTeacherClassPicker ? (
              <View style={styles.pickerBox}>
                {classesLoading ? (
                  <ActivityIndicator color={colors.indigo} />
                ) : classList.length === 0 ? (
                  <Text style={styles.subtitle}>No classes are available yet.</Text>
                ) : (
                  <ScrollView style={{ maxHeight: 220 }} showsVerticalScrollIndicator={false}>
                    {classList.map((c) => (
                      <Pressable
                        key={c.id}
                        style={[
                          styles.optionButton,
                          selectedClassId === c.id && styles.optionButtonSelected,
                        ]}
                        onPress={() => {
                          setSelectedClassId(c.id);
                          setSelectedClassName(c.class_name);
                          setShowTeacherClassPicker(false);
                        }}
                      >
                        <Text style={[styles.optionButtonText, selectedClassId === c.id && styles.optionButtonTextSelected]}>
                          {c.class_name}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                )}
              </View>
            ) : null}
          </>
        ) : null}

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor={colors.charcoalMuted}
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <PasswordInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor={colors.charcoalMuted}
          value={password}
          onChangeText={setPassword}
        />
        <Pressable style={styles.loginButton} onPress={handleLogin} disabled={loggingIn}>
          {loggingIn ? <ActivityIndicator color={colors.white} /> : <Text style={styles.loginButtonText}>Log In</Text>}
        </Pressable>
        <StatusBar style="auto" />
      </View>
    );
  }
  // --- LOGGED IN: route to the right navigator by role ---
  const handleLogout = performLogout;
  if (userRole === 'secretary') {
    return <SecretaryNavigator token={token} onLogout={handleLogout} />;
  }
  if (userRole === 'teacher') {
    return (
      <TeacherHome
        token={token}
        onLogout={handleLogout}
        classId={loggedInClass?.id || selectedClassId || ''}
        className={loggedInClass?.name || selectedClassName || 'Your Class'}
      />
    );
  }
  if (userRole === 'accountant') {
    return <AccountantNavigator token={token} onLogout={handleLogout} />;
  }
  if (userRole === 'director') {
    return <DirectorNavigator token={token} onLogout={handleLogout} />;
  }

  return (
    <View style={styles.centered}>
      <Text style={styles.title}>Welcome, {userName}</Text>
      <Text style={{ fontFamily: fonts.body, color: colors.charcoalMuted, marginTop: spacing.sm }}>
        Signed in as {ROLE_LABELS[userRole as Role]}. Screens for this role coming next.
      </Text>
      <StatusBar style="auto" />
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppContent />
    </SafeAreaProvider>
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
  subtitle: {
    fontFamily: fonts.body,
    fontSize: fontSizes.base,
    color: colors.charcoalMuted,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  roleButton: {
    width: '100%',
    backgroundColor: colors.indigo,
    borderRadius: radii.pill,
    padding: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  roleButtonText: { fontFamily: fonts.bodyBold, color: colors.white, fontSize: fontSizes.base },
  backRow: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', marginBottom: spacing.md },
  backArrow: { fontFamily: fonts.bodyBold, fontSize: fontSizes.xl, color: colors.indigo, marginRight: 4 },
  backText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.base, color: colors.indigo },
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
  inputBox: {
    width: '100%',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    justifyContent: 'center',
    minHeight: 52,
  },
  inputLabel: {
    fontFamily: fonts.body,
    fontSize: fontSizes.base,
    color: colors.charcoal,
  },
  inputPlaceholder: {
    color: colors.charcoalMuted,
  },
  pickerBox: {
    width: '100%',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    maxHeight: 220,
  },
  inlineErrorWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  inlineErrorText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSizes.sm,
    color: colors.coral,
    flex: 1,
  },
  retryText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.sm,
    color: colors.indigo,
  },
  optionButton: {
    width: '100%',
    backgroundColor: colors.cloud,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.line,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.xs,
  },
  optionButtonSelected: {
    backgroundColor: colors.indigo,
    borderColor: colors.indigo,
  },
  optionButtonText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSizes.base,
    color: colors.charcoal,
  },
  optionButtonTextSelected: {
    color: colors.white,
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
