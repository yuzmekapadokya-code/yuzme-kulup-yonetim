import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';

import ActionButton from '../../components/ActionButton';
import EmptyState from '../../components/EmptyState';
import LoadingBlock from '../../components/LoadingBlock';
import ScreenLayout from '../../components/ScreenLayout';
import SectionHeader from '../../components/SectionHeader';
import { theme } from '../../config/theme';
import {
  createSecretaryDirectChat,
  createSecretaryGroupChat,
  getSecretaryChatOpsData,
  lookupSecretaryChatUser,
} from '../../services/secretaryService';
import { useAuthStore } from '../../store/authStore';

export default function SecretaryChatOpsScreen({ navigation }) {
  const profile = useAuthStore((state) => state.profile);
  const queryClient = useQueryClient();
  const [directEmail, setDirectEmail] = useState('');
  const [lookupUser, setLookupUser] = useState(null);
  const [groupName, setGroupName] = useState('');
  const [groupEmails, setGroupEmails] = useState('');

  const chatQuery = useQuery({
    queryKey: ['sec-chat-ops', profile?.uid],
    queryFn: () => getSecretaryChatOpsData(profile),
    enabled: Boolean(profile?.uid),
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['sec-chat-ops', profile.uid] });
    queryClient.invalidateQueries({ queryKey: ['sec-dashboard', profile.uid] });
  }

  const lookupMutation = useMutation({
    mutationFn: () => lookupSecretaryChatUser(directEmail),
    onSuccess: setLookupUser,
    onError: (error) => {
      setLookupUser(null);
      Alert.alert('Kullanici arama', error.message || 'Kullanici bulunamadi.');
    },
  });

  const directMutation = useMutation({
    mutationFn: () => createSecretaryDirectChat({ profile, email: directEmail }),
    onSuccess: (chat) => {
      invalidate();
      setDirectEmail('');
      setLookupUser(null);
      navigation.navigate('ChatDetail', { chat });
    },
    onError: (error) => Alert.alert('Birebir sohbet', error.message || 'Sohbet baslatilamadi.'),
  });

  const groupMutation = useMutation({
    mutationFn: () => createSecretaryGroupChat({
      profile,
      groupName,
      emails: groupEmails.split(',').map((item) => item.trim()).filter(Boolean),
    }),
    onSuccess: (chat) => {
      invalidate();
      setGroupName('');
      setGroupEmails('');
      navigation.navigate('ChatDetail', { chat });
    },
    onError: (error) => Alert.alert('Grup sohbeti', error.message || 'Grup olusturulamadi.'),
  });

  if (chatQuery.isLoading) {
    return <LoadingBlock label="Sohbet operasyonlari yukleniyor..." />;
  }

  return (
    <ScreenLayout title="Sohbet Operasyonlari" subtitle="Paylasilan chat sekmesine ek olarak sekreterin e-posta tabanli birebir ve grup olusturma akislarini yonetir.">
      <SectionHeader title="Birebir sohbet baslat" caption="Kullanici e-postasiyla mevcut direct chat'i bul veya yenisini ac" />
      <View style={styles.card}>
        <TextInput style={styles.input} placeholder="Kullanici e-postasi" autoCapitalize="none" keyboardType="email-address" value={directEmail} onChangeText={setDirectEmail} />
        <View style={styles.actionRow}>
          <ActionButton label={lookupMutation.isPending ? 'Araniyor...' : 'Kullanici Ara'} variant="secondary" onPress={() => lookupMutation.mutate()} />
          <ActionButton label={directMutation.isPending ? 'Aciliyor...' : 'Sohbet Baslat'} onPress={() => directMutation.mutate()} />
        </View>
        {lookupUser ? (
          <View style={styles.lookupBox}>
            <Text style={styles.lookupTitle}>{lookupUser.name || lookupUser.email}</Text>
            <Text style={styles.lookupText}>{lookupUser.role || 'kullanici'} | {lookupUser.email}</Text>
          </View>
        ) : null}
      </View>

      <SectionHeader title="Grup sohbeti olustur" caption="Virgulle ayrilmis e-postalarla yeni grup odasi ac" />
      <View style={styles.card}>
        <TextInput style={styles.input} placeholder="Grup adi" value={groupName} onChangeText={setGroupName} />
        <TextInput style={[styles.input, styles.textarea]} multiline placeholder="uye1@mail.com, uye2@mail.com" autoCapitalize="none" value={groupEmails} onChangeText={setGroupEmails} />
        <ActionButton label={groupMutation.isPending ? 'Olusturuluyor...' : 'Grubu Olustur'} onPress={() => groupMutation.mutate()} fullWidth />
        <Text style={styles.helper}>Sekreterin kendi e-postasi otomatik eklenir. Tum katilimcilarin users koleksiyonunda kaydi olmalidir.</Text>
      </View>

      <SectionHeader title="Mevcut sohbetler" caption="Sekreterin dahil oldugu son sohbet odalari" />
      <View style={styles.stack}>
        {!chatQuery.data.chats.length ? (
          <EmptyState title="Sohbet yok" description="Sekreter kullanicisi icin aktif chat bulunmuyor." />
        ) : (
          chatQuery.data.chats.map((chat) => (
            <View key={chat.id} style={styles.card}>
              <Text style={styles.lookupTitle}>{chat.title}</Text>
              <Text style={styles.lookupText}>{chat.subtitle}</Text>
              <Text style={styles.lookupText}>{chat.lastMessageText}</Text>
              <ActionButton label="Sohbeti Ac" onPress={() => navigation.navigate('ChatDetail', { chat })} />
            </View>
          ))
        )}
      </View>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 12,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    gap: 10,
  },
  input: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 14,
    color: theme.colors.text,
    backgroundColor: '#ffffff',
  },
  textarea: {
    minHeight: 100,
    paddingTop: 14,
    textAlignVertical: 'top',
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  lookupBox: {
    backgroundColor: '#eef8ff',
    borderWidth: 1,
    borderColor: '#c9e3f8',
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    gap: 4,
  },
  lookupTitle: {
    color: theme.colors.text,
    fontWeight: '800',
  },
  lookupText: {
    color: theme.colors.textMuted,
  },
  helper: {
    color: theme.colors.textMuted,
    lineHeight: 20,
  },
});