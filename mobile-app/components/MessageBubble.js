import { Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { theme } from '../config/theme';
import { formatDateTime } from '../utils/date';

export default function MessageBubble({ message, isMine }) {
  const isDeleted = Boolean(message.deleted);
  const type = message.type || 'text';

  async function openMedia() {
    if (!message.mediaUrl) return;
    await Linking.openURL(message.mediaUrl).catch(() => null);
  }

  function renderMedia() {
    if (!message.mediaUrl || isDeleted) return null;

    if (type === 'image') {
      return <Image source={{ uri: message.mediaUrl }} style={styles.image} resizeMode="cover" />;
    }

    if (type === 'audio') {
      return (
        <Pressable style={styles.mediaButton} onPress={openMedia}>
          <Text style={styles.mediaButtonText}>Ses kaydini ac</Text>
        </Pressable>
      );
    }

    if (type === 'video') {
      return (
        <Pressable style={styles.mediaButton} onPress={openMedia}>
          <Text style={styles.mediaButtonText}>Videoyu ac</Text>
        </Pressable>
      );
    }

    if (type === 'file') {
      return (
        <Pressable style={styles.mediaButton} onPress={openMedia}>
          <Text style={styles.mediaButtonText}>{message.text || 'Dosyayi ac'}</Text>
        </Pressable>
      );
    }

    return null;
  }

  return (
    <View style={[styles.row, isMine ? styles.rowRight : styles.rowLeft]}>
      <View style={[styles.bubble, isMine ? styles.mine : styles.theirs]}>
        {!isMine ? <Text style={styles.sender}>{message.senderName || 'Kullanici'}</Text> : null}
        {isDeleted ? <Text style={[styles.deletedText, isMine && styles.mineText]}>Bu mesaj silindi</Text> : <Text style={[styles.text, isMine && styles.mineText]}>{message.text || (message.mediaUrl ? '(medya mesaji)' : '')}</Text>}
        {renderMedia()}
        <Text style={[styles.time, isMine && styles.mineTime]}>{formatDateTime(message.timestamp)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    width: '100%',
    marginBottom: 10,
  },
  rowLeft: {
    alignItems: 'flex-start',
  },
  rowRight: {
    alignItems: 'flex-end',
  },
  bubble: {
    maxWidth: '84%',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 4,
  },
  theirs: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  mine: {
    backgroundColor: theme.colors.primary,
  },
  sender: {
    fontSize: 12,
    color: theme.colors.textMuted,
    fontWeight: '700',
  },
  text: {
    fontSize: 15,
    color: theme.colors.text,
    lineHeight: 20,
  },
  mineText: {
    color: '#ffffff',
  },
  time: {
    fontSize: 11,
    color: theme.colors.textMuted,
  },
  mineTime: {
    color: 'rgba(255,255,255,0.82)',
  },
  deletedText: {
    fontSize: 14,
    color: theme.colors.textMuted,
    fontStyle: 'italic',
  },
  image: {
    width: 220,
    height: 160,
    borderRadius: 12,
  },
  mediaButton: {
    borderWidth: 1,
    borderColor: '#cddced',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: '#edf5ff',
    alignSelf: 'flex-start',
  },
  mediaButtonText: {
    color: '#174777',
    fontWeight: '700',
  },
});