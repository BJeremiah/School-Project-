// screens/StudentProfileScreen.tsx
// Full profile for one student — admission details, guardian info, authorized pickup persons.
// Tap the avatar to pick/replace a photo. "Edit" button opens a form to update other details.

import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, TextInput, Pressable, StyleSheet, ActivityIndicator, Alert, Modal, Image } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, fontSizes, radii, spacing, shadow } from '../../theme/theme';
import { API_URL } from '../../config/api';

type StudentProfile = {
  id: string;
  first_name: string;
  last_name: string;
  gender: 'M' | 'F';
  status: string;
  class_name: string;
  admission_number: string | null;
  date_of_birth: string | null;
  nationality: string | null;
  home_town: string | null;
  chronic_illnesses: string | null;
  guardian_name: string | null;
  guardian_occupation: string | null;
  guardian_phone: string | null;
  guardian_employer: string | null;
  guardian_nationality: string | null;
  guardian_address: string | null;
  date_of_acceptance: string | null;
  date_of_admission: string | null;
  remarks: string | null;
  admission_officer_name: string | null;
  photo_url: string | null;
};

type PickupPerson = {
  name: string;
  contact: string | null;
  relationship: string | null;
  car_registration_no: string | null;
};

function formatDate(dateStr: string | null) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function StudentProfileScreen({
  token,
  studentId,
  onBack,
}: {
  token: string;
  studentId: string;
  onBack: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [student, setStudent] = useState<StudentProfile | null>(null);
  const [pickupPersons, setPickupPersons] = useState<PickupPerson[]>([]);
  const [error, setError] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const [editModalVisible, setEditModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState('');

  // Edit form fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [gender, setGender] = useState<'M' | 'F'>('M');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [nationality, setNationality] = useState('');
  const [homeTown, setHomeTown] = useState('');
  const [chronicIllnesses, setChronicIllnesses] = useState('');
  const [guardianName, setGuardianName] = useState('');
  const [guardianOccupation, setGuardianOccupation] = useState('');
  const [guardianPhone, setGuardianPhone] = useState('');
  const [guardianEmployer, setGuardianEmployer] = useState('');
  const [guardianNationality, setGuardianNationality] = useState('');
  const [guardianAddress, setGuardianAddress] = useState('');
  const [admissionNumber, setAdmissionNumber] = useState('');
  const [dateOfAcceptance, setDateOfAcceptance] = useState('');
  const [dateOfAdmission, setDateOfAdmission] = useState('');
  const [remarks, setRemarks] = useState('');
  const [admissionOfficerName, setAdmissionOfficerName] = useState('');

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/secretary/students/${studentId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load student profile');
      setStudent(data.student);
      setPickupPersons(data.pickup_persons || []);
    } catch (e: any) {
      setError(e.message || 'Could not reach the server.');
    } finally {
      setLoading(false);
    }
  }, [token, studentId]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const pickAndUploadPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Please allow photo library access to set a student photo.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (result.canceled || !result.assets || result.assets.length === 0) return;

    const asset = result.assets[0];
    const filename = asset.uri.split('/').pop() || 'photo.jpg';
    const match = /\.(\w+)$/.exec(filename);
    const ext = match ? match[1] : 'jpg';

    const formData = new FormData();
    formData.append('photo', {
      uri: asset.uri,
      name: filename,
      type: `image/${ext}`,
    } as any);

    setUploadingPhoto(true);
    try {
      const res = await fetch(`${API_URL}/api/secretary/students/${studentId}/photo`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to upload photo');
      await loadProfile();
    } catch (e: any) {
      Alert.alert('Upload failed', e.message || 'Could not reach the server.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const openEditModal = () => {
    if (!student) return;
    setFirstName(student.first_name);
    setLastName(student.last_name);
    setGender(student.gender);
    setDateOfBirth(student.date_of_birth ? student.date_of_birth.slice(0, 10) : '');
    setNationality(student.nationality || '');
    setHomeTown(student.home_town || '');
    setChronicIllnesses(student.chronic_illnesses || '');
    setGuardianName(student.guardian_name || '');
    setGuardianOccupation(student.guardian_occupation || '');
    setGuardianPhone(student.guardian_phone || '');
    setGuardianEmployer(student.guardian_employer || '');
    setGuardianNationality(student.guardian_nationality || '');
    setGuardianAddress(student.guardian_address || '');
    setAdmissionNumber(student.admission_number || '');
    setDateOfAcceptance(student.date_of_acceptance ? student.date_of_acceptance.slice(0, 10) : '');
    setDateOfAdmission(student.date_of_admission ? student.date_of_admission.slice(0, 10) : '');
    setRemarks(student.remarks || '');
    setAdmissionOfficerName(student.admission_officer_name || '');
    setEditError('');
    setEditModalVisible(true);
  };

  const submitEdit = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      setEditError('First name and last name are required.');
      return;
    }
    setSaving(true);
    setEditError('');
    try {
      const res = await fetch(`${API_URL}/api/secretary/students/${studentId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          gender,
          date_of_birth: dateOfBirth.trim() || undefined,
          nationality: nationality.trim() || undefined,
          home_town: homeTown.trim() || undefined,
          chronic_illnesses: chronicIllnesses.trim() || undefined,
          guardian_name: guardianName.trim() || undefined,
          guardian_occupation: guardianOccupation.trim() || undefined,
          guardian_phone: guardianPhone.trim() || undefined,
          guardian_employer: guardianEmployer.trim() || undefined,
          guardian_nationality: guardianNationality.trim() || undefined,
          guardian_address: guardianAddress.trim() || undefined,
          date_of_acceptance: dateOfAcceptance.trim() || undefined,
          date_of_admission: dateOfAdmission.trim() || undefined,
          remarks: remarks.trim() || undefined,
          admission_officer_name: admissionOfficerName.trim() || undefined,
          admission_number: admissionNumber.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update student');
      setEditModalVisible(false);
      await loadProfile();
    } catch (e: any) {
      setEditError(e.message || 'Could not reach the server.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.topRow, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={onBack} style={styles.backRow}>
          <Text style={styles.backArrow}>‹</Text>
          <Text style={styles.backText}>Back</Text>
        </Pressable>
        {student && (
          <Pressable style={styles.editButton} onPress={openEditModal}>
            <Text style={styles.editButtonText}>Edit</Text>
          </Pressable>
        )}
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.indigo} />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : student ? (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Pressable onPress={pickAndUploadPhoto} style={styles.avatarWrap}>
            {uploadingPhoto ? (
              <View style={styles.avatar}>
                <ActivityIndicator color={colors.white} />
              </View>
            ) : student.photo_url ? (
              <Image source={{ uri: `${API_URL}${student.photo_url}` }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {student.first_name[0]}
                  {student.last_name[0]}
                </Text>
              </View>
            )}
            <View style={styles.avatarEditBadge}>
              <Text style={styles.avatarEditBadgeText}>✎</Text>
            </View>
          </Pressable>
          <Text style={styles.name}>
            {student.first_name} {student.last_name}
          </Text>
          <Text style={styles.classLabel}>{student.class_name}</Text>

          <InfoSection title="Admission">
            <InfoRow label="Admission Number" value={student.admission_number} />
            <InfoRow label="Status" value={student.status} />
            <InfoRow label="Date of Acceptance" value={formatDate(student.date_of_acceptance)} />
            <InfoRow label="Date of Admission" value={formatDate(student.date_of_admission)} />
            <InfoRow label="Admission Officer" value={student.admission_officer_name} />
          </InfoSection>

          <InfoSection title="Personal">
            <InfoRow label="Gender" value={student.gender === 'M' ? 'Male' : 'Female'} />
            <InfoRow label="Date of Birth" value={formatDate(student.date_of_birth)} />
            <InfoRow label="Nationality" value={student.nationality} />
            <InfoRow label="Home Town" value={student.home_town} />
            <InfoRow label="Chronic Illnesses" value={student.chronic_illnesses} />
          </InfoSection>

          <InfoSection title="Guardian">
            <InfoRow label="Name" value={student.guardian_name} />
            <InfoRow label="Occupation" value={student.guardian_occupation} />
            <InfoRow label="Phone" value={student.guardian_phone} />
            <InfoRow label="Employer" value={student.guardian_employer} />
            <InfoRow label="Nationality" value={student.guardian_nationality} />
            <InfoRow label="Address" value={student.guardian_address} />
          </InfoSection>

          {student.remarks ? (
            <InfoSection title="Remarks">
              <Text style={styles.remarksText}>{student.remarks}</Text>
            </InfoSection>
          ) : null}

          <InfoSection title={`Authorized Pickup Persons (${pickupPersons.length})`}>
            {pickupPersons.length === 0 ? (
              <Text style={styles.emptyText}>None on file.</Text>
            ) : (
              pickupPersons.map((p, idx) => (
                <View key={idx} style={styles.pickupCard}>
                  <Text style={styles.pickupName}>{p.name}</Text>
                  {p.relationship ? <Text style={styles.pickupDetail}>Relationship: {p.relationship}</Text> : null}
                  {p.contact ? <Text style={styles.pickupDetail}>Contact: {p.contact}</Text> : null}
                  {p.car_registration_no ? (
                    <Text style={styles.pickupDetail}>Car Reg: {p.car_registration_no}</Text>
                  ) : null}
                </View>
              ))
            )}
          </InfoSection>
        </ScrollView>
      ) : null}

      <Modal visible={editModalVisible} transparent animationType="slide" onRequestClose={() => setEditModalVisible(false)}>
        <View style={styles.editModalOverlay}>
          <View style={styles.editModalCard}>
            <Text style={styles.editModalTitle}>Edit Student</Text>
            <ScrollView contentContainerStyle={{ paddingBottom: spacing.lg }}>
              {editError ? <Text style={styles.errorText}>{editError}</Text> : null}

              <FormSection title="Personal">
                <LabeledInput label="First Name *" value={firstName} onChangeText={setFirstName} />
                <LabeledInput label="Last Name *" value={lastName} onChangeText={setLastName} />
                <View style={styles.chipRow}>
                  <Pressable style={[styles.chip, gender === 'M' && styles.chipActive]} onPress={() => setGender('M')}>
                    <Text style={[styles.chipText, gender === 'M' && styles.chipTextActive]}>Male</Text>
                  </Pressable>
                  <Pressable style={[styles.chip, gender === 'F' && styles.chipActive]} onPress={() => setGender('F')}>
                    <Text style={[styles.chipText, gender === 'F' && styles.chipTextActive]}>Female</Text>
                  </Pressable>
                </View>
                <LabeledInput label="Date of Birth (YYYY-MM-DD)" value={dateOfBirth} onChangeText={setDateOfBirth} />
                <LabeledInput label="Nationality" value={nationality} onChangeText={setNationality} />
                <LabeledInput label="Home Town" value={homeTown} onChangeText={setHomeTown} />
                <LabeledInput label="Chronic Illnesses" value={chronicIllnesses} onChangeText={setChronicIllnesses} />
              </FormSection>

              <FormSection title="Guardian">
                <LabeledInput label="Guardian Name" value={guardianName} onChangeText={setGuardianName} />
                <LabeledInput label="Occupation" value={guardianOccupation} onChangeText={setGuardianOccupation} />
                <LabeledInput label="Phone" value={guardianPhone} onChangeText={setGuardianPhone} keyboardType="phone-pad" />
                <LabeledInput label="Employer" value={guardianEmployer} onChangeText={setGuardianEmployer} />
                <LabeledInput label="Nationality" value={guardianNationality} onChangeText={setGuardianNationality} />
                <LabeledInput label="Address" value={guardianAddress} onChangeText={setGuardianAddress} />
              </FormSection>

              <FormSection title="Admission Details">
                <LabeledInput label="Admission Number" value={admissionNumber} onChangeText={setAdmissionNumber} />
                <LabeledInput label="Date of Acceptance (YYYY-MM-DD)" value={dateOfAcceptance} onChangeText={setDateOfAcceptance} />
                <LabeledInput label="Date of Admission (YYYY-MM-DD)" value={dateOfAdmission} onChangeText={setDateOfAdmission} />
                <LabeledInput label="Admission Officer Name" value={admissionOfficerName} onChangeText={setAdmissionOfficerName} />
                <LabeledInput label="Remarks" value={remarks} onChangeText={setRemarks} multiline />
              </FormSection>

              <View style={styles.modalButtonRow}>
                <Pressable style={styles.modalCancelButton} onPress={() => setEditModalVisible(false)}>
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </Pressable>
                <Pressable style={styles.modalSaveButton} onPress={submitEdit} disabled={saving}>
                  {saving ? <ActivityIndicator color={colors.white} /> : <Text style={styles.modalSaveText}>Save Changes</Text>}
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function InfoSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string | null }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value || '—'}</Text>
    </View>
  );
}

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.formSection}>
      <Text style={styles.formSectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function LabeledInput({
  label,
  value,
  onChangeText,
  keyboardType,
  multiline,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  keyboardType?: 'default' | 'phone-pad';
  multiline?: boolean;
}) {
  return (
    <View style={{ marginBottom: spacing.sm }}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && { height: 80, textAlignVertical: 'top' }]}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType || 'default'}
        multiline={multiline}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cloud },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.charcoalMuted },
  errorText: { fontFamily: fonts.bodySemiBold, color: colors.coral, textAlign: 'center', marginBottom: spacing.sm },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  backRow: { flexDirection: 'row', alignItems: 'center' },
  backArrow: { fontFamily: fonts.bodyBold, fontSize: fontSizes.xl, color: colors.indigo, marginRight: 4 },
  backText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.base, color: colors.indigo },
  editButton: {
    backgroundColor: colors.indigo,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  editButtonText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.white },
  scrollContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, alignItems: 'center' },
  avatarWrap: { marginTop: spacing.sm, position: 'relative' },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: radii.pill,
    backgroundColor: colors.indigo,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: 72,
    height: 72,
    borderRadius: radii.pill,
    backgroundColor: colors.line,
  },
  avatarText: { fontFamily: fonts.bodyBold, color: colors.white, fontSize: fontSizes.xl },
  avatarEditBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 24,
    height: 24,
    borderRadius: radii.pill,
    backgroundColor: colors.marigold,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.cloud,
  },
  avatarEditBadgeText: { fontSize: 12, color: colors.white },
  name: { fontFamily: fonts.display, fontSize: fontSizes.xl, color: colors.charcoal, marginTop: spacing.sm },
  classLabel: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.charcoalMuted, marginBottom: spacing.md },
  section: {
    width: '100%',
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadow.card,
  },
  sectionTitle: { fontFamily: fonts.bodyBold, fontSize: fontSizes.base, color: colors.indigo, marginBottom: spacing.sm },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  infoLabel: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.charcoalMuted, flex: 1 },
  infoValue: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.charcoal, flex: 1, textAlign: 'right' },
  remarksText: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.charcoal },
  pickupCard: { backgroundColor: colors.cloud, borderRadius: radii.md, padding: spacing.sm, marginBottom: spacing.sm },
  pickupName: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.charcoal },
  pickupDetail: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.charcoalMuted, marginTop: 2 },
  editModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  editModalCard: {
    backgroundColor: colors.cloud,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    padding: spacing.lg,
    maxHeight: '90%',
  },
  editModalTitle: { fontFamily: fonts.display, fontSize: fontSizes.xl, color: colors.indigo, marginBottom: spacing.md },
  formSection: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  formSectionTitle: { fontFamily: fonts.bodyBold, fontSize: fontSizes.base, color: colors.indigo, marginBottom: spacing.sm },
  inputLabel: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.charcoalMuted, marginBottom: 2 },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.md,
    padding: spacing.sm,
    fontFamily: fonts.body,
    fontSize: fontSizes.base,
    color: colors.charcoal,
    backgroundColor: colors.white,
  },
  chipRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  chip: { borderWidth: 1, borderColor: colors.line, borderRadius: radii.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  chipActive: { backgroundColor: colors.indigo, borderColor: colors.indigo },
  chipText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.charcoal },
  chipTextActive: { color: colors.white },
  modalButtonRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  modalCancelButton: { flex: 1, borderRadius: radii.pill, paddingVertical: spacing.md, alignItems: 'center', backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line },
  modalCancelText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.base, color: colors.charcoalMuted },
  modalSaveButton: { flex: 1, borderRadius: radii.pill, paddingVertical: spacing.md, alignItems: 'center', backgroundColor: colors.indigo },
  modalSaveText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.base, color: colors.white },
});