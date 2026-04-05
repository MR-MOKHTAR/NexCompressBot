import { randomBytes } from "crypto";

interface MediaData {
  fileId: string;
  type: "audio" | "video";
  fileName?: string;
}

const mediaStore = new Map<string, MediaData>();

export function saveMedia(fileId: string, type: "audio" | "video", fileName?: string): string {
  const shortId = randomBytes(4).toString("hex"); // 8 chars
  mediaStore.set(shortId, { fileId, type, fileName });
  return shortId;
}

export function getMedia(shortId: string): MediaData | undefined {
  return mediaStore.get(shortId);
}
