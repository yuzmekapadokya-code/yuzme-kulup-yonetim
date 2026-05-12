import { useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';

import { changeMyEmail, changeMyPassword, logout } from '../../api/authApi';
import { patchDocument } from '../../api/firestoreClient';
import ActionButton from '../../components/ActionButton';
import ScreenLayout from '../../components/ScreenLayout';
import { roleLabels } from '../../config/appConfig';
import { theme } from '../../config/theme';
import { useAuthStore } from '../../store/authStore';

export default function ProfileScreen() {
  const profile = useAuthStore((state) => state.profile);
  const [name, setName] = useState(profile.name || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newEmail, setNewEmail] = useState(profile.email || '');
  const [newPassword, setNewPassword] = useState('');

  async function saveProfile() {
    await patchDocument('users', profile.uid, { name });
    Alert.alert('Kaydedildi', 'Profil bilgileriniz guncellendi.');
  }

  async function saveEmail() {
    await changeMyEmail({ currentPassword, newEmail });
    await patchDocument('users', profile.uid, { email: newEmail.trim() });
    Alert.alert('Guncellendi', 'E-posta bilginiz degisti.');
  }

  async function savePassword() {
    await changeMyPassword({ currentPassword, newPassword });
    Alert.alert('Guncellendi', 'Sifreniz degisti.');
  }

  async function handleLogout() {
    await logout();
  }

  return (
    <ScreenLayout title="Profil" subtitle="Hesap ve guvenlik ayarlarinizi yonetin.">
      <View style={styles.hero}>
        <Text style={styles.role}>{roleLabels[profile.role]}</Text>
        <Text style={styles.name}>{profile.name}</Text>
        <Text style={styles.email}>{profile.email}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Profil bilgileri</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Ad Soyad" />
        <ActionButton label="Profili Kaydet" onPress={saveProfile} fullWidth />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Guvenlik</Text>
        <TextInput style={styles.input} value={currentPassword} onChangeText={setCurrentPassword} secureTextEntry placeholder="Mevcut sifre" />
        <TextInput style={styles.input} value={newEmail} onChangeText={setNewEmail} autoCapitalize="none" placeholder="Yeni e-posta" />
        <ActionButton label="E-postayi Guncelle" onPress={saveEmail} fullWidth />
        <TextInput style={styles.input} value={newPassword} onChangeText={setNewPassword} secureTextEntry placeholder="Yeni sifre" />
        <ActionButton label="Sifreyi Guncelle" onPress={savePassword} variant="secondary" fullWidth />
      </View>

      <ActionButton label="Cikis Yap" onPress={handleLogout} variant="secondary" fullWidth />
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  hero: {
    backgroundColor: theme.colors.primaryDeep,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    gap: 6,
  },
  role: {
    color: '#9fdcf7',
    fontWeight: '700',
  },
  name: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '800',
  },
  email: {
    color: 'rgba(255,255,255,0.84)',
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.spacing.lg,
    gap: 12,
  },
  cardTitle: {
    color: theme.colors.text,
    fontWeight: '800',
    fontSize: 18,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    color: theme.colors.text,
  },
});