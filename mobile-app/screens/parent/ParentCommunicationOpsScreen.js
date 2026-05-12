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
  connectParentToSuperAdminFromMarket,
  createParentDirectChat,
  createParentGroupChat,
  getParentCommunicationData,
} from '../../services/parentService';
import { useAuthStore } from '../../store/authStore';

export default function ParentCommunicationOpsScreen({ navigation }) {
  const profile = useAuthStore((state) => state.profile);
  const queryClient = useQueryClient();
  const [directEmail, setDirectEmail] = useState('');
  const [groupName, setGroupName] = useState('');
  const [groupEmails, setGroupEmails] = useState('');

  const communicationQuery = useQuery({
    queryKey: ['pr-communication', profile?.uid],
    queryFn: () => getParentCommunicationData(profile),
    enabled: Boolean(profile?.uid),
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['pr-communication', profile.uid] });
    queryClient.invalidateQueries({ queryKey: ['pr-dashboard', profile.uid] });
  }

  const directMutation = useMutation({
    mutationFn: () => createParentDirectChat({ profile, email: directEmail }),
    onSuccess: (chat) => {
      invalidate();
      setDirectEmail('');
      navigation.navigate('ChatDetail', { chat });
    },
    onError: (error) => Alert.alert('Sohbet', error.message || 'Birebir sohbet baslatilamadi.'),
  });

  const groupMutation = useMutation({
    mutationFn: () => createParentGroupChat({
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
    onError: (error) => Alert.alert('Grup sohbeti', error.message || 'Grup sohbeti olusturulamadi.'),
  });

  const supportMutation = useMutation({
    mutationFn: (product) => connectParentToSuperAdminFromMarket({ profile, product }),
    onSuccess: (chat) => {
      invalidate();
      navigation.navigate('ChatDetail', { chat });
    },
    onError: (error) => Alert.alert('Yetkili baglantisi', error.message || 'Yetkiliye baglanilamadi.'),
  });

  if (communicationQuery.isLoading) {
    return <LoadingBlock label="Iletisim modulu yukleniyor..." />;
  }

  const data = communicationQuery.data;

  return (
    <ScreenLayout title="Iletisim ve Destek" subtitle="Mevcut sohbetler, yeni sohbet olusturma ve market urunleri icin yetkili baglantisi.">
      <SectionHeader title="Birebir sohbet" caption="E-posta ile yeni direct chat baslat" />
      <View style={styles.card}>
        <TextInput style={styles.input} placeholder="Kullanici e-postasi" autoCapitalize="none" keyboardType="email-address" value={directEmail} onChangeText={setDirectEmail} />
        <ActionButton label={directMutation.isPending ? 'Baslatiliyor...' : 'Sohbet Baslat'} onPress={() => directMutation.mutate()} fullWidth />
      </View>

      <SectionHeader title="Grup sohbeti" caption="Virgulle ayrilmis e-postalarla grup odasi kur" />
      <View style={styles.card}>
        <TextInput style={styles.input} placeholder="Grup adi" value={groupName} onChangeText={setGroupName} />
        <TextInput style={[styles.input, styles.textarea]} multiline placeholder="uye1@mail.com, uye2@mail.com" autoCapitalize="none" value={groupEmails} onChangeText={setGroupEmails} />
        <ActionButton label={groupMutation.isPending ? 'Olusturuluyor...' : 'Grubu Olustur'} onPress={() => groupMutation.mutate()} fullWidth />
      </View>

      <SectionHeader title="Market destek baglantisi" caption="Satin alma aktif degilse superadmin ile sohbet baslat" />
      <View style={styles.stack}>
        {!data.products.length ? (
          <EmptyState title="Urun yok" description="Market kaydi bulunmuyor." />
        ) : (
          data.products.map((product) => (
            <View key={product.id} style={styles.card}>
              <Text style={styles.cardTitle}>{product.name}</Text>
              <Text style={styles.price}>₺{Number(product.price || 0).toFixed(2)}</Text>
              <Text style={styles.cardText}>{product.description || 'Aciklama yok'}</Text>
              <ActionButton
                label={supportMutation.isPending ? 'Baglaniyor...' : 'Yetkiliye Sor'}
                onPress={() => supportMutation.mutate(product)}
              />
            </View>
          ))
        )}
      </View>

      <SectionHeader title="Mevcut sohbetler" caption="Veli kullanicisinin dahil oldugu odalar" />
      <View style={styles.stack}>
        {!data.chats.length ? (
          <EmptyState title="Sohbet yok" description="Henuz sohbet kaydi bulunmuyor." />
        ) : (
          data.chats.map((chat) => (
            <View key={chat.id} style={styles.card}>
              <Text style={styles.cardTitle}>{chat.title}</Text>
              <Text style={styles.cardText}>{chat.subtitle}</Text>
              <Text style={styles.cardText}>{chat.lastMessageText}</Text>
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
  },
  textarea: {
    minHeight: 100,
    paddingTop: 14,
    textAlignVertical: 'top',
  },
  cardTitle: {
    color: theme.colors.text,
    fontWeight: '800',
  },
  cardText: {
    color: theme.colors.textMuted,
  },
  price: {
    color: theme.colors.success,
    fontWeight: '800',
    fontSize: 20,
  },
});