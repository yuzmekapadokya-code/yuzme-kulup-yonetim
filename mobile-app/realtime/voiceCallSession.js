import { Platform } from 'react-native';
import { Audio } from 'expo-av';

import {
  addVoiceCallCandidate,
  setVoiceCallAnswer,
  setVoiceCallOffer,
  subscribeVoiceCall,
  subscribeVoiceCallCandidates,
} from '../api/chatApi';

const ICE_CONFIGURATION = {
  iceServers: [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
  ],
};

const baseSessionState = {
  available: null,
  availabilityReason: '',
  usingNativeModule: false,
  callId: '',
  direction: '',
  phase: 'idle',
  connectionState: 'new',
  localMuted: false,
  remoteConnected: false,
  remoteDisplayName: '',
  errorMessage: '',
};

const sessionListeners = new Set();

let sessionState = { ...baseSessionState };
let runtimeToken = 0;
let peerConnection = null;
let localStream = null;
let remoteStream = null;
let remoteAudioElement = null;
let callUnsubscribe = null;
let candidateUnsubscribes = [];
let processedCandidateIds = new Set();
let nativeRtcModule;
let globalsRegistered = false;
let signalingState = {
  remoteOfferApplied: false,
  remoteAnswerApplied: false,
};

function emitSession(nextPatch) {
  sessionState = { ...sessionState, ...nextPatch };
  sessionListeners.forEach((listener) => listener(sessionState));
}

function resetSignalingState() {
  signalingState = {
    remoteOfferApplied: false,
    remoteAnswerApplied: false,
  };
}

function getNativeRtcModule() {
  if (Platform.OS === 'web') {
    return null;
  }

  if (nativeRtcModule !== undefined) {
    return nativeRtcModule;
  }

  try {
    nativeRtcModule = require('react-native-webrtc');
    if (typeof nativeRtcModule.registerGlobals === 'function' && !globalsRegistered) {
      nativeRtcModule.registerGlobals();
      globalsRegistered = true;
    }
  } catch (error) {
    console.warn('react-native-webrtc yuklenemedi:', error.message);
    nativeRtcModule = null;
  }

  return nativeRtcModule;
}

function getRtcPrimitives() {
  if (Platform.OS === 'web') {
    return {
      RTCPeerConnection: globalThis.RTCPeerConnection,
      RTCSessionDescription: globalThis.RTCSessionDescription,
      RTCIceCandidate: globalThis.RTCIceCandidate,
      mediaDevices: globalThis.navigator?.mediaDevices,
      usingNativeModule: false,
    };
  }

  const module = getNativeRtcModule();
  if (!module) {
    return null;
  }

  return {
    RTCPeerConnection: module.RTCPeerConnection,
    RTCSessionDescription: module.RTCSessionDescription,
    RTCIceCandidate: module.RTCIceCandidate,
    mediaDevices: module.mediaDevices,
    usingNativeModule: true,
  };
}

export function getVoiceCallSupport() {
  const primitives = getRtcPrimitives();
  const available = Boolean(
    primitives?.RTCPeerConnection
      && primitives?.RTCSessionDescription
      && primitives?.RTCIceCandidate
      && primitives?.mediaDevices?.getUserMedia,
  );

  if (available) {
    return {
      available: true,
      reason: '',
      usingNativeModule: Boolean(primitives?.usingNativeModule),
    };
  }

  return {
    available: false,
    reason: Platform.OS === 'web'
      ? 'Tarayici WebRTC destegi bulunamadi.'
      : 'Bu build WebRTC icermiyor. Expo Go yerine custom dev build veya preview/production build kullanin.',
    usingNativeModule: false,
  };
}

function ensureSupportOrThrow() {
  const support = getVoiceCallSupport();
  emitSession({
    available: support.available,
    availabilityReason: support.reason,
    usingNativeModule: support.usingNativeModule,
  });

  if (!support.available) {
    throw new Error(support.reason);
  }

  return support;
}

async function setCallAudioMode(active) {
  if (Platform.OS === 'web') {
    return;
  }

  try {
    if (active) {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: false,
        playThroughEarpieceAndroid: false,
        staysActiveInBackground: false,
      });
      return;
    }

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: false,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
      staysActiveInBackground: false,
    });
  } catch (error) {
    console.warn('Ses modu guncellenemedi:', error.message);
  }
}

async function attachRemoteAudioStream(stream) {
  if (Platform.OS !== 'web' || typeof document === 'undefined') {
    return;
  }

  if (!remoteAudioElement) {
    remoteAudioElement = document.createElement('audio');
    remoteAudioElement.autoplay = true;
    remoteAudioElement.playsInline = true;
    remoteAudioElement.style.display = 'none';
    document.body.appendChild(remoteAudioElement);
  }

  remoteAudioElement.srcObject = stream;

  try {
    await remoteAudioElement.play();
  } catch (error) {
    console.warn('Uzak ses akisi oynatilamadi:', error.message);
  }
}

function stopStreamTracks(stream) {
  if (!stream || typeof stream.getTracks !== 'function') {
    return;
  }

  stream.getTracks().forEach((track) => {
    try {
      track.stop();
    } catch (error) {
      console.warn('Track durdurulamadi:', error.message);
    }
  });
}

function serializeDescription(description) {
  if (!description) {
    return null;
  }

  return {
    type: description.type,
    sdp: description.sdp,
  };
}

function serializeCandidate(candidate) {
  if (!candidate) {
    return null;
  }

  if (typeof candidate.toJSON === 'function') {
    return candidate.toJSON();
  }

  return {
    candidate: candidate.candidate,
    sdpMid: candidate.sdpMid,
    sdpMLineIndex: candidate.sdpMLineIndex,
    usernameFragment: candidate.usernameFragment,
  };
}

async function createLocalAudioStream() {
  const primitives = getRtcPrimitives();
  if (!primitives?.mediaDevices?.getUserMedia) {
    throw new Error('Mikrofon akisi baslatilamadi. WebRTC modulu hazir degil.');
  }

  return primitives.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
    video: false,
  });
}

function clearSubscriptions() {
  callUnsubscribe?.();
  callUnsubscribe = null;

  candidateUnsubscribes.forEach((unsubscribe) => unsubscribe?.());
  candidateUnsubscribes = [];
  processedCandidateIds = new Set();
}

export async function disposeVoiceCallSession(options = {}) {
  runtimeToken += 1;
  clearSubscriptions();
  resetSignalingState();

  if (peerConnection) {
    try {
      peerConnection.onicecandidate = null;
      peerConnection.ontrack = null;
      peerConnection.oniceconnectionstatechange = null;
      peerConnection.onconnectionstatechange = null;
      peerConnection.close();
    } catch (error) {
      console.warn('Peer connection kapatilamadi:', error.message);
    }
  }
  peerConnection = null;

  stopStreamTracks(localStream);
  stopStreamTracks(remoteStream);
  localStream = null;
  remoteStream = null;

  if (remoteAudioElement) {
    try {
      remoteAudioElement.pause();
      remoteAudioElement.srcObject = null;
      remoteAudioElement.remove();
    } catch (error) {
      console.warn('Web ses elementi kaldirilamadi:', error.message);
    }
  }
  remoteAudioElement = null;

  await setCallAudioMode(false);

  if (options.preserveEndedState) {
    emitSession({
      phase: options.phase || 'ended',
      connectionState: options.connectionState || 'closed',
      remoteConnected: false,
      localMuted: false,
      errorMessage: options.errorMessage || '',
    });
    return;
  }

  const support = getVoiceCallSupport();
  sessionState = {
    ...baseSessionState,
    available: support.available,
    availabilityReason: support.reason,
    usingNativeModule: support.usingNativeModule,
  };
  sessionListeners.forEach((listener) => listener(sessionState));
}

function buildSessionPrimitivesOrThrow() {
  const primitives = getRtcPrimitives();
  if (!primitives?.RTCPeerConnection || !primitives?.RTCSessionDescription || !primitives?.RTCIceCandidate) {
    throw new Error('WebRTC nesneleri hazir degil. Lutfen uygulamayi custom build ile acin.');
  }
  return primitives;
}

async function createPeerConnection(callId, direction) {
  const primitives = buildSessionPrimitivesOrThrow();
  const connection = new primitives.RTCPeerConnection(ICE_CONFIGURATION);

  localStream.getTracks().forEach((track) => {
    connection.addTrack(track, localStream);
  });

  connection.ontrack = async (event) => {
    const nextRemoteStream = event.streams?.[0];
    if (!nextRemoteStream) {
      return;
    }

    remoteStream = nextRemoteStream;
    await attachRemoteAudioStream(nextRemoteStream);
    emitSession({
      remoteConnected: true,
      phase: 'active',
    });
  };

  connection.onicecandidate = (event) => {
    if (!event.candidate) {
      return;
    }

    addVoiceCallCandidate({
      callId,
      candidateCollection: direction === 'outgoing' ? 'offerCandidates' : 'answerCandidates',
      candidate: serializeCandidate(event.candidate),
      senderId: direction === 'outgoing' ? 'caller' : 'callee',
    }).catch((error) => {
      console.warn('ICE candidate kaydedilemedi:', error.message);
    });
  };

  const updateConnectionState = () => {
    const nextConnectionState = connection.connectionState || connection.iceConnectionState || 'new';
    const nextPhase = ['connected', 'completed'].includes(nextConnectionState)
      ? 'active'
      : ['connecting', 'checking'].includes(nextConnectionState)
        ? 'connecting'
        : ['disconnected', 'failed', 'closed'].includes(nextConnectionState)
          ? 'ended'
          : sessionState.phase;

    emitSession({ connectionState: nextConnectionState, phase: nextPhase });
  };

  connection.oniceconnectionstatechange = updateConnectionState;
  connection.onconnectionstatechange = updateConnectionState;

  return connection;
}

async function applyRemoteAnswerIfNeeded(callDoc, token) {
  if (token !== runtimeToken || !peerConnection || signalingState.remoteAnswerApplied || !callDoc?.answer) {
    return;
  }

  const primitives = buildSessionPrimitivesOrThrow();
  await peerConnection.setRemoteDescription(new primitives.RTCSessionDescription(callDoc.answer));
  signalingState.remoteAnswerApplied = true;
  emitSession({
    phase: 'connecting',
    remoteDisplayName: callDoc.answeredByName || sessionState.remoteDisplayName,
  });
}

async function applyRemoteOfferAndCreateAnswer(callDoc, token) {
  if (token !== runtimeToken || !peerConnection || signalingState.remoteOfferApplied || !callDoc?.offer) {
    return;
  }

  const primitives = buildSessionPrimitivesOrThrow();
  await peerConnection.setRemoteDescription(new primitives.RTCSessionDescription(callDoc.offer));
  signalingState.remoteOfferApplied = true;

  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);

  await setVoiceCallAnswer({
    callId: callDoc.id,
    answer: serializeDescription(peerConnection.localDescription || answer),
    calleeId: callDoc.answeredBy || '',
    calleeName: callDoc.answeredByName || sessionState.remoteDisplayName || 'Kullanici',
  });

  emitSession({ phase: 'connecting' });
}

function subscribeToRemoteCandidates(callId, candidateCollection, token) {
  const unsubscribe = subscribeVoiceCallCandidates(
    callId,
    candidateCollection,
    async (documents) => {
      if (token !== runtimeToken || !peerConnection) {
        return;
      }

      const primitives = buildSessionPrimitivesOrThrow();

      for (const item of documents) {
        if (!item?.id || processedCandidateIds.has(item.id) || !item.candidate) {
          continue;
        }

        try {
          await peerConnection.addIceCandidate(new primitives.RTCIceCandidate(item.candidate));
          processedCandidateIds.add(item.id);
        } catch (error) {
          console.warn('Remote ICE candidate eklenemedi:', error.message);
        }
      }
    },
    (error) => {
      if (token === runtimeToken) {
        console.warn('ICE candidate aboneligi hatasi:', error.message);
      }
    },
  );

  candidateUnsubscribes.push(unsubscribe);
}

function subscribeToCallLifecycle(callId, direction, token) {
  callUnsubscribe = subscribeVoiceCall(
    callId,
    async (callDoc) => {
      if (token !== runtimeToken || sessionState.callId !== callId) {
        return;
      }

      if (['declined', 'cancelled', 'ended'].includes(callDoc.status)) {
        await disposeVoiceCallSession({
          preserveEndedState: true,
          phase: 'ended',
          connectionState: 'closed',
          errorMessage: callDoc.status === 'declined'
            ? 'Cagri reddedildi.'
            : callDoc.status === 'cancelled'
              ? 'Cagri iptal edildi.'
              : '',
        });
        return;
      }

      if (callDoc.status === 'connecting') {
        emitSession({ phase: 'connecting' });
      }

      if (callDoc.status === 'active') {
        emitSession({
          phase: sessionState.remoteConnected ? 'active' : 'connecting',
          remoteDisplayName: callDoc.answeredByName || callDoc.callerName || sessionState.remoteDisplayName,
        });
      }

      if (direction === 'outgoing') {
        await applyRemoteAnswerIfNeeded(callDoc, token);
        return;
      }

      await applyRemoteOfferAndCreateAnswer(callDoc, token);
    },
    (error) => {
      if (token === runtimeToken) {
        emitSession({ phase: 'error', errorMessage: error.message || 'Cagri takip edilemedi.' });
      }
    },
  );
}

export async function startOutgoingVoiceCallSession({ callId, callerName, remoteDisplayName }) {
  const support = ensureSupportOrThrow();
  await disposeVoiceCallSession();
  const token = runtimeToken;

  resetSignalingState();
  emitSession({
    available: support.available,
    availabilityReason: support.reason,
    usingNativeModule: support.usingNativeModule,
    callId,
    direction: 'outgoing',
    phase: 'requesting-media',
    connectionState: 'new',
    localMuted: false,
    remoteConnected: false,
    remoteDisplayName: remoteDisplayName || '',
    errorMessage: '',
  });

  localStream = await createLocalAudioStream();
  if (token !== runtimeToken) {
    return;
  }

  await setCallAudioMode(true);
  peerConnection = await createPeerConnection(callId, 'outgoing');
  subscribeToCallLifecycle(callId, 'outgoing', token);
  subscribeToRemoteCandidates(callId, 'answerCandidates', token);

  const offer = await peerConnection.createOffer({ offerToReceiveAudio: true });
  await peerConnection.setLocalDescription(offer);
  await setVoiceCallOffer({
    callId,
    offer: serializeDescription(peerConnection.localDescription || offer),
    callerName,
  });

  emitSession({ phase: 'ringing' });
}

export async function acceptIncomingVoiceCallSession({ callId, callerName }) {
  const support = ensureSupportOrThrow();
  await disposeVoiceCallSession();
  const token = runtimeToken;

  resetSignalingState();
  emitSession({
    available: support.available,
    availabilityReason: support.reason,
    usingNativeModule: support.usingNativeModule,
    callId,
    direction: 'incoming',
    phase: 'requesting-media',
    connectionState: 'new',
    localMuted: false,
    remoteConnected: false,
    remoteDisplayName: callerName || '',
    errorMessage: '',
  });

  localStream = await createLocalAudioStream();
  if (token !== runtimeToken) {
    return;
  }

  await setCallAudioMode(true);
  peerConnection = await createPeerConnection(callId, 'incoming');
  subscribeToCallLifecycle(callId, 'incoming', token);
  subscribeToRemoteCandidates(callId, 'offerCandidates', token);
  emitSession({ phase: 'connecting' });
}

export function toggleVoiceCallMute() {
  if (!localStream || typeof localStream.getAudioTracks !== 'function') {
    return false;
  }

  const tracks = localStream.getAudioTracks();
  if (!tracks.length) {
    return false;
  }

  const nextMuted = !sessionState.localMuted;
  tracks.forEach((track) => {
    track.enabled = !nextMuted;
  });
  emitSession({ localMuted: nextMuted });
  return nextMuted;
}

export function subscribeVoiceCallSession(listener) {
  sessionListeners.add(listener);
  listener(sessionState);
  return () => {
    sessionListeners.delete(listener);
  };
}

export function getVoiceCallSessionState() {
  return sessionState;
}