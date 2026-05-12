import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, FlatList, Image, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { Audio } from 'expo-av';
import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';

import ActionButton from '../../components/ActionButton';
import {
  acceptVoiceCall,
  addGroupMemberByEmail,
  cancelVoiceCall,
  clearChatMessages,
  declineVoiceCall,
  endVoiceCall,
  getChatParticipants,
  leaveGroupChat,
  markMessageDeleted,
  removeGroupMember,
  sendMessage,
  startVoiceCall,
  subscribeChat,
  subscribeChatCalls,
  subscribeMessages,
  updateGroupChatSettings,
  updateGroupMemberRole,
} from '../../api/chatApi';
import ChatComposer from '../../components/ChatComposer';
import LoadingBlock from '../../components/LoadingBlock';
import MessageBubble from '../../components/MessageBubble';
import ScreenLayout from '../../components/ScreenLayout';
import { storage } from '../../config/firebase';
import { theme } from '../../config/theme';
import {
  acceptIncomingVoiceCallSession,
  disposeVoiceCallSession,
  getVoiceCallSessionState,
  getVoiceCallSupport,
  startOutgoingVoiceCallSession,
  subscribeVoiceCallSession,
  toggleVoiceCallMute,
} from '../../realtime/voiceCallSession';
import { useAuthStore } from '../../store/authStore';

const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024;
const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';

function base64ToUint8Array(base64) {
  const sanitized = String(base64 || '').replace(/\s/g, '');
  let binaryString = '';

  for (let index = 0; index < sanitized.length; index += 4) {
    const enc1 = BASE64_ALPHABET.indexOf(sanitized.charAt(index));
    const enc2 = BASE64_ALPHABET.indexOf(sanitized.charAt(index + 1));
    const enc3 = BASE64_ALPHABET.indexOf(sanitized.charAt(index + 2));
    const enc4 = BASE64_ALPHABET.indexOf(sanitized.charAt(index + 3));

    const chr1 = (enc1 << 2) | (enc2 >> 4);
    const chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
    const chr3 = ((enc3 & 3) << 6) | enc4;

    binaryString += String.fromCharCode(chr1);
    if (enc3 !== 64) {
      binaryString += String.fromCharCode(chr2);
    }
    if (enc4 !== 64) {
      binaryString += String.fromCharCode(chr3);
    }
  }

  const bytes = new Uint8Array(binaryString.length);
  for (let index = 0; index < binaryString.length; index += 1) {
    bytes[index] = binaryString.charCodeAt(index);
  }
  return bytes;
}

function formatFileSize(size) {
  const numericSize = Number(size || 0);
  if (!numericSize) return '';
  if (numericSize >= 1024 * 1024) return `${(numericSize / (1024 * 1024)).toFixed(1)} MB`;
  if (numericSize >= 1024) return `${Math.round(numericSize / 1024)} KB`;
  return `${numericSize} B`;
}

async function enrichAttachment(asset) {
  if (!asset?.uri || Platform.OS === 'web') {
    return asset;
  }

  const info = await FileSystem.getInfoAsync(asset.uri, { size: true });
  return {
    ...asset,
    size: info.exists ? info.size || 0 : asset.size || 0,
  };
}

async function readUploadableAttachment(attachment) {
  if (attachment.blob instanceof Blob) {
    return attachment.blob;
  }

  if (Platform.OS === 'web') {
    const response = await fetch(attachment.uri);
    return response.blob();
  }

  const base64 = await FileSystem.readAsStringAsync(attachment.uri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  return base64ToUint8Array(base64);
}

function normalizeImagePickerAsset(result) {
  if (!result || result.canceled || result.cancelled) return null;
  if (Array.isArray(result.assets) && result.assets.length) return result.assets[0];
  if (result.uri) {
    return {
      uri: result.uri,
      type: result.type,
      fileName: result.fileName,
      mimeType: result.mimeType,
    };
  }
  return null;
}

function normalizeDocumentPickerAsset(result) {
  if (!result || result.canceled || result.cancelled || result.type === 'cancel') return null;
  if (Array.isArray(result.assets) && result.assets.length) return result.assets[0];
  if (result.type === 'success' && result.uri) {
    return {
      uri: result.uri,
      name: result.name,
      mimeType: result.mimeType,
    };
  }
  return null;
}

function getCallPhaseLabel(phase) {
  switch (phase) {
    case 'requesting-media':
      return 'mikrofon hazirlaniyor';
    case 'ringing':
      return 'arama caliyor';
    case 'connecting':
      return 'baglanti kuruluyor';
    case 'active':
      return 'canli baglanti';
    case 'ended':
      return 'gorusme bitti';
    case 'error':
      return 'baglanti hatasi';
    default:
      return 'hazir';
  }
}

export default function ChatDetailScreen({ navigation, route }) {
  const { chat } = route.params;
  const profile = useAuthStore((state) => state.profile);
  const [messages, setMessages] = useState(null);
  const [text, setText] = useState('');
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [attachment, setAttachment] = useState(null);
  const [recording, setRecording] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [chatLiveData, setChatLiveData] = useState(null);
  const [activeCall, setActiveCall] = useState(null);
  const mediaRecorderRef = useRef(null);
  const webAudioChunksRef = useRef([]);
  const [groupName, setGroupName] = useState(chat.groupName || '');
  const [groupDescription, setGroupDescription] = useState(chat.groupDescription || '');
  const [groupPhotoUrl, setGroupPhotoUrl] = useState(chat.groupPhotoUrl || '');
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [isSavingGroup, setIsSavingGroup] = useState(false);
  const [isUploadingGroupPhoto, setIsUploadingGroupPhoto] = useState(false);
  const [isUpdatingMembers, setIsUpdatingMembers] = useState(false);
  const [callSession, setCallSession] = useState(() => getVoiceCallSessionState());

  const currentChat = useMemo(() => ({ ...chat, ...chatLiveData }), [chat, chatLiveData]);
  const participants = useMemo(() => getChatParticipants(currentChat), [currentChat]);
  const isGroupChat = currentChat.type === 'group' || Boolean(currentChat.groupName);
  const currentUserParticipant = useMemo(
    () => participants.find((participant) => participant.uid === profile.uid) || null,
    [participants, profile.uid],
  );
  const isGroupAdmin = Boolean(
    isGroupChat && ((currentUserParticipant?.groupRole || '') === 'admin' || currentChat.createdBy === profile.uid),
  );
  const groupAdmins = useMemo(
    () => participants.filter((participant) => participant.groupRole === 'admin'),
    [participants],
  );
  const visibleMessages = useMemo(() => {
    const chatClearedAt = currentChat?.clearedAt || null;
    if (!Array.isArray(messages)) {
      return [];
    }
    return chatClearedAt
      ? messages.filter((message) => !message.timestamp || message.timestamp >= chatClearedAt)
      : messages;
  }, [currentChat?.clearedAt, messages]);
  const liveCall = useMemo(() => {
    if (!activeCall || !Array.isArray(activeCall.participants)) {
      return null;
    }
    return activeCall.participants.includes(profile.uid) ? activeCall : null;
  }, [activeCall, profile.uid]);
  const isIncomingCall = liveCall?.status === 'ringing' && liveCall.callerId !== profile.uid;
  const isOutgoingCall = liveCall?.status === 'ringing' && liveCall.callerId === profile.uid;
  const isConnectingCall = liveCall?.status === 'connecting';
  const isConnectedCall = liveCall?.status === 'active';
  const groupAvatarLabel = (currentChat.groupName || 'G').slice(0, 1).toUpperCase();
  const callPeerName = useMemo(() => {
    if (isGroupChat) {
      return currentChat.groupName || 'Grup';
    }

    const otherParticipant = participants.find((participant) => participant.uid !== profile.uid);
    return otherParticipant?.name || otherParticipant?.email || 'Karsi taraf';
  }, [currentChat.groupName, isGroupChat, participants, profile.uid]);

  useEffect(() => {
    setGroupName(currentChat.groupName || '');
    setGroupDescription(currentChat.groupDescription || '');
    setGroupPhotoUrl(currentChat.groupPhotoUrl || '');
  }, [currentChat.groupDescription, currentChat.groupName, currentChat.groupPhotoUrl]);

  useEffect(() => {
    const unsubscribe = subscribeMessages(chat.id, setMessages, (error) => {
      console.warn('Message subscription failed:', error.message);
      setMessages([]);
    });
    return unsubscribe;
  }, [chat.id]);

  useEffect(() => {
    const unsubscribe = subscribeChat(chat.id, setChatLiveData, (error) => {
      console.warn('Chat doc subscription failed:', error.message);
    });
    return unsubscribe;
  }, [chat.id]);

  useEffect(() => subscribeVoiceCallSession(setCallSession), []);

  useEffect(() => {
    const unsubscribe = subscribeChatCalls(chat.id, (calls) => {
      const nextCall = (calls || []).find((item) => Array.isArray(item.participants) && item.participants.includes(profile.uid) && ['ringing', 'connecting', 'active'].includes(item.status)) || null;
      setActiveCall(nextCall);
    }, (error) => {
      console.warn('Call subscription failed:', error.message);
    });
    return unsubscribe;
  }, [chat.id, profile.uid]);

  async function handleSend() {
    const trimmed = text.trim();
    if (!trimmed && !attachment) return;
    if (isSending) return;

    setIsSending(true);
    setUploadProgress(0);
    try {
      const payload = {
        senderId: profile.uid,
        senderName: profile.name,
        text: trimmed,
        type: attachment?.type || 'text',
      };

      if (attachment?.uri || attachment?.blob) {
        if (attachment.size && attachment.size > MAX_ATTACHMENT_BYTES) {
          throw new Error('Dosya boyutu 15 MB sinirini asiyor. Daha kucuk bir dosya deneyin.');
        }

        let uploadable;
        try {
          uploadable = await readUploadableAttachment(attachment);
        } catch (fetchErr) {
          throw new Error(`Dosya okunamadi: ${fetchErr.message || 'Bilinmeyen hata'}`);
        }

        const fileName = `${Date.now()}_${attachment.name || 'media'}`;
        const fileRef = ref(storage, `chat-media/${chat.id}/${profile.uid}/${fileName}`);
        try {
          await new Promise((resolve, reject) => {
            const uploadTask = uploadBytesResumable(
              fileRef,
              uploadable,
              attachment.mimeType ? { contentType: attachment.mimeType } : undefined,
            );
            uploadTask.on(
              'state_changed',
              (snapshot) => {
                if (!snapshot.totalBytes) return;
                setUploadProgress(Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100));
              },
              reject,
              resolve,
            );
          });
        } catch (uploadErr) {
          throw new Error(`Dosya yuklenemedi: ${uploadErr.message || 'Depolama hatasi'}`);
        }

        const downloadUrl = await getDownloadURL(fileRef);
        payload.mediaUrl = downloadUrl;
        payload.mediaMime = attachment.mimeType || '';
        payload.fileName = attachment.name || '';
        payload.fileSize = attachment.size || 0;
        if (!payload.text) payload.text = attachment.name || '';
      }

      await sendMessage(chat.id, payload);
      setText('');
      setAttachment(null);
    } catch (error) {
      Alert.alert('Mesaj gonderilemedi', error.message || 'Bilinmeyen bir hata olustu. Lutfen tekrar deneyin.');
    } finally {
      setIsSending(false);
      setUploadProgress(0);
    }
  }

  async function pickMedia() {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Medya', 'Galeri izni verilmeden medya secilemez.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.All, quality: 0.8 });
      const asset = normalizeImagePickerAsset(result);
      if (!asset?.uri) return;

      const type = asset.type === 'video' ? 'video' : 'image';
      setAttachment(await enrichAttachment({ uri: asset.uri, name: asset.fileName || `${type}-${Date.now()}`, type, mimeType: asset.mimeType || '', size: asset.fileSize || 0 }));
    } catch (error) {
      Alert.alert('Medya', error.message || 'Medya secilemedi.');
    }
  }

  async function pickFile() {
    try {
      const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: false });
      const asset = normalizeDocumentPickerAsset(result);
      if (!asset?.uri) return;

      setAttachment(await enrichAttachment({ uri: asset.uri, name: asset.name || `dosya-${Date.now()}`, type: 'file', mimeType: asset.mimeType || 'application/octet-stream', size: asset.size || 0 }));
    } catch (error) {
      Alert.alert('Dosya', error.message || 'Dosya secilemedi.');
    }
  }

  async function toggleVoiceRecording() {
    try {
      if (isRecording) {
        if (Platform.OS === 'web') {
          const session = mediaRecorderRef.current;
          if (!session) return;
          await new Promise((resolve) => {
            session.recorder.onstop = () => {
              const blob = new Blob(webAudioChunksRef.current, { type: 'audio/webm' });
              session.stream.getTracks().forEach((track) => track.stop());
              mediaRecorderRef.current = null;
              webAudioChunksRef.current = [];
              setIsRecording(false);
              setAttachment({ blob, name: `voice-${Date.now()}.webm`, type: 'audio', mimeType: 'audio/webm' });
              Alert.alert('Ses kaydi', 'Kayit tamamlandi. Gondermek icin Gonder butonuna basin.');
              resolve();
            };
            session.recorder.stop();
          });
          return;
        }

        if (recording) {
          const stopped = recording;
          await stopped.stopAndUnloadAsync();
          const uri = stopped.getURI();
          setRecording(null);
          setIsRecording(false);
          if (uri) {
            setAttachment(await enrichAttachment({ uri, name: `voice-${Date.now()}.m4a`, type: 'audio', mimeType: 'audio/m4a' }));
            Alert.alert('Ses kaydi', 'Kayit tamamlandi. Gondermek icin Gonder butonuna basin.');
          }
        }
        return;
      }

      if (Platform.OS === 'web') {
        if (!navigator?.mediaDevices?.getUserMedia) {
          Alert.alert('Ses kaydi', 'Tarayiciniz mikrofon erisimini desteklemiyor.');
          return;
        }
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const recorder = new MediaRecorder(stream);
        webAudioChunksRef.current = [];
        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) webAudioChunksRef.current.push(event.data);
        };
        recorder.start();
        mediaRecorderRef.current = { recorder, stream };
        setIsRecording(true);
        Alert.alert('Ses kaydi', 'Kayit basladi. Bitirmek icin tekrar butona basin.');
        return;
      }

      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Mikrofon', 'Ses kaydi icin mikrofon izni gerekli.');
        return;
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const nextRecording = new Audio.Recording();
      await nextRecording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await nextRecording.startAsync();
      setRecording(nextRecording);
      setIsRecording(true);
      Alert.alert('Ses kaydi', 'Kayit basladi. Bitirmek icin tekrar butona basin.');
    } catch (error) {
      setRecording(null);
      setIsRecording(false);
      mediaRecorderRef.current = null;
      Alert.alert('Ses kaydi', error.message || 'Ses kaydi baslatilamadi.');
    }
  }

  async function handleStartVoiceCall() {
    if (liveCall?.id) {
      Alert.alert('Sesli arama', 'Bu sohbet icin zaten acik bir cagri var.');
      return;
    }

    const support = getVoiceCallSupport();
    if (!support.available) {
      Alert.alert('Sesli arama', support.reason);
      return;
    }

    let callId = '';
    try {
      callId = await startVoiceCall({ chat: currentChat, caller: profile });
      await startOutgoingVoiceCallSession({
        callId,
        callerName: profile.name,
        remoteDisplayName: callPeerName,
      });
      Alert.alert('Sesli arama', 'Arama istegi gonderildi. Karsi tarafin kabul etmesi bekleniyor.');
    } catch (error) {
      if (callId) {
        await cancelVoiceCall({ callId, callerId: profile.uid }).catch(() => undefined);
      }
      await disposeVoiceCallSession();
      Alert.alert('Sesli arama', error.message || 'Arama baslatilamadi.');
    }
  }

  async function handleAcceptVoiceCall() {
    if (!liveCall?.id) return;

    const support = getVoiceCallSupport();
    if (!support.available) {
      Alert.alert('Sesli arama', support.reason);
      return;
    }

    try {
      await acceptVoiceCall({ callId: liveCall.id, calleeId: profile.uid, calleeName: profile.name });
      await acceptIncomingVoiceCallSession({ callId: liveCall.id, callerName: liveCall.callerName || callPeerName });
    } catch (error) {
      await endVoiceCall({ callId: liveCall.id, endedBy: profile.uid }).catch(() => undefined);
      await disposeVoiceCallSession();
      Alert.alert('Sesli arama', error.message || 'Cagri kabul edilemedi.');
    }
  }

  async function handleDeclineVoiceCall() {
    if (!liveCall?.id) return;
    try {
      await declineVoiceCall({ callId: liveCall.id, calleeId: profile.uid });
      await disposeVoiceCallSession();
    } catch (error) {
      Alert.alert('Sesli arama', error.message || 'Cagri reddedilemedi.');
    }
  }

  async function handleEndOrCancelCall() {
    if (!liveCall?.id) return;
    try {
      if (liveCall.status === 'ringing' && liveCall.callerId === profile.uid) {
        await cancelVoiceCall({ callId: liveCall.id, callerId: profile.uid });
        await disposeVoiceCallSession();
        return;
      }
      await endVoiceCall({ callId: liveCall.id, endedBy: profile.uid });
      await disposeVoiceCallSession();
    } catch (error) {
      Alert.alert('Sesli arama', error.message || 'Cagri sonlandirilamadi.');
    }
  }

  function handleToggleCallMute() {
    const nextMuted = toggleVoiceCallMute();
    if (nextMuted === false && !callSession.callId) {
      Alert.alert('Sesli arama', 'Aktif bir sesli arama bulunamadi.');
    }
  }

  function handleClearMessages() {
    Alert.alert('Mesajlari sil', 'Bu sohbetteki tum mesajlar silinecek. Emin misiniz?', [
      { text: 'Iptal', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          try {
            await clearChatMessages(chat.id, profile.uid);
            Alert.alert('Mesajlar', 'Tum mesajlar temizlendi.');
          } catch (error) {
            Alert.alert('Mesajlar', error.message || 'Mesajlar silinemedi.');
          }
        },
      },
    ]);
  }

  function handleDeleteSingleMessage(item) {
    if (item.senderId !== profile.uid) {
      Alert.alert('Mesaj', 'Sadece kendi mesajinizi silebilirsiniz.');
      return;
    }
    Alert.alert('Mesaji sil', 'Bu mesaj silinsin mi?', [
      { text: 'Iptal', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          try {
            await markMessageDeleted(chat.id, item.id);
          } catch (error) {
            Alert.alert('Mesaj', error.message || 'Mesaj silinemedi.');
          }
        },
      },
    ]);
  }

  async function handlePickGroupPhoto() {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Grup', 'Fotograf secmek icin galeri izni gerekli.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });
      const asset = normalizeImagePickerAsset(result);
      if (!asset?.uri) {
        return;
      }

      setIsUploadingGroupPhoto(true);
      const uploadable = await readUploadableAttachment({ uri: asset.uri, mimeType: asset.mimeType || 'image/jpeg' });
      const fileRef = ref(storage, `chat-groups/${chat.id}/group-photo-${Date.now()}`);
      await new Promise((resolve, reject) => {
        const uploadTask = uploadBytesResumable(fileRef, uploadable, asset.mimeType ? { contentType: asset.mimeType } : undefined);
        uploadTask.on('state_changed', undefined, reject, resolve);
      });
      const downloadUrl = await getDownloadURL(fileRef);
      setGroupPhotoUrl(downloadUrl);
      Alert.alert('Grup', 'Fotograf secildi. Kaydet diyerek gruba uygula.');
    } catch (error) {
      Alert.alert('Grup', error.message || 'Grup fotografi yuklenemedi.');
    } finally {
      setIsUploadingGroupPhoto(false);
    }
  }

  async function handleSaveGroupSettings() {
    try {
      setIsSavingGroup(true);
      await updateGroupChatSettings({ chatId: chat.id, groupName, groupDescription, groupPhotoUrl });
      Alert.alert('Grup', 'Grup ayarlari kaydedildi.');
    } catch (error) {
      Alert.alert('Grup', error.message || 'Grup ayarlari kaydedilemedi.');
    } finally {
      setIsSavingGroup(false);
    }
  }

  async function handleAddGroupMember() {
    try {
      setIsUpdatingMembers(true);
      await addGroupMemberByEmail({ chatId: chat.id, email: newMemberEmail });
      setNewMemberEmail('');
      Alert.alert('Grup', 'Uye eklendi.');
    } catch (error) {
      Alert.alert('Grup', error.message || 'Uye eklenemedi.');
    } finally {
      setIsUpdatingMembers(false);
    }
  }

  async function handleRemoveGroupMember(memberId) {
    try {
      setIsUpdatingMembers(true);
      await removeGroupMember({ chatId: chat.id, memberId });
      Alert.alert('Grup', 'Uye cikarildi.');
    } catch (error) {
      Alert.alert('Grup', error.message || 'Uye cikarilamadi.');
    } finally {
      setIsUpdatingMembers(false);
    }
  }

  async function handleToggleMemberRole(member) {
    if (member.groupRole === 'admin' && groupAdmins.length <= 1) {
      Alert.alert('Grup', 'Grupta en az bir yonetici kalmali.');
      return;
    }

    try {
      setIsUpdatingMembers(true);
      await updateGroupMemberRole({
        chatId: chat.id,
        memberId: member.uid,
        groupRole: member.groupRole === 'admin' ? 'member' : 'admin',
      });
      Alert.alert('Grup', member.groupRole === 'admin' ? 'Yonetici yetkisi kaldirildi.' : 'Yeni yonetici atandi.');
    } catch (error) {
      Alert.alert('Grup', error.message || 'Rol guncellenemedi.');
    } finally {
      setIsUpdatingMembers(false);
    }
  }

  function handleLeaveGroup() {
    Alert.alert('Gruptan ayril', 'Bu gruptan ayrilmak istediginize emin misiniz?', [
      { text: 'Iptal', style: 'cancel' },
      {
        text: 'Ayril',
        style: 'destructive',
        onPress: async () => {
          try {
            await leaveGroupChat({ chatId: chat.id, memberId: profile.uid });
            setSettingsVisible(false);
            navigation.goBack();
          } catch (error) {
            Alert.alert('Grup', error.message || 'Gruptan ayrilinamadi.');
          }
        },
      },
    ]);
  }

  if (messages === null) {
    return <LoadingBlock label="Mesajlar yukleniyor..." />;
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScreenLayout
        title="Sohbet"
        subtitle=""
        scroll={false}
        right={<ActionButton label="Ayar" variant="secondary" onPress={() => setSettingsVisible(true)} />}
      >
        <View style={styles.body}>
          {isGroupChat ? (
            <View style={styles.groupInfoCard}>
              <View style={styles.groupInfoHeader}>
                {currentChat.groupPhotoUrl ? (
                  <Image source={{ uri: currentChat.groupPhotoUrl }} style={styles.groupAvatar} />
                ) : (
                  <View style={styles.groupAvatarFallback}>
                    <Text style={styles.groupAvatarLabel}>{groupAvatarLabel}</Text>
                  </View>
                )}
                <View style={styles.flexOne}>
                  <Text style={styles.groupInfoTitle}>{currentChat.groupName || 'Grup Sohbeti'}</Text>
                  {currentChat.groupDescription ? <Text style={styles.groupInfoText}>{currentChat.groupDescription}</Text> : null}
                  <Text style={styles.groupInfoMeta}>{participants.length} uye</Text>
                </View>
              </View>
            </View>
          ) : null}
          {liveCall ? (
            <View style={styles.callCard}>
              <Text style={styles.callTitle}>
                {isIncomingCall ? 'Gelen sesli arama' : isOutgoingCall ? 'Arama caliyor' : isConnectingCall ? 'Baglanti kuruluyor' : 'Cagri kabul edildi'}
              </Text>
              <Text style={styles.callText}>
                {isIncomingCall
                  ? `${liveCall.callerName || 'Bir kullanici'} sizi ariyor.`
                  : isOutgoingCall
                    ? 'Karsi tarafin kabul etmesi bekleniyor.'
                    : isConnectingCall
                      ? 'Mikrofon ve WebRTC baglantisi hazirlaniyor.'
                      : `${liveCall.answeredByName || 'Bir katilimci'} aramayi kabul etti.`}
              </Text>
              <Text style={styles.callMeta}>
                {`Durum: ${getCallPhaseLabel(callSession.phase)}${callSession.connectionState ? ` • ${callSession.connectionState}` : ''}`}
              </Text>
              {callSession.errorMessage ? <Text style={styles.callError}>{callSession.errorMessage}</Text> : null}
              <View style={styles.buttonRow}>
                {isIncomingCall ? (
                  <>
                    <ActionButton label="Kabul Et" onPress={handleAcceptVoiceCall} />
                    <ActionButton label="Reddet" variant="secondary" onPress={handleDeclineVoiceCall} />
                  </>
                ) : null}
                {isOutgoingCall ? <ActionButton label="Iptal Et" variant="secondary" onPress={handleEndOrCancelCall} /> : null}
                {isConnectingCall ? <ActionButton label="Sonlandir" variant="secondary" onPress={handleEndOrCancelCall} /> : null}
                {isConnectingCall ? <ActionButton label={callSession.localMuted ? 'Mikrofonu Ac' : 'Mikrofonu Kapat'} variant="secondary" onPress={handleToggleCallMute} /> : null}
                {isConnectedCall ? <ActionButton label="Sonlandir" variant="secondary" onPress={handleEndOrCancelCall} /> : null}
                {isConnectedCall ? <ActionButton label={callSession.localMuted ? 'Mikrofonu Ac' : 'Mikrofonu Kapat'} variant="secondary" onPress={handleToggleCallMute} /> : null}
              </View>
            </View>
          ) : null}
          <View style={styles.topActions}>
            <ActionButton label="Sesli Ara" onPress={handleStartVoiceCall} disabled={Boolean(liveCall)} />
            <ActionButton label="Mesajlari Sil" variant="secondary" onPress={handleClearMessages} />
          </View>
          <FlatList
            data={visibleMessages}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <Pressable onLongPress={() => handleDeleteSingleMessage(item)} delayLongPress={260}>
                <MessageBubble message={item} isMine={item.senderId === profile.uid} />
              </Pressable>
            )}
            contentContainerStyle={styles.list}
            keyboardShouldPersistTaps="handled"
            initialNumToRender={18}
            maxToRenderPerBatch={20}
            windowSize={10}
            removeClippedSubviews={Platform.OS !== 'web'}
          />
          <View style={styles.mediaActions}>
            <ActionButton label="Medya" variant="secondary" onPress={pickMedia} disabled={isSending} />
            <ActionButton label="Dosya" variant="secondary" onPress={pickFile} disabled={isSending} />
            <ActionButton label={isRecording ? 'Kaydi Bitir' : 'Ses Kaydi'} variant="secondary" onPress={toggleVoiceRecording} disabled={isSending} />
          </View>
          {attachment ? (
            <View style={styles.attachmentPreview}>
              <Text style={styles.attachmentText}>Eklenti: {attachment.name}</Text>
              <Text style={styles.attachmentMeta}>{formatFileSize(attachment.size)} {attachment.mimeType ? `• ${attachment.mimeType}` : ''}</Text>
              {isSending && uploadProgress > 0 ? (
                <View style={styles.progressTrack}>
                  <View style={[styles.progressBar, { width: `${uploadProgress}%` }]} />
                </View>
              ) : null}
              <Text style={styles.attachmentMeta}>{isSending ? `Yukleniyor %${uploadProgress || 0}` : 'Hazir'}</Text>
              <ActionButton label="Temizle" variant="secondary" onPress={() => setAttachment(null)} disabled={isSending} />
            </View>
          ) : null}
          <ChatComposer value={text} onChangeText={setText} onSend={handleSend} disabled={isSending} sendLabel={isSending ? 'Gonderiliyor...' : 'Gonder'} />
        </View>

        <Modal visible={settingsVisible} transparent animationType="fade" onRequestClose={() => setSettingsVisible(false)}>
          <Pressable style={styles.modalBackdrop} onPress={() => setSettingsVisible(false)}>
            <Pressable style={styles.modalCard} onPress={() => null}>
              <Text style={styles.modalTitle}>Sohbet ayarlari</Text>
              {isGroupChat ? (
                <View style={styles.groupBlock}>
                  <Text style={styles.groupTitle}>Grup bilgileri</Text>
                  <View style={styles.groupPhotoRow}>
                    {groupPhotoUrl ? (
                      <Image source={{ uri: groupPhotoUrl }} style={styles.groupPhotoPreview} />
                    ) : (
                      <View style={styles.groupPhotoFallback}>
                        <Text style={styles.groupAvatarLabel}>{groupAvatarLabel}</Text>
                      </View>
                    )}
                    {isGroupAdmin ? (
                      <ActionButton
                        label={isUploadingGroupPhoto ? 'Fotograf yukleniyor...' : 'Grup fotografi sec'}
                        variant="secondary"
                        onPress={handlePickGroupPhoto}
                        disabled={isUploadingGroupPhoto}
                      />
                    ) : null}
                  </View>
                  <TextInput style={styles.input} placeholder="Grup adi" value={groupName} onChangeText={setGroupName} editable={isGroupAdmin} />
                  <TextInput style={[styles.input, styles.multilineInput]} placeholder="Grup aciklamasi" value={groupDescription} onChangeText={setGroupDescription} multiline editable={isGroupAdmin} />
                  {isGroupAdmin ? (
                    <ActionButton label={isSavingGroup ? 'Kaydediliyor...' : 'Grup ayarlarini kaydet'} onPress={handleSaveGroupSettings} fullWidth disabled={isSavingGroup || isUploadingGroupPhoto} />
                  ) : (
                    <Text style={styles.helperText}>Grup adi, aciklama ve fotograf sadece yoneticiler tarafindan guncellenebilir.</Text>
                  )}

                  <Text style={styles.groupTitle}>Uyeler</Text>
                  {isGroupAdmin ? (
                    <>
                      <TextInput style={styles.input} placeholder="Uye e-postasi" autoCapitalize="none" value={newMemberEmail} onChangeText={setNewMemberEmail} />
                      <ActionButton label={isUpdatingMembers ? 'Isleniyor...' : 'Uyeyi ekle'} onPress={handleAddGroupMember} fullWidth disabled={isUpdatingMembers} />
                    </>
                  ) : null}
                  {participants.map((member) => {
                    const canToggleRole = isGroupAdmin && member.uid !== profile.uid && (member.groupRole !== 'admin' || groupAdmins.length > 1);
                    return (
                      <View key={`group-member-${member.uid}`} style={styles.memberCard}>
                        <View style={styles.memberRow}>
                          <View style={styles.flexOne}>
                            <Text style={styles.memberLabel}>{member.name || member.email || member.uid}</Text>
                            {member.email ? <Text style={styles.memberMeta}>{member.email}</Text> : null}
                          </View>
                          <View style={[styles.roleBadge, member.groupRole === 'admin' ? styles.roleBadgeAdmin : styles.roleBadgeMember]}>
                            <Text style={styles.roleBadgeLabel}>{member.groupRole === 'admin' ? 'Yonetici' : 'Uye'}</Text>
                          </View>
                        </View>
                        {isGroupAdmin && member.uid !== profile.uid ? (
                          <View style={styles.memberActions}>
                            {canToggleRole ? (
                              <ActionButton
                                label={member.groupRole === 'admin' ? 'Yetkiyi Kaldir' : 'Yonetici Yap'}
                                variant="secondary"
                                onPress={() => handleToggleMemberRole(member)}
                                disabled={isUpdatingMembers}
                              />
                            ) : null}
                            <ActionButton label="Cikar" variant="secondary" onPress={() => handleRemoveGroupMember(member.uid)} disabled={isUpdatingMembers} />
                          </View>
                        ) : null}
                      </View>
                    );
                  })}
                  <ActionButton label="Gruptan ayril" variant="secondary" onPress={handleLeaveGroup} fullWidth />
                </View>
              ) : null}
              <ActionButton label="Kapat" variant="secondary" onPress={() => setSettingsVisible(false)} fullWidth />
            </Pressable>
          </Pressable>
        </Modal>
      </ScreenLayout>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
  },
  topActions: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 8,
    flexWrap: 'wrap',
  },
  mediaActions: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 8,
    flexWrap: 'wrap',
  },
  groupInfoCard: {
    marginHorizontal: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#cae0f2',
    borderRadius: 14,
    padding: 14,
    backgroundColor: '#edf7ff',
    gap: 8,
  },
  groupInfoHeader: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  groupAvatar: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#d9ebf8',
  },
  groupAvatarFallback: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#d9ebf8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupAvatarLabel: {
    color: theme.colors.primaryDeep,
    fontWeight: '800',
    fontSize: 20,
  },
  groupInfoTitle: {
    color: theme.colors.primaryDeep,
    fontWeight: '800',
    fontSize: 16,
  },
  groupInfoText: {
    color: theme.colors.text,
    lineHeight: 20,
  },
  groupInfoMeta: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  callCard: {
    marginHorizontal: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#f0d29b',
    borderRadius: 14,
    padding: 14,
    backgroundColor: '#fff7e6',
    gap: 8,
  },
  callTitle: {
    color: '#8d5a00',
    fontWeight: '800',
    fontSize: 15,
  },
  callText: {
    color: '#81592a',
    lineHeight: 19,
  },
  callMeta: {
    color: '#7c5a2d',
    fontSize: 12,
    fontWeight: '700',
  },
  callError: {
    color: theme.colors.danger,
    fontSize: 12,
    fontWeight: '700',
  },
  attachmentPreview: {
    marginHorizontal: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    backgroundColor: '#f1f7ff',
    padding: 10,
    gap: 8,
  },
  attachmentText: {
    color: theme.colors.text,
    fontWeight: '700',
  },
  attachmentMeta: {
    color: theme.colors.textMuted,
    fontSize: 12,
  },
  progressTrack: {
    width: '100%',
    height: 8,
    borderRadius: 999,
    backgroundColor: '#d6e6f5',
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: theme.colors.primary,
    borderRadius: 999,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 520,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    padding: 14,
    gap: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.text,
  },
  groupBlock: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: 8,
    gap: 8,
  },
  groupTitle: {
    color: theme.colors.text,
    fontWeight: '800',
    fontSize: 16,
  },
  groupPhotoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  groupPhotoPreview: {
    width: 72,
    height: 72,
    borderRadius: 18,
    backgroundColor: '#dceaf5',
  },
  groupPhotoFallback: {
    width: 72,
    height: 72,
    borderRadius: 18,
    backgroundColor: '#dceaf5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberCard: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    padding: 10,
    gap: 8,
    backgroundColor: '#fbfdff',
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  memberLabel: {
    color: theme.colors.text,
    fontWeight: '700',
    flex: 1,
  },
  memberMeta: {
    color: theme.colors.textMuted,
    fontSize: 12,
  },
  memberActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  roleBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  roleBadgeAdmin: {
    backgroundColor: '#dff1fc',
  },
  roleBadgeMember: {
    backgroundColor: '#eef2f6',
  },
  roleBadgeLabel: {
    color: theme.colors.primaryDeep,
    fontWeight: '700',
    fontSize: 12,
  },
  helperText: {
    color: theme.colors.textMuted,
    lineHeight: 19,
  },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    backgroundColor: '#f9fcff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: theme.colors.text,
    textAlignVertical: 'top',
  },
  multilineInput: {
    minHeight: 84,
  },
  buttonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  flexOne: {
    flex: 1,
  },
});
