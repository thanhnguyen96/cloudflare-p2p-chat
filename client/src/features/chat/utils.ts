import type { DataChannelPayload } from "./types";
import { DATA_CHANNEL_BUFFER_LIMIT } from "./constants";

export const createMessageId = (): string => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export const formatFileSize = (sizeInBytes: number): string => {
  if (!Number.isFinite(sizeInBytes) || sizeInBytes < 0) {
    return "Unknown size";
  }

  if (sizeInBytes < 1024) {
    return `${sizeInBytes} B`;
  }

  if (sizeInBytes < 1024 * 1024) {
    return `${(sizeInBytes / 1024).toFixed(1)} KB`;
  }

  if (sizeInBytes < 1024 * 1024 * 1024) {
    return `${(sizeInBytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  return `${(sizeInBytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

export const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }

  return btoa(binary);
};

export const base64ToArrayBuffer = (base64: string): ArrayBuffer => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes.buffer as ArrayBuffer;
};

export const parseDataChannelPayload = (
  rawData: string
): DataChannelPayload | null => {
  try {
    const parsed = JSON.parse(rawData) as Record<string, unknown>;

    if (parsed.type === "chat" && typeof parsed.text === "string") {
      return {
        type: "chat",
        sender: typeof parsed.sender === "string" ? parsed.sender : "Peer",
        text: parsed.text,
      };
    }

    if (
      parsed.type === "file-meta" &&
      typeof parsed.fileId === "string" &&
      typeof parsed.sender === "string" &&
      typeof parsed.fileName === "string" &&
      typeof parsed.fileSize === "number" &&
      Number.isFinite(parsed.fileSize) &&
      parsed.fileSize >= 0 &&
      typeof parsed.mimeType === "string"
    ) {
      return {
        type: "file-meta",
        fileId: parsed.fileId,
        sender: parsed.sender,
        fileName: parsed.fileName,
        fileSize: parsed.fileSize,
        mimeType: parsed.mimeType,
      };
    }

    if (
      parsed.type === "file-chunk" &&
      typeof parsed.fileId === "string" &&
      typeof parsed.chunkBase64 === "string"
    ) {
      return {
        type: "file-chunk",
        fileId: parsed.fileId,
        chunkBase64: parsed.chunkBase64,
      };
    }

    if (parsed.type === "file-end" && typeof parsed.fileId === "string") {
      return {
        type: "file-end",
        fileId: parsed.fileId,
      };
    }
  } catch {
    return null;
  }

  return null;
};

export const waitForDataChannelDrain = (
  channel: RTCDataChannel
): Promise<void> => {
  if (channel.bufferedAmount < DATA_CHANNEL_BUFFER_LIMIT) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const onLow = (): void => {
      cleanup();
      resolve();
    };

    const timeoutId = window.setTimeout(() => {
      cleanup();
      resolve();
    }, 250);

    const cleanup = (): void => {
      channel.removeEventListener("bufferedamountlow", onLow);
      window.clearTimeout(timeoutId);
    };

    channel.addEventListener("bufferedamountlow", onLow);
  });
};
