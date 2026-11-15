import type { User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { DEFAULT_SETTINGS, DEFAULT_WHISPER_CONFIG } from '../data/defaults';
import type {
  ActivityEvent,
  ChatConversation,
  CustomMode,
  UserProfileDoc,
  VocabularyItem,
  VoiceHistoryEntry,
  VoxifySettings,
  WhisperConfig,
} from '../types/voxify';
import { db, handleFirestoreError, OperationType } from './firebase';

function sanitizeId(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
  return cleaned || `id_${Date.now()}`;
}

function clampStr(val: string | undefined | null, max: number): string {
  return String(val ?? '').slice(0, max);
}

export async function ensureUserProfile(user: User): Promise<UserProfileDoc> {
  const path = `users/${user.uid}`;
  const ref = doc(db, 'users', user.uid);
  try {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const data = snap.data() as UserProfileDoc;
      return {
        ...data,
        settings: {
          general: {
            ...DEFAULT_SETTINGS.general,
            ...(data.settings?.general || {}),
            userName:
              data.settings?.general?.userName ||
              data.displayName ||
              user.displayName ||
              user.email?.split('@')[0] ||
              'User',
          },
          voice: { ...DEFAULT_SETTINGS.voice, ...(data.settings?.voice || {}) },
          ai: { ...DEFAULT_SETTINGS.ai, ...(data.settings?.ai || {}) },
          privacy: { ...DEFAULT_SETTINGS.privacy, ...(data.settings?.privacy || {}) },
        },
        whisperConfig: { ...DEFAULT_WHISPER_CONFIG, ...(data.whisperConfig || {}) },
      };
    }

    const displayName = clampStr(
      user.displayName || user.email?.split('@')[0] || 'VOXIFY User',
      120
    );
    const email = clampStr(user.email || 'user@voxify.local', 254);

    const initialSettings: VoxifySettings = {
      ...DEFAULT_SETTINGS,
      general: {
        ...DEFAULT_SETTINGS.general,
        userName: displayName,
      },
    };

    const payload = {
      uid: user.uid,
      displayName,
      email,
      plan: 'Free' as const,
      settings: initialSettings,
      whisperConfig: DEFAULT_WHISPER_CONFIG,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    await setDoc(ref, payload);
    return {
      uid: user.uid,
      displayName,
      email,
      plan: 'Free',
      settings: initialSettings,
      whisperConfig: DEFAULT_WHISPER_CONFIG,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export function subscribeUserProfile(
  uid: string,
  onData: (profile: UserProfileDoc) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const path = `users/${uid}`;
  return onSnapshot(
    doc(db, 'users', uid),
    (snap) => {
      if (snap.exists()) {
        onData(snap.data() as UserProfileDoc);
      }
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, path);
      } catch (wrapped) {
        onError(wrapped as Error);
      }
    }
  );
}

export async function saveUserSettings(uid: string, settings: VoxifySettings): Promise<void> {
  const path = `users/${uid}`;
  try {
    await updateDoc(doc(db, 'users', uid), {
      displayName: clampStr(settings.general.userName || 'VOXIFY User', 120),
      settings,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function saveUserWhisperConfig(uid: string, whisperConfig: WhisperConfig): Promise<void> {
  const path = `users/${uid}`;
  try {
    await updateDoc(doc(db, 'users', uid), {
      whisperConfig,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

// History Subcollection
export function subscribeHistory(
  uid: string,
  pageSize: number,
  onData: (entries: VoiceHistoryEntry[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const path = `users/${uid}/history`;
  const q = query(
    collection(db, 'users', uid, 'history'),
    orderBy('createdAt', 'desc'),
    limit(pageSize)
  );
  return onSnapshot(
    q,
    (snap) => {
      const items: VoiceHistoryEntry[] = snap.docs.map((d) => {
        const raw = d.data();
        return {
          id: d.id,
          uid: raw.uid,
          title: raw.title,
          transcript: raw.transcript,
          durationSec: Number(raw.durationSec || 0),
          wordCount: Number(raw.wordCount || 0),
          languageId: raw.languageId,
          languageName: raw.languageName,
          engineUsed: raw.engineUsed,
          modeUsed: raw.modeUsed,
          createdAt: raw.createdAt?.toDate ? raw.createdAt.toDate().toISOString() : new Date().toISOString(),
          updatedAt: raw.updatedAt?.toDate ? raw.updatedAt.toDate().toISOString() : undefined,
        };
      });
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped as Error);
      }
    }
  );
}

export async function createHistoryEntry(
  uid: string,
  entry: Omit<VoiceHistoryEntry, 'id' | 'createdAt' | 'uid'>
): Promise<string> {
  const entryId = sanitizeId(`hist_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
  const path = `users/${uid}/history/${entryId}`;
  try {
    const payload: Record<string, unknown> = {
      id: entryId,
      uid,
      title: clampStr(entry.title.trim() || 'Voice Note', 200),
      transcript: clampStr(entry.transcript.trim(), 50000),
      durationSec: Math.max(0, Math.min(86400, Math.round(entry.durationSec))),
      wordCount: Math.max(0, Math.min(50000, Math.round(entry.wordCount))),
      languageId: clampStr(entry.languageId, 32),
      languageName: clampStr(entry.languageName, 80),
      engineUsed: clampStr(entry.engineUsed, 80),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (entry.modeUsed) {
      payload.modeUsed = clampStr(entry.modeUsed, 80);
    }
    await setDoc(doc(db, 'users', uid, 'history', entryId), payload);
    return entryId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateHistoryEntryDoc(
  uid: string,
  entry: VoiceHistoryEntry
): Promise<void> {
  const path = `users/${uid}/history/${entry.id}`;
  try {
    const payload: Record<string, unknown> = {
      title: clampStr(entry.title.trim() || 'Untitled Transcript', 200),
      transcript: clampStr(entry.transcript, 50000),
      wordCount: Math.max(0, Math.min(50000, Math.round(entry.wordCount))),
      updatedAt: serverTimestamp(),
    };
    if (entry.modeUsed !== undefined) {
      payload.modeUsed = clampStr(entry.modeUsed, 80);
    }
    await updateDoc(doc(db, 'users', uid, 'history', entry.id), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteHistoryEntryDoc(uid: string, entryId: string): Promise<void> {
  const path = `users/${uid}/history/${entryId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'history', entryId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// Conversations Subcollection
export function subscribeConversations(
  uid: string,
  pageSize: number,
  onData: (chats: ChatConversation[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const path = `users/${uid}/conversations`;
  const q = query(
    collection(db, 'users', uid, 'conversations'),
    orderBy('updatedAt', 'desc'),
    limit(pageSize)
  );
  return onSnapshot(
    q,
    (snap) => {
      const items: ChatConversation[] = snap.docs.map((d) => {
        const raw = d.data();
        return {
          id: d.id,
          uid: raw.uid,
          title: raw.title,
          mode: raw.mode,
          messages: Array.isArray(raw.messages) ? raw.messages : [],
          createdAt: raw.createdAt?.toDate ? raw.createdAt.toDate().toISOString() : undefined,
          updatedAt: raw.updatedAt?.toDate ? raw.updatedAt.toDate().toISOString() : new Date().toISOString(),
        };
      });
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped as Error);
      }
    }
  );
}

export async function saveConversationDoc(
  uid: string,
  conv: ChatConversation,
  isNew: boolean
): Promise<void> {
  const chatId = sanitizeId(conv.id);
  const path = `users/${uid}/conversations/${chatId}`;
  const boundedMessages = conv.messages.slice(-200).map((m) => ({
    id: m.id,
    role: m.role,
    content: clampStr(m.content, 24000),
    timestamp: m.timestamp,
    ...(m.model ? { model: m.model } : {}),
  }));

  try {
    if (isNew) {
      await setDoc(doc(db, 'users', uid, 'conversations', chatId), {
        id: chatId,
        uid,
        title: clampStr(conv.title.trim() || 'New Conversation', 200),
        mode: clampStr(conv.mode, 80),
        messages: boundedMessages,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(doc(db, 'users', uid, 'conversations', chatId), {
        title: clampStr(conv.title.trim() || 'New Conversation', 200),
        mode: clampStr(conv.mode, 80),
        messages: boundedMessages,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, isNew ? OperationType.CREATE : OperationType.UPDATE, path);
  }
}

export async function deleteConversationDoc(uid: string, chatId: string): Promise<void> {
  const path = `users/${uid}/conversations/${chatId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'conversations', chatId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// Custom Modes Subcollection
export function subscribeModes(
  uid: string,
  onData: (modes: CustomMode[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const path = `users/${uid}/modes`;
  const q = query(collection(db, 'users', uid, 'modes'), orderBy('updatedAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => {
      const items: CustomMode[] = snap.docs.map((d) => {
        const raw = d.data();
        return {
          id: d.id,
          uid: raw.uid,
          name: raw.name,
          description: raw.description,
          instructions: raw.instructions,
          tone: raw.tone,
          language: raw.language,
          isPredefined: Boolean(raw.isPredefined),
          createdAt: raw.createdAt?.toDate ? raw.createdAt.toDate().toISOString() : undefined,
          updatedAt: raw.updatedAt?.toDate ? raw.updatedAt.toDate().toISOString() : new Date().toISOString(),
        };
      });
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped as Error);
      }
    }
  );
}

export async function saveCustomModeDoc(
  uid: string,
  mode: CustomMode,
  isNew: boolean
): Promise<void> {
  const modeId = sanitizeId(mode.id);
  const path = `users/${uid}/modes/${modeId}`;
  try {
    if (isNew) {
      await setDoc(doc(db, 'users', uid, 'modes', modeId), {
        id: modeId,
        uid,
        name: clampStr(mode.name.trim(), 100),
        description: clampStr(mode.description.trim(), 400),
        instructions: clampStr(mode.instructions.trim(), 4000),
        tone: clampStr(mode.tone.trim(), 100),
        language: clampStr(mode.language.trim(), 80),
        isPredefined: Boolean(mode.isPredefined),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(doc(db, 'users', uid, 'modes', modeId), {
        name: clampStr(mode.name.trim(), 100),
        description: clampStr(mode.description.trim(), 400),
        instructions: clampStr(mode.instructions.trim(), 4000),
        tone: clampStr(mode.tone.trim(), 100),
        language: clampStr(mode.language.trim(), 80),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, isNew ? OperationType.CREATE : OperationType.UPDATE, path);
  }
}

export async function deleteCustomModeDoc(uid: string, modeId: string): Promise<void> {
  const path = `users/${uid}/modes/${modeId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'modes', modeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// Vocabulary Subcollection
export function subscribeVocabulary(
  uid: string,
  onData: (items: VocabularyItem[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const path = `users/${uid}/vocabulary`;
  const q = query(collection(db, 'users', uid, 'vocabulary'), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => {
      const items: VocabularyItem[] = snap.docs.map((d) => {
        const raw = d.data();
        return {
          id: d.id,
          uid: raw.uid,
          term: raw.term,
          spokenAlias: raw.spokenAlias || '',
          category: raw.category,
          notes: raw.notes,
          createdAt: raw.createdAt?.toDate ? raw.createdAt.toDate().toISOString() : new Date().toISOString(),
          updatedAt: raw.updatedAt?.toDate ? raw.updatedAt.toDate().toISOString() : undefined,
        };
      });
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped as Error);
      }
    }
  );
}

export async function createVocabularyDoc(
  uid: string,
  item: Omit<VocabularyItem, 'id' | 'createdAt' | 'uid'>
): Promise<void> {
  const vocabId = sanitizeId(`vocab_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
  const path = `users/${uid}/vocabulary/${vocabId}`;
  try {
    const payload: Record<string, unknown> = {
      id: vocabId,
      uid,
      term: clampStr(item.term.trim(), 160),
      spokenAlias: clampStr(item.spokenAlias.trim(), 160),
      category: item.category,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (item.notes?.trim()) {
      payload.notes = clampStr(item.notes.trim(), 300);
    }
    await setDoc(doc(db, 'users', uid, 'vocabulary', vocabId), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateVocabularyDoc(uid: string, item: VocabularyItem): Promise<void> {
  const path = `users/${uid}/vocabulary/${item.id}`;
  try {
    const payload: Record<string, unknown> = {
      term: clampStr(item.term.trim(), 160),
      spokenAlias: clampStr(item.spokenAlias.trim(), 160),
      category: item.category,
      notes: clampStr(item.notes?.trim() || '', 300),
      updatedAt: serverTimestamp(),
    };
    await updateDoc(doc(db, 'users', uid, 'vocabulary', item.id), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteVocabularyDoc(uid: string, vocabId: string): Promise<void> {
  const path = `users/${uid}/vocabulary/${vocabId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'vocabulary', vocabId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// Activity Subcollection
export function subscribeActivity(
  uid: string,
  onData: (events: ActivityEvent[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const path = `users/${uid}/activity`;
  const q = query(
    collection(db, 'users', uid, 'activity'),
    orderBy('createdAt', 'desc'),
    limit(200)
  );
  return onSnapshot(
    q,
    (snap) => {
      const items: ActivityEvent[] = snap.docs.map((d) => {
        const raw = d.data();
        return {
          id: d.id,
          uid: raw.uid,
          date: raw.date,
          type: raw.type,
          words: Number(raw.words || 0),
          durationSec: Number(raw.durationSec || 0),
          languageName: raw.languageName,
          aiMode: raw.aiMode,
          createdAt: raw.createdAt?.toDate ? raw.createdAt.toDate().toISOString() : undefined,
        };
      });
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped as Error);
      }
    }
  );
}

export async function createActivityEventDoc(
  uid: string,
  event: Omit<ActivityEvent, 'id' | 'date' | 'uid' | 'createdAt'>
): Promise<void> {
  const actId = sanitizeId(`act_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
  const path = `users/${uid}/activity/${actId}`;
  try {
    const payload: Record<string, unknown> = {
      id: actId,
      uid,
      date: new Date().toISOString().slice(0, 10),
      type: event.type,
      words: Math.max(0, Math.min(100000, Math.round(event.words))),
      durationSec: Math.max(0, Math.min(86400, Math.round(event.durationSec))),
      createdAt: serverTimestamp(),
    };
    if (event.languageName) {
      payload.languageName = clampStr(event.languageName, 80);
    }
    if (event.aiMode) {
      payload.aiMode = clampStr(event.aiMode, 80);
    }
    await setDoc(doc(db, 'users', uid, 'activity', actId), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

// Batch Collection Clearing
async function clearSubcollection(uid: string, subName: string): Promise<void> {
  const path = `users/${uid}/${subName}`;
  try {
    const snap = await getDocs(collection(db, 'users', uid, subName));
    if (snap.empty) return;
    const batch = writeBatch(db);
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function clearUserHistory(uid: string): Promise<void> {
  await clearSubcollection(uid, 'history');
}

export async function clearUserConversations(uid: string): Promise<void> {
  await clearSubcollection(uid, 'conversations');
}

export async function resetUserWorkspace(uid: string, user: User): Promise<void> {
  await Promise.all([
    clearSubcollection(uid, 'history'),
    clearSubcollection(uid, 'conversations'),
    clearSubcollection(uid, 'modes'),
    clearSubcollection(uid, 'vocabulary'),
    clearSubcollection(uid, 'activity'),
  ]);
  const displayName = clampStr(
    user.displayName || user.email?.split('@')[0] || 'VOXIFY User',
    120
  );
  await saveUserSettings(uid, {
    ...DEFAULT_SETTINGS,
    general: { ...DEFAULT_SETTINGS.general, userName: displayName },
  });
}
