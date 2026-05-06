import { randomBytes } from "crypto";

interface MediaData {
  fileId: string;
  type: "audio";
  fileName?: string;
}

interface MergeFileData {
  fileId: string;
  fileName?: string;
  duration?: number;
}

interface MergeSession {
  userId: number;
  sessionId: string;
  files: MergeFileData[];
  createdAt: number;
}

const mediaStore = new Map<string, MediaData>();
const mergeSessionStore = new Map<string, MergeSession>();

// Auto-cleanup merge sessions after 5 minutes
setInterval(() => {
  const now = Date.now();
  const fiveMinutesMs = 5 * 60 * 1000;
  for (const [sessionId, session] of mergeSessionStore.entries()) {
    if (now - session.createdAt > fiveMinutesMs) {
      mergeSessionStore.delete(sessionId);
      console.log(`Cleaned up merge session: ${sessionId}`);
    }
  }
}, 60000); // Check every minute

export function saveMedia(
  fileId: string,
  type: "audio",
  fileName?: string,
): string {
  const shortId = randomBytes(4).toString("hex"); // 8 chars
  mediaStore.set(shortId, { fileId, type, fileName });
  return shortId;
}

export function getMedia(shortId: string): MediaData | undefined {
  return mediaStore.get(shortId);
}

export function createMergeSession(userId: number): string {
  const sessionId = randomBytes(6).toString("hex"); // 12 chars
  mergeSessionStore.set(sessionId, {
    userId,
    sessionId,
    files: [],
    createdAt: Date.now(),
  });
  return sessionId;
}

export function getMergeSession(sessionId: string): MergeSession | undefined {
  return mergeSessionStore.get(sessionId);
}

export function getActiveUserMergeSession(
  userId: number,
): MergeSession | undefined {
  for (const session of mergeSessionStore.values()) {
    if (session.userId === userId) {
      return session;
    }
  }
  return undefined;
}

export function addFileToMergeSession(
  sessionId: string,
  fileId: string,
  fileName?: string,
  duration?: number,
): boolean {
  const session = mergeSessionStore.get(sessionId);
  if (!session) return false;

  session.files.push({ fileId, fileName, duration });
  session.createdAt = Date.now(); // Reset timer on new file addition
  return true;
}

export function deleteMergeSession(sessionId: string): void {
  mergeSessionStore.delete(sessionId);
}

export function clearUserMergeSessions(userId: number): void {
  for (const [sessionId, session] of mergeSessionStore.entries()) {
    if (session.userId === userId) {
      mergeSessionStore.delete(sessionId);
    }
  }
}
