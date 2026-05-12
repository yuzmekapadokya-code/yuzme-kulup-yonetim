import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { collection, getDocs, limit, query, where } from 'firebase/firestore';

import { createGroupChat, createOrReuseDirectChat } from '../../api/chatApi';
import ActionButton from '../../components/ActionButton';
import ScreenLayout from '../../components/ScreenLayout';
import { db } from '../../config/firebase';
import { theme } from '../../config/theme';
import { useAuthStore } from '../../store/authStore';

export default function NewChatScreen({ navigation }) {
  const profile = useAuthStore((state) => state.profile);
  const [mode, setMode] = useState('direct');
  const [email, setEmail] = useState('');
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [groupEmails, setGroupEmails] = useState('');

  async function handleCreateChat() {
    try {
      const targetEmail = email.trim().toLowerCase();
      if (!targetEmail) return;

      const snapshot = await getDocs(query(collection(db, 'users'), where('email', '==', targetEmail), limit(1)));

      if (snapshot.empty) {
        Alert.alert('Kullanici bulunamadi', 'Bu e-posta ile eslesen bir kayit yok.');
        return;
      }

      const targetUser = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
      const chatId = await createOrReuseDirectChat({
        currentUser: profile,
        targetUser,
      });

      navigation.replace('ChatDetail', {
        chat: {
          id: chatId,
          participants: [
            { uid: profile.uid, name: profile.name, email: profile.email },
            { uid: targetUser.id, name: targetUser.name, email: targetUser.email },
          ],
        },
      });
    } catch (error) {
      Alert.alert('Sohbet', error.message || 'Sohbet baslatilamadi.');
    }
  }

  async function handleCreateGroupChat() {
    try {
      const emails = groupEmails.split(',').map((item) => item.trim()).filter(Boolean);
      const chat = await createGroupChat({
        currentUser: profile,
        groupName,
        groupDescription,
        emails,
      });

      navigation.replace('ChatDetail', { chat });
    } catch (error) {
      Alert.alert('Grup', error.message || 'Grup olusturulamadi.');
    }
  }

  return (
    <ScreenLayout title="Yeni Sohbet" subtitle="Birebir sohbet baslatin veya web'deki gibi grup odasi olusturun.">
      <View style={styles.modeRow}>
        <Pressable style={[styles.modePill, mode === 'direct' && styles.modePillActive]} onPress={() => setMode('direct')}>
          <Text style={[styles.modeLabel, mode === 'direct' && styles.modeLabelActive]}>Birebir</Text>
        </Pressable>
        <Pressable style={[styles.modePill, mode === 'group' && styles.modePillActive]} onPress={() => setMode('group')}>
          <Text style={[styles.modeLabel, mode === 'group' && styles.modeLabelActive]}>Grup</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        {mode === 'direct' ? (
          <>
            <TextInput
              style={styles.input}
              placeholder="Kullanici e-postasi"
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
            <ActionButton label="Sohbet Baslat" onPress={handleCreateChat} fullWidth />
          </>
        ) : (
          <>
            <Text style={styles.helper}>Grup ayarlari, uye ekleme ve cikarma sonrasinda sohbet ekranindaki Ayar alanindan da yonetilebilir.</Text>
            <TextInput style={styles.input} placeholder="Grup adi" value={groupName} onChangeText={setGroupName} />
            <TextInput style={[styles.input, styles.multiline]} multiline placeholder="Grup aciklamasi" value={groupDescription} onChangeText={setGroupDescription} />
            <TextInput
              style={[styles.input, styles.multiline]}
              multiline
              placeholder="uye1@mail.com, uye2@mail.com"
              autoCapitalize="none"
              keyboardType="email-address"
              value={groupEmails}
              onChangeText={setGroupEmails}
            />
            <ActionButton label="Grubu Olustur" onPress={handleCreateGroupChat} fullWidth />
          </>
        )}
      </View>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  modeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  modePill: {
    flex: 1,
    minHeight: 44,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modePillActive: {
    backgroundColor: '#dff1fc',
    borderColor: '#9fcae7',
  },
  modeLabel: {
    color: theme.colors.textMuted,
    fontWeight: '700',
  },
  modeLabelActive: {
    color: theme.colors.primaryDeep,
  },
  card: {
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.lg,
    borderRadius: theme.radius.md,
    gap: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  input: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 14,
    color: theme.colors.text,
  },
  multiline: {
    minHeight: 92,
    paddingTop: 14,
    textAlignVertical: 'top',
  },
  helper: {
    color: theme.colors.textMuted,
    lineHeight: 20,
  },
});