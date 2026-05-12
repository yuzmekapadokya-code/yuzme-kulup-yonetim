import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';

import { db } from '../config/firebase';
import { createAppNotifications } from '../services/notificationService';
import { nowIso } from '../utils/date';

function normalizeGroupRole(groupRole) {
  return groupRole === 'admin' ? 'admin' : 'member';
}

function buildParticipant(uid, payload = {}) {
  return {
    uid,
    name: payload.name || payload.fullName || payload.email || 'Kullanici',
    email: payload.email || '',
    role: payload.role || 'user',
    avatarUrl: payload.avatarUrl || payload.photoURL || payload.photoUrl || '',
    groupRole: normalizeGroupRole(payload.groupRole || payload.chatRole || payload.memberRole),
  };
    onSnapshot,

function buildUsersMap(participants = []) {
  return participants.reduce((result, participant) => {
    if (!participant?.uid) return result;
    result[participant.uid] = {
      name: participant.name || participant.email || participant.uid,
      email: participant.email || '',
      role: participant.role || 'user',
    offer: null,
    answer: null,
      avatarUrl: participant.avatarUrl || '',
      groupRole: normalizeGroupRole(participant.groupRole),
    };
    return result;
  }, {});
}

function ensureGroupAdmins(participants = [], fallbackAdminId = '') {
  const normalizedParticipants = participants.map((participant) => ({
    ...participant,
    groupRole: normalizeGroupRole(participant.groupRole),
  }));

  if (!normalizedParticipants.length) {
    return normalizedParticipants;
  }

  if (normalizedParticipants.some((participant) => participant.groupRole === 'admin')) {
    return normalizedParticipants;
  }

  const promotedIndex = normalizedParticipants.findIndex((participant) => participant.uid === fallbackAdminId);
  const nextAdminIndex = promotedIndex >= 0 ? promotedIndex : 0;

    status: 'connecting',
    index === nextAdminIndex ? { ...participant, groupRole: 'admin' } : participant
  ));
    acceptedAt: nowIso(),

async function findUserByEmail(email) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail) {
    return null;
  }

  const snapshot = await getDocs(query(collection(db, 'users'), where('email', '==', normalizedEmail), limit(1)));
  if (snapshot.empty) {
    return null;
  }

  return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
}

export function getChatParticipants(chat) {
  if (Array.isArray(chat?.participants) && chat.participants.length) {
    return chat.participants.map((participant) => buildParticipant(participant.uid, participant));
  }

  if (chat?.users && typeof chat.users === 'object') {
    return Object.entries(chat.users).map(([uid, payload]) => buildParticipant(uid, payload));
  }

  return [];
}

function getMessagePreview(payload) {
  const text = String(payload?.text || '').trim();
  if (text) return text;
  if (payload?.type === 'image') return 'Fotograf gonderdi';
  if (payload?.type === 'video') return 'Video gonderdi';
  if (payload?.type === 'audio') return 'Ses kaydi gonderdi';
  if (payload?.type === 'file') return 'Dosya gonderdi';
  return 'Yeni mesaj';
}

export function subscribeChatList(userId, onNext, onError) {
  const chatsQuery = query(collection(db, 'chats'), where('userIds', 'array-contains', userId));
  return onSnapshot(
    chatsQuery,
    (snapshot) => {
      const chats = snapshot.docs
        .map((item) => ({ id: item.id, ...item.data() }))
        .sort((left, right) => new Date(right.lastMessageTime || 0) - new Date(left.lastMessageTime || 0));
      onNext(chats);
    },
    onError
  );
}

export function subscribeMessages(chatId, onNext, onError) {
  const messagesQuery = query(
    collection(db, 'chats', chatId, 'messages'),
    orderBy('timestamp', 'asc')
  );

  return onSnapshot(
    messagesQuery,
    (snapshot) => {
      onNext(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
    },
    onError
  );
}

export function subscribeChat(chatId, onNext, onError) {
  return onSnapshot(
    doc(db, 'chats', chatId),
    (snapshot) => {
      if (snapshot.exists()) {
        onNext({ id: snapshot.id, ...snapshot.data() });
      }
    },
    onError
  );
}

export async function sendMessage(chatId, payload) {
  const timestamp = nowIso();

  await addDoc(collection(db, 'chats', chatId, 'messages'), {
    ...payload,
    timestamp,
  });

  await setDoc(
    doc(db, 'chats', chatId),
    {
      lastMessage: getMessagePreview(payload),
      lastMessageSenderId: payload.senderId,
      lastMessageTime: timestamp,
      updatedAt: timestamp,
    },
    { merge: true }
  );

  try {
    const chatSnapshot = await getDoc(doc(db, 'chats', chatId));
    if (!chatSnapshot.exists()) {
      return;
    }

    const chatData = { id: chatSnapshot.id, ...chatSnapshot.data() };
    const recipients = getChatParticipants(chatData)
      .map((participant) => participant.uid)
      .filter((uid) => uid && uid !== payload.senderId);

    if (recipients.length) {
      const title = chatData.groupName
        ? `${chatData.groupName} grubunda yeni mesaj`
        : `${payload.senderName || 'Kullanici'} sana mesaj gonderdi`;
      await createAppNotifications(recipients, {
        title,
        message: `${payload.senderName || 'Kullanici'}: ${getMessagePreview(payload)}`,
        type: 'chat_message',
        data: {
          chatId,
          senderId: payload.senderId,
          senderName: payload.senderName || '',
          chatType: chatData.type || 'direct',
        },
      });
    }
  } catch (error) {
    console.warn('Sohbet bildirimi gonderilemedi:', error.message);
  }
}

export async function createOrReuseDirectChat({ currentUser, targetUser }) {
  const existingQuery = query(
    collection(db, 'chats'),
    where('type', '==', 'direct'),
    where('userIds', 'array-contains', currentUser.uid),
    limit(25)
  );

  const existing = await getDocs(existingQuery);
  const found = existing.docs.find((item) => {
    const data = item.data();
    return Array.isArray(data.userIds) && data.userIds.includes(targetUser.id);
  });

  if (found) {
    return found.id;
  }

  const created = await addDoc(collection(db, 'chats'), {
    type: 'direct',
    participants: [
      buildParticipant(currentUser.uid, { ...currentUser, groupRole: 'admin' }),
      buildParticipant(targetUser.id, { ...targetUser, groupRole: 'member' }),
    ],
    users: {
      [currentUser.uid]: { name: currentUser.name, email: currentUser.email || '', role: currentUser.role || 'user', groupRole: 'admin', avatarUrl: currentUser.avatarUrl || currentUser.photoURL || currentUser.photoUrl || '' },
      [targetUser.id]: { name: targetUser.name, email: targetUser.email || '', role: targetUser.role || 'user', groupRole: 'member', avatarUrl: targetUser.avatarUrl || targetUser.photoURL || targetUser.photoUrl || '' },
    },
    userIds: [currentUser.uid, targetUser.id],
    userEmails: [currentUser.email, targetUser.email].filter(Boolean),
    createdAt: nowIso(),
    updatedAt: nowIso(),
    lastMessage: '',
    lastMessageTime: nowIso(),
  });

  return created.id;
}

export async function createGroupChat({ currentUser, groupName, groupDescription, emails }) {
  const normalizedName = String(groupName || '').trim();
  if (!normalizedName) {
    throw new Error('Grup adi zorunludur.');
  }

  const emailList = Array.from(new Set((Array.isArray(emails) ? emails : []).map((item) => String(item || '').trim().toLowerCase()).filter(Boolean)));
  if (currentUser?.email && !emailList.includes(String(currentUser.email).trim().toLowerCase())) {
    emailList.push(String(currentUser.email).trim().toLowerCase());
  }

  const participants = [];
  for (const email of emailList) {
    const user = email === String(currentUser?.email || '').trim().toLowerCase()
      ? { id: currentUser.uid, ...currentUser }
      : await findUserByEmail(email);
    if (!user) {
      throw new Error(`Kullanici bulunamadi: ${email}`);
    }
    participants.push(buildParticipant(user.id, { ...user, groupRole: user.id === currentUser.uid ? 'admin' : 'member' }));
  }

  const uniqueParticipants = ensureGroupAdmins(
    Array.from(new Map(participants.map((item) => [item.uid, item])).values()),
    currentUser.uid,
  );

  const created = await addDoc(collection(db, 'chats'), {
    type: 'group',
    groupName: normalizedName,
    groupDescription: String(groupDescription || '').trim(),
    createdBy: currentUser.uid,
    participants: uniqueParticipants,
    users: buildUsersMap(uniqueParticipants),
    userIds: uniqueParticipants.map((item) => item.uid),
    userEmails: uniqueParticipants.map((item) => item.email).filter(Boolean),
    createdAt: nowIso(),
    updatedAt: nowIso(),
    lastMessage: '',
    lastMessageTime: nowIso(),
  });

  return {
    id: created.id,
    type: 'group',
    groupName: normalizedName,
    groupDescription: String(groupDescription || '').trim(),
    participants: uniqueParticipants,
    users: buildUsersMap(uniqueParticipants),
    userIds: uniqueParticipants.map((item) => item.uid),
  };
}

export async function startVoiceCall({ chat, caller }) {
  const participants = Array.isArray(chat?.participants) ? chat.participants : [];
  const participantIds = participants.map((item) => item.uid).filter(Boolean);
  const uniqueParticipantIds = Array.from(new Set([caller.uid, ...participantIds]));
  const now = nowIso();

  const existingCallsSnapshot = await getDocs(query(collection(db, 'calls'), where('chatId', '==', chat.id)));
  const existingActiveCall = existingCallsSnapshot.docs
    .map((item) => ({ id: item.id, ...item.data() }))
    .sort((left, right) => new Date(right.updatedAt || right.createdAt || 0).getTime() - new Date(left.updatedAt || left.createdAt || 0).getTime())
    .find((call) => ['ringing', 'connecting', 'active'].includes(call.status));

  if (existingActiveCall) {
    return existingActiveCall.id;
  }

  const created = await addDoc(collection(db, 'calls'), {
    chatId: chat.id,
    participants: uniqueParticipantIds,
    callerId: caller.uid,
    callerName: caller.name,
    status: 'ringing',
    mode: 'voice',
    offer: null,
    answer: null,
    createdAt: now,
    updatedAt: now,
  });

  return created.id;
}

export function subscribeChatCalls(chatId, onNext, onError) {
  const callsQuery = query(collection(db, 'calls'), where('chatId', '==', chatId));

  return onSnapshot(
    callsQuery,
    (snapshot) => {
      const calls = snapshot.docs
        .map((item) => ({ id: item.id, ...item.data() }))
        .sort((left, right) => new Date(right.updatedAt || right.createdAt || 0).getTime() - new Date(left.updatedAt || left.createdAt || 0).getTime());
      onNext(calls);
    },
    onError,
  );
}

export function subscribeVoiceCall(callId, onNext, onError) {
  return onSnapshot(
    doc(db, 'calls', callId),
    (snapshot) => {
      if (!snapshot.exists()) {
        return;
      }

      onNext({ id: snapshot.id, ...snapshot.data() });
    },
    onError,
  );
}

export async function setVoiceCallOffer({ callId, offer, callerName }) {
  await updateDoc(doc(db, 'calls', callId), {
    offer,
    callerName: callerName || 'Kullanici',
    offerCreatedAt: nowIso(),
    updatedAt: nowIso(),
    status: 'ringing',
  });
}

export async function setVoiceCallAnswer({ callId, answer, calleeId, calleeName }) {
  await updateDoc(doc(db, 'calls', callId), {
    answer,
    answeredBy: calleeId,
    answeredByName: calleeName || 'Kullanici',
    answeredAt: nowIso(),
    updatedAt: nowIso(),
    status: 'active',
  });
}

export async function addVoiceCallCandidate({ callId, candidateCollection, candidate, senderId }) {
  await addDoc(collection(db, 'calls', callId, candidateCollection), {
    candidate,
    senderId,
    createdAt: nowIso(),
  });
}

export function subscribeVoiceCallCandidates(callId, candidateCollection, onNext, onError) {
  const candidatesQuery = query(
    collection(db, 'calls', callId, candidateCollection),
    orderBy('createdAt', 'asc'),
  );

  return onSnapshot(
    candidatesQuery,
    (snapshot) => {
      onNext(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
    },
    onError,
  );
}

export async function acceptVoiceCall({ callId, calleeId, calleeName }) {
  await updateDoc(doc(db, 'calls', callId), {
    status: 'connecting',
    answeredBy: calleeId,
    answeredByName: calleeName || 'Kullanici',
    acceptedAt: nowIso(),
    updatedAt: nowIso(),
  });
}

export async function declineVoiceCall({ callId, calleeId }) {
  await updateDoc(doc(db, 'calls', callId), {
    status: 'declined',
    declinedBy: calleeId,
    endedAt: nowIso(),
    updatedAt: nowIso(),
  });
}

export async function cancelVoiceCall({ callId, callerId }) {
  await updateDoc(doc(db, 'calls', callId), {
    status: 'cancelled',
    cancelledBy: callerId,
    endedAt: nowIso(),
    updatedAt: nowIso(),
  });
}

export async function endVoiceCall({ callId, endedBy }) {
  await updateDoc(doc(db, 'calls', callId), {
    status: 'ended',
    endedBy,
    endedAt: nowIso(),
    updatedAt: nowIso(),
  });
}

export async function clearChatMessages(chatId, requesterId) {
  const now = nowIso();

  // Update the chat document with a clearedAt marker (this always succeeds for participants).
  await setDoc(
    doc(db, 'chats', chatId),
    {
      lastMessage: '',
      lastMessageSenderId: requesterId,
      lastMessageTime: now,
      updatedAt: now,
      clearedAt: now,
    },
    { merge: true }
  );

  // Best-effort: silently try to soft-delete each message document.
  // If Firestore rules block updating other users' messages, we ignore the error —
  // the UI already hides them via the clearedAt timestamp.
  try {
    const snapshot = await getDocs(collection(db, 'chats', chatId, 'messages'));
    const writes = snapshot.docs.map((item) =>
      updateDoc(doc(db, 'chats', chatId, 'messages', item.id), {
        text: '',
        deleted: true,
        deletedAt: now,
        mediaUrl: null,
        mediaMime: null,
      })
    );
    await Promise.all(writes);
  } catch (_) {
    // Silently ignored — UI visibility is controlled by clearedAt above.
  }

  return now;
}

export async function markMessageDeleted(chatId, messageId) {
  await updateDoc(doc(db, 'chats', chatId, 'messages', messageId), {
    text: '',
    deleted: true,
    deletedAt: nowIso(),
    mediaUrl: null,
    mediaMime: null,
  });
}

export async function updateGroupChatSettings({ chatId, groupName, groupDescription, groupPhotoUrl }) {
  const payload = {
    groupName: String(groupName || '').trim(),
    groupDescription: String(groupDescription || '').trim(),
    updatedAt: nowIso(),
  };

  if (typeof groupPhotoUrl === 'string') {
    payload.groupPhotoUrl = groupPhotoUrl.trim();
  }

  await setDoc(
    doc(db, 'chats', chatId),
    payload,
    { merge: true }
  );
}

export async function addGroupMemberByEmail({ chatId, email }) {
  const targetEmail = String(email || '').trim().toLowerCase();
  if (!targetEmail) {
    throw new Error('E-posta gerekli.');
  }

  const userSnapshot = await getDocs(query(collection(db, 'users'), where('email', '==', targetEmail), limit(1)));
  if (userSnapshot.empty) {
    throw new Error('Bu e-posta ile kullanici bulunamadi.');
  }

  const targetUser = { id: userSnapshot.docs[0].id, ...userSnapshot.docs[0].data() };
  const chatSnapshot = await getDoc(doc(db, 'chats', chatId));
  if (!chatSnapshot.exists()) {
    throw new Error('Sohbet bulunamadi.');
  }

  const chatData = chatSnapshot.data();
  const currentParticipants = getChatParticipants(chatData);
  if (currentParticipants.some((item) => item.uid === targetUser.id)) {
    return targetUser;
  }

  const nextParticipants = ensureGroupAdmins([
    ...currentParticipants,
    buildParticipant(targetUser.id, { ...targetUser, groupRole: 'member' }),
  ], chatData.createdBy || currentParticipants[0]?.uid || '');

  await setDoc(
    doc(db, 'chats', chatId),
    {
      participants: nextParticipants,
      users: buildUsersMap(nextParticipants),
      userIds: nextParticipants.map((item) => item.uid).filter(Boolean),
      userEmails: nextParticipants.map((item) => item.email).filter(Boolean),
      createdBy: chatData.createdBy || nextParticipants.find((item) => item.groupRole === 'admin')?.uid || '',
      updatedAt: nowIso(),
    },
    { merge: true }
  );

  return targetUser;
}

export async function updateGroupMemberRole({ chatId, memberId, groupRole }) {
  const chatSnapshot = await getDoc(doc(db, 'chats', chatId));
  if (!chatSnapshot.exists()) {
    throw new Error('Sohbet bulunamadi.');
  }

  const chatData = chatSnapshot.data() || {};
  const currentParticipants = getChatParticipants(chatData);
  const nextParticipants = ensureGroupAdmins(
    currentParticipants.map((participant) => (
      participant.uid === memberId
        ? { ...participant, groupRole: normalizeGroupRole(groupRole) }
        : participant
    )),
    chatData.createdBy || memberId,
  );

  await setDoc(
    doc(db, 'chats', chatId),
    {
      participants: nextParticipants,
      users: buildUsersMap(nextParticipants),
      createdBy: nextParticipants.find((participant) => participant.groupRole === 'admin')?.uid || '',
      updatedAt: nowIso(),
    },
    { merge: true }
  );
}

export async function removeGroupMember({ chatId, memberId }) {
  const chatSnapshot = await getDoc(doc(db, 'chats', chatId));
  if (!chatSnapshot.exists()) {
    throw new Error('Sohbet bulunamadi.');
  }

  const chatData = chatSnapshot.data();
  const currentParticipants = getChatParticipants(chatData);
  const nextParticipants = ensureGroupAdmins(
    currentParticipants.filter((item) => item.uid !== memberId),
    chatData.createdBy || currentParticipants[0]?.uid || '',
  );

  await setDoc(
    doc(db, 'chats', chatId),
    {
      participants: nextParticipants,
      users: buildUsersMap(nextParticipants),
      userIds: nextParticipants.map((item) => item.uid).filter(Boolean),
      userEmails: nextParticipants.map((item) => item.email).filter(Boolean),
      createdBy: nextParticipants.find((item) => item.groupRole === 'admin')?.uid || '',
      updatedAt: nowIso(),
    },
    { merge: true }
  );
}

export async function leaveGroupChat({ chatId, memberId }) {
  const chatSnapshot = await getDoc(doc(db, 'chats', chatId));
  if (!chatSnapshot.exists()) {
    throw new Error('Sohbet bulunamadi.');
  }

  const chatData = chatSnapshot.data() || {};
  const currentParticipants = getChatParticipants(chatData);
  const nextParticipants = ensureGroupAdmins(
    currentParticipants.filter((item) => item.uid !== memberId),
    chatData.createdBy || currentParticipants[0]?.uid || '',
  );

  if (!nextParticipants.length) {
    const messagesSnapshot = await getDocs(collection(db, 'chats', chatId, 'messages'));
    await Promise.all(messagesSnapshot.docs.map((item) => deleteDoc(doc(db, 'chats', chatId, 'messages', item.id))));
    await deleteDoc(doc(db, 'chats', chatId));
    return { deleted: true };
  }

  await setDoc(
    doc(db, 'chats', chatId),
    {
      participants: nextParticipants,
      users: buildUsersMap(nextParticipants),
      userIds: nextParticipants.map((item) => item.uid).filter(Boolean),
      userEmails: nextParticipants.map((item) => item.email).filter(Boolean),
      createdBy: nextParticipants.find((item) => item.groupRole === 'admin')?.uid || '',
      updatedAt: nowIso(),
    },
    { merge: true }
  );

  return { deleted: false };
}