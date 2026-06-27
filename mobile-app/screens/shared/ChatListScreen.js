import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import ActionButton from '../../components/ActionButton';
import EmptyState from '../../components/EmptyState';
import LoadingBlock from '../../components/LoadingBlock';
import ScreenLayout from '../../components/ScreenLayout';
import { theme } from '../../config/theme';
import { getChatParticipants, subscribeChatList } from '../../api/chatApi';
import { useAuthStore } from '../../store/authStore';
import { formatDateTime } from '../../utils/date';

function normalizeSearchText(value) {
  return String(value || '').toLocaleLowerCase('tr-TR').replace(/\s+/g, ' ').trim();
}

export default function ChatListScreen({ navigation }) {
  const profile = useAuthStore((state) => state.profile);
  const [chats, setChats] = useState(null);
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);

  useEffect(() => {
    const unsubscribe = subscribeChatList(profile.uid, setChats, (error) => {
      console.warn('Chat list subscription failed:', error.message);
      setChats([]);
    });

    return unsubscribe;
  }, [profile.uid]);

  const filteredChats = useMemo(() => {
    if (chats === null) {
      return [];
    }

    const queryText = normalizeSearchText(deferredSearch);
    if (!queryText) {
      return chats;
    }

    return chats.filter((chat) => {
      const participants = getChatParticipants(chat);
      const otherParticipant = participants.find((entry) => entry.uid !== profile.uid);
      const haystack = [
        otherParticipant?.name,
        otherParticipant?.email,
        chat.groupName,
        chat.groupDescription,
        chat.lastMessage,
      ]
        .filter(Boolean)
        .join(' ');
      return normalizeSearchText(haystack).includes(queryText);
    });
  }, [chats, deferredSearch, profile.uid]);

  if (chats === null) {
    return <LoadingBlock label="Sohbetler yukleniyor..." />;
  }

  return (
    <ScreenLayout
      title="Sohbet"
      subtitle=""
      right={<ActionButton label="Yeni" onPress={() => navigation.navigate('NewChat')} />}
    >
      <FlatList
        data={filteredChats}
        keyExtractor={(item) => item.id}
        renderItem={({ item: chat }) => {
          const otherParticipant = getChatParticipants(chat).find((entry) => entry.uid !== profile.uid);
          const title = otherParticipant?.name || chat.groupName || 'Sohbet';
          const avatarLabel = title.slice(0, 1).toUpperCase();
          return (
            <Pressable
              onPress={() => navigation.navigate('ChatDetail', { chat })}
              style={({ pressed }) => [styles.card, pressed && styles.pressed]}
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarLabel}>{avatarLabel}</Text>
              </View>
              <View style={styles.body}>
                <Text style={styles.name}>{title}</Text>
                <Text style={styles.preview}>{chat.lastMessage || 'Mesaj yok'}</Text>
              </View>
              <Text style={styles.time}>{formatDateTime(chat.lastMessageTime)}</Text>
            </Pressable>
          );
        }}
        ListHeaderComponent={(
          <View style={styles.searchBox}>
            <TextInput
              style={styles.searchInput}
              placeholder="Sohbet, kisi veya mesaj ara"
              placeholderTextColor={theme.colors.textMuted}
              value={search}
              onChangeText={setSearch}
            />
          </View>
        )}
        ListHeaderComponentStyle={styles.headerSpacing}
        ListEmptyComponent={(
          <EmptyState
            title={search.trim() ? 'Aramaya uygun sohbet bulunamadi' : 'Sohbet bulunamadi'}
            description={search.trim() ? 'Farkli bir isim, e-posta veya mesaj anahtar kelimesi deneyin.' : 'Yeni bir dogrudan sohbet baslatabilirsiniz.'}
          />
        )}
        contentContainerStyle={styles.list}
        initialNumToRender={12}
        maxToRenderPerBatch={16}
        windowSize={8}
        removeClippedSubviews
      />
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 12,
    paddingBottom: 12,
  },
  headerSpacing: {
    marginBottom: 12,
  },
  searchBox: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: 6,
    ...theme.shadow.sm,
  },
  searchInput: {
    minHeight: theme.touchTarget,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceAlt,
    paddingHorizontal: 14,
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    ...theme.shadow.sm,
  },
  pressed: {
    opacity: 0.88,
    transform: [{ scale: 0.99 }],
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  avatarLabel: {
    color: theme.colors.primaryDeep,
    fontWeight: '800',
    fontSize: 17,
  },
  body: {
    flex: 1,
    gap: 4,
  },
  name: {
    color: theme.colors.text,
    fontWeight: '700',
    fontSize: 15,
  },
  preview: {
    color: theme.colors.textMuted,
    fontSize: 13,
  },
  time: {
    color: theme.colors.textMuted,
    fontSize: 11,
  },
});
