export type ConnectionStatus =
  | "idle"
  | "connecting"
  | "waiting"
  | "online"
  | "error";

export type MessageType = "local" | "remote" | "system" | "error";

export interface ChatAttachment {
  fileName: string;
  fileSize: number;
  fileUrl: string;
  mimeType: string;
}

export interface ChatMessage {
  id: string;
  sender: string;
  text: string;
  type: MessageType;
  createdAt: string;
  attachment?: ChatAttachment;
}

export interface SystemNotice {
  text: string;
  type: "system" | "error";
  updatedAt: string;
}

export interface SignalingMessage {
  offer?: RTCSessionDescriptionInit;
  answer?: RTCSessionDescriptionInit;
  iceCandidate?: RTCIceCandidateInit;
  type?: string;
  role?: "caller" | "callee";
}

export interface TurnCredentialResponse {
  iceServers: RTCIceServer[];
  expiresAt: string;
  ttlSeconds: number;
}

export interface FileMetaPayload {
  type: "file-meta";
  fileId: string;
  sender: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}

export interface FileChunkPayload {
  type: "file-chunk";
  fileId: string;
  chunkBase64: string;
}

export interface FileEndPayload {
  type: "file-end";
  fileId: string;
}

export type DataChannelPayload =
  | import("../../config/appConfig").ChatPayload
  | FileMetaPayload
  | FileChunkPayload
  | FileEndPayload;

export interface IncomingFileTransfer {
  sender: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  chunks: ArrayBuffer[];
}
