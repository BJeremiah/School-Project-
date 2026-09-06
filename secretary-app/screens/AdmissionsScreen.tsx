// screens/AdmissionsScreen.tsx
// Full admission form for a new student: personal info, guardian info, admission details,
// and a dynamic list of authorized pickup persons. POSTs to /api/secretary/admissions.

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { colors, fonts, fontSizes, radii, spacing, shadow } from '../theme/theme';
import { API_URL } from '../config/api';

type ClassOption = { id: string; class_name: string };

type PickupPersonDraft = {
  name: string;
  contact: string;
  relationship: string;
  car_registration_no: string;
};

export default function AdmissionsScreen({
  token,
  onBack,
  onAdmitted,
}: {
  token: string;
  onBack: () => void;
  onAdmitted: () => void;
}) {
  // Class picker
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [classesLoading, setClassesLoading] = useState(true);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);

  // Personal
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [gender, setGender] = useState<'M' | 'F'>('M');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [nationality, setNationality] = useState('');
  const [homeTown, setHomeTown] = useState('');
  const [chronicIllnesses, setChronicIllnesses] = useState('');

  // Guardian
  const [guardianName, setGuardianName] = useState('');
  const [guardianOccupation, setGuardianOccupation] = useState('');
  const [guardianPhone, setGuardianPhone] = useState('');
  const [guardianEmployer, setGuardianEmployer] = useState('');
  const [guardianNationality, setGuardianNationality] = useState('');
  const [guardianAddress, setGuardianAddress] = useState('');

  // Admission details
  const [admissionNumber, setAdmissionNumber] = useState('');
  const [dateOfAcceptance, setDateOfAcceptance] = useState('');
  const [dateOfAdmission, setDateOfAdmission] = useState('');
  const [remarks, setRemarks] = useState('');
  const [admissionOfficerName, setAdmissionOfficerName] = useState('');

  // Pickup persons
  const [pickupPersons, setPickupPersons] = useState<PickupPersonDraft[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const loadClasses = useCallback(async () => {
    setClassesLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/secretary/classes`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load classes');
      setClasses(data.classes);
    } catch (e: any) {
      setError(e.message || 'Could not load classes.');
    } finally {
      setClassesLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadClasses();
  }, [loadClasses]);

  const addPickupPerson = () => {
    setPickupPersons((prev) => [...prev, { name: '', contact: '', relationship: '', car_registration_no: '' }]);
  };

  const updatePickupPerson = (index: number, field: keyof PickupPersonDraft, value: string) => {
    setPickupPersons((prev) => prev.map((p, i) => (i === index ? { ...p, [field]: value } : p)));
  };

  const removePickupPerson = (index: number) => {
    setPickupPersons((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!firstName.trim() || !lastName.trim() || !selectedClassId) {
      setError('First name, last name, and class are required.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/secretary/admissions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          gender,
          class_id: selectedClassId,
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
          pickup_persons: pickupPersons
            .filter((p) => p.name.trim())
            .map((p) => ({
              name: p.name.trim(),
              contact: p.contact.trim() || undefined,
              relationship: p.relationship.trim() || undefined,
              car_registration_no: p.car_registration_no.trim() || undefined,
            })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to admit student');
      Alert.alert('Success', 'Student admitted successfully.');
      onAdmitted();
    } catch (e: any) {
      setError(e.message || 'Could not reach the server.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Pressable onPress={onBack} style={styles.backRow}>
        <Text style={styles.backArrow}>‹</Text>
        <Text style={styles.backText}>Back</Text>
      </Pressable>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Admit New Student</Text>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <FormSection title="Class">
          {classesLoading ? (
            <ActivityIndicator color={colors.indigo} />
          ) : (
            <View style={styles.chipRow}>
              {classes.map((c) => (
                <Pressable
                  key={c.id}
                  style={[styles.chip, selectedClassId === c.id && styles.chipActive]}
                  onPress={() => setSelectedClassId(c.id)}
                >
                  <Text style={[styles.chipText, selectedClassId === c.id && styles.chipTextActive]}>
                    {c.class_name}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </FormSection>

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
          <LabeledInput
            label="Date of Acceptance (YYYY-MM-DD)"
            value={dateOfAcceptance}
            onChangeText={setDateOfAcceptance}
          />
          <LabeledInput
            label="Date of Admission (YYYY-MM-DD)"
            value={dateOfAdmission}
            onChangeText={setDateOfAdmission}
          />
          <LabeledInput label="Admission Officer Name" value={admissionOfficerName} onChangeText={setAdmissionOfficerName} />
          <LabeledInput label="Remarks" value={remarks} onChangeText={setRemarks} multiline />
        </FormSection>

        <FormSection title="Authorized Pickup Persons">
          {pickupPersons.map((p, index) => (
            <View key={index} style={styles.pickupCard}>
              <View style={styles.pickupCardHeader}>
                <Text style={styles.pickupCardTitle}>Person {index + 1}</Text>
                <Pressable onPress={() => removePickupPerson(index)}>
                  <Text style={styles.removeText}>Remove</Text>
                </Pressable>
              </View>
              <LabeledInput
                label="Name"
                value={p.name}
                onChangeText={(v) => updatePickupPerson(index, 'name', v)}
              />
              <LabeledInput
                label="Relationship"
                value={p.relationship}
                onChangeText={(v) => updatePickupPerson(index, 'relationship', v)}
              />
              <LabeledInput
                label="Contact"
                value={p.contact}
                onChangeText={(v) => updatePickupPerson(index, 'contact', v)}
                keyboardType="phone-pad"
              />
              <LabeledInput
                label="Car Registration No."
                value={p.car_registration_no}
                onChangeText={(v) => updatePickupPerson(index, 'car_registration_no', v)}
              />
            </View>
          ))}
          <Pressable style={styles.addPickupButton} onPress={addPickupPerson}>
            <Text style={styles.addPickupButtonText}>+ Add Pickup Person</Text>
          </Pressable>
        </FormSection>

        <Pressable style={styles.submitButton} onPress={handleSubmit} disabled={submitting}>
          {submitting ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.submitButtonText}>Admit Student</Text>
          )}
        </Pressable>
      </ScrollView>
    </View>
  );
}

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
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
  scrollContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  title: { fontFamily: fonts.display, fontSize: fontSizes.xxl, color: colors.indigo, marginBottom: spacing.md },
  section: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadow.card,
  },
  sectionTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.base,
    color: colors.indigo,
    marginBottom: spacing.sm,
  },
  inputLabel: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.charcoalMuted, marginBottom: 2 },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.md,
    padding: spacing.sm,
    fontFamily: fonts.body,
    fontSize: fontSizes.base,
    color: colors.charcoal,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm },
  chip: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  chipActive: { backgroundColor: colors.indigo, borderColor: colors.indigo },
  chipText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.charcoal },
  chipTextActive: { color: colors.white },
  pickupCard: {
    backgroundColor: colors.cloud,
    borderRadius: radii.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  pickupCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  pickupCardTitle: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.charcoal },
  removeText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.xs, color: colors.coral },
  addPickupButton: {
    borderWidth: 1,
    borderColor: colors.indigo,
    borderRadius: radii.pill,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  addPickupButtonText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.indigo },
  submitButton: {
    backgroundColor: colors.indigo,
    borderRadius: radii.pill,
    padding: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  submitButtonText: { fontFamily: fonts.bodyBold, color: colors.white, fontSize: fontSizes.base },
});