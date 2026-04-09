import type { ConnectionStatus } from "./types";

export const STATUS_LABELS: Record<ConnectionStatus, string> = {
  idle: "Idle",
  connecting: "Connecting...",
  waiting: "Waiting for peer...",
  online: "Online",
  error: "Connection error",
};

export const FILE_CHUNK_SIZE_BYTES = 12 * 1024;
export const MAX_FILE_SIZE_BYTES = 1024 * 1024 * 1024;
export const DATA_CHANNEL_BUFFER_LIMIT = 1_000_000;
