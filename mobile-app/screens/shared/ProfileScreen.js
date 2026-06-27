import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';

import { changeMyEmail, changeMyPassword, logout } from '../../api/authApi';
import { patchDocument } from '../../api/firestoreClient';
import ActionButton from '../../components/ActionButton';
import HeroBanner from '../../components/HeroBanner';
import PanelCard from '../../components/PanelCard';
import ScreenLayout from '../../components/ScreenLayout';
import SectionHeader from '../../components/SectionHeader';
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

  const avatarLabel = (profile?.name || profile?.email || '').slice(0, 1).toUpperCase();

  return (
    <ScreenLayout
      eyebrow="HESABIM"
      title="Profil"
      subtitle="Hesap ve guvenlik ayarlarinizi yonetin."
    >
      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarLabel}>{avatarLabel || '?'}</Text>
        </View>
        <View style={styles.profileBody}>
          <Text style={styles.role}>{roleLabels[profile.role]}</Text>
          <Text style={styles.name}>{profile.name}</Text>
          <Text style={styles.email}>{profile.email}</Text>
        </View>
      </View>

      <SectionHeader title="Profil bilgileri" caption="Ad soyad gibi temel bilgileri guncelle." />
      <PanelCard>
        <Text style={styles.fieldLabel}>Ad soyad</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Ad Soyad" placeholderTextColor="#94a3b8" />
        <ActionButton label="Profili kaydet" onPress={saveProfile} fullWidth />
      </PanelCard>

      <SectionHeader title="Guvenlik" caption="E-posta ve sifre degisikligi icin mevcut sifre gereklidir." />
      <PanelCard>
        <Text style={styles.fieldLabel}>Mevcut sifre</Text>
        <TextInput style={styles.input} value={currentPassword} onChangeText={setCurrentPassword} secureTextEntry placeholder="Mevcut sifre" placeholderTextColor="#94a3b8" />
        <Text style={styles.fieldLabel}>Yeni e-posta</Text>
        <TextInput style={styles.input} value={newEmail} onChangeText={setNewEmail} autoCapitalize="none" keyboardType="email-address" placeholder="Yeni e-posta" placeholderTextColor="#94a3b8" />
        <ActionButton label="E-postayi guncelle" onPress={saveEmail} fullWidth />
        <Text style={styles.fieldLabel}>Yeni sifre</Text>
        <TextInput style={styles.input} value={newPassword} onChangeText={setNewPassword} secureTextEntry placeholder="Yeni sifre" placeholderTextColor="#94a3b8" />
        <ActionButton label="Sifreyi guncelle" onPress={savePassword} variant="secondary" fullWidth />
      </PanelCard>

      <ActionButton
        label="Cikis yap"
        onPress={handleLogout}
        variant="danger"
        icon={<Ionicons name="log-out-outline" size={18} color="#ffffff" />}
        fullWidth
      />
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  profileCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    ...theme.shadow.sm,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 22,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadow.primary,
  },
  avatarLabel: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 26,
  },
  profileBody: {
    flex: 1,
    gap: 2,
  },
  role: {
    color: theme.colors.primary,
    fontWeight: '800',
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  name: {
    color: theme.colors.text,
    fontSize: 20,
    fontWeight: '800',
  },
  email: {
    color: theme.colors.textMuted,
    fontSize: 13,
  },
  fieldLabel: {
    color: theme.colors.text,
    fontWeight: '700',
    fontSize: 13,
  },
  input: {
    minHeight: theme.touchTarget,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: theme.colors.text,
    fontSize: theme.fontSize.md,
    backgroundColor: theme.colors.surface,
  },
});