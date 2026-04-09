import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { appConfig, type ChatPayload } from "./config/appConfig";
import {
  DATA_CHANNEL_BUFFER_LIMIT,
  FILE_CHUNK_SIZE_BYTES,
  MAX_FILE_SIZE_BYTES,
  STATUS_LABELS,
} from "./features/chat/constants";
import {
  type ChatAttachment,
  type ChatMessage,
  type ConnectionStatus,
  type FileChunkPayload,
  type FileEndPayload,
  type FileMetaPayload,
  type IncomingFileTransfer,
  type MessageType,
  type SignalingMessage,
  type SystemNotice,
  type TurnCredentialResponse,
} from "./features/chat/types";
import {
  arrayBufferToBase64,
  base64ToArrayBuffer,
  createMessageId,
  formatFileSize,
  parseDataChannelPayload,
  waitForDataChannelDrain,
} from "./features/chat/utils";
import { Composer } from "./features/chat/components/Composer";
import { ConnectPanel } from "./features/chat/components/ConnectPanel";
import { MessagesPanel } from "./features/chat/components/MessagesPanel";
import { StatusPanel } from "./features/chat/components/StatusPanel";
import { SystemLogPanel } from "./features/chat/components/SystemLogPanel";

function App() {
  const [displayNameInput, setDisplayNameInput] = useState("");
  const [roomInput, setRoomInput] = useState("");
  const [messageInput, setMessageInput] = useState("");
  const [activeRoom, setActiveRoom] = useState("");
  const [localDisplayName, setLocalDisplayName] = useState(
    appConfig.defaultDisplayName
  );
  const [status, setStatus] = useState<ConnectionStatus>("idle");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [systemNotice, setSystemNotice] = useState<SystemNotice>({
    text: "Enter your room and connect to start chatting.",
    type: "system",
    updatedAt: new Date().toLocaleTimeString(),
  });
  const [isConnected, setIsConnected] = useState(false);
  const [isSendingFile, setIsSendingFile] = useState(false);
  const [copyLabel, setCopyLabel] = useState("Copy room ID");

  const messagesViewportRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const signalingSocketRef = useRef<WebSocket | null>(null);
  const incomingFilesRef = useRef<Map<string, IncomingFileTransfer>>(new Map());
  const isCallerRef = useRef(false);
  const isResettingRef = useRef(false);
  const localDisplayNameRef = useRef(localDisplayName);
  const isConnectedRef = useRef(isConnected);
  const hasCustomDisplayNameRef = useRef(false);
  const activeIceServersRef = useRef<RTCIceServer[]>(appConfig.iceServers);
  const turnCredentialExpiresAtRef = useRef<number | null>(null);
  const turnRefreshTimeoutRef = useRef<number | null>(null);
  const turnRefreshInFlightRef = useRef(false);

  useEffect(() => {
    localDisplayNameRef.current = localDisplayName;
  }, [localDisplayName]);

  useEffect(() => {
    isConnectedRef.current = isConnected;
  }, [isConnected]);

  useEffect(() => {
    if (!messagesViewportRef.current) {
      return;
    }

    messagesViewportRef.current.scrollTo({
      top: messagesViewportRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  useEffect(() => {
    return () => {
      if (turnRefreshTimeoutRef.current !== null) {
        window.clearTimeout(turnRefreshTimeoutRef.current);
      }
      signalingSocketRef.current?.close();
      dataChannelRef.current?.close();
      peerConnectionRef.current?.close();
    };
  }, []);

  const updateSystemNotice = (
    text: string,
    type: Extract<MessageType, "system" | "error"> = "system"
  ): void => {
    setSystemNotice({
      text,
      type,
      updatedAt: new Date().toLocaleTimeString(),
    });
  };

  const appendMessage = (
    sender: string,
    text: string,
    type: MessageType,
    attachment?: ChatAttachment
  ): void => {
    if (type === "system" || type === "error") {
      updateSystemNotice(text, type);
      return;
    }

    setMessages((previous) => [
      ...previous,
      {
        id: createMessageId(),
        sender,
        text,
        type,
        createdAt: new Date().toLocaleTimeString(),
        attachment,
      },
    ]);
  };

  const clearTurnCredentialRefreshTimer = (): void => {
    if (turnRefreshTimeoutRef.current !== null) {
      window.clearTimeout(turnRefreshTimeoutRef.current);
      turnRefreshTimeoutRef.current = null;
    }
  };

  const applyIceServers = (iceServers: RTCIceServer[]): void => {
    if (iceServers.length === 0) {
      return;
    }

    activeIceServersRef.current = iceServers;
    const peerConnection = peerConnectionRef.current;
    if (peerConnection) {
      peerConnection.setConfiguration({ iceServers });
    }
  };

  const fetchTurnCredential = async (): Promise<TurnCredentialResponse | null> => {
    if (!appConfig.turnCredentialEndpoint) {
      return null;
    }

    const response = await fetch(appConfig.turnCredentialEndpoint, {
      method: "GET",
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`TURN endpoint returned ${response.status}`);
    }

    const payload = (await response.json()) as Partial<TurnCredentialResponse>;
    if (!Array.isArray(payload.iceServers) || payload.iceServers.length === 0) {
      throw new Error("TURN endpoint returned invalid iceServers payload");
    }

    const ttlSeconds =
      typeof payload.ttlSeconds === "number" && payload.ttlSeconds > 0
        ? payload.ttlSeconds
        : appConfig.turnCredentialTtlSeconds;

    const expiresAt =
      typeof payload.expiresAt === "string" && payload.expiresAt
        ? payload.expiresAt
        : new Date(Date.now() + ttlSeconds * 1000).toISOString();

    return {
      iceServers: payload.iceServers as RTCIceServer[],
      expiresAt,
      ttlSeconds,
    };
  };

  async function runScheduledTurnCredentialRefresh(): Promise<void> {
    try {
      await refreshTurnCredential("scheduled");
      appendMessage("System", "TURN credential refreshed for another 1 hour.", "system");
    } catch {
      appendMessage(
        "System",
        "Failed to refresh TURN credential. Retrying in 60 seconds.",
        "error"
      );
      turnRefreshTimeoutRef.current = window.setTimeout(() => {
        void runScheduledTurnCredentialRefresh();
      }, 60_000);
    }
  }

  function scheduleTurnCredentialRefresh(): void {
    clearTurnCredentialRefreshTimer();

    const expiresAt = turnCredentialExpiresAtRef.current;
    if (!expiresAt) {
      return;
    }

    const refreshLeadMs = 5 * 60 * 1000;
    const minimumDelayMs = 15 * 1000;
    const delayMs = Math.max(expiresAt - Date.now() - refreshLeadMs, minimumDelayMs);

    turnRefreshTimeoutRef.current = window.setTimeout(() => {
      void runScheduledTurnCredentialRefresh();
    }, delayMs);
  }

  const restartIceAfterTurnRefresh = async (): Promise<void> => {
    const peerConnection = peerConnectionRef.current;
    const socket = signalingSocketRef.current;

    if (
      !peerConnection ||
      !socket ||
      socket.readyState !== WebSocket.OPEN ||
      !isConnectedRef.current ||
      peerConnection.signalingState !== "stable"
    ) {
      return;
    }

    const restartOffer = await peerConnection.createOffer({ iceRestart: true });
    await peerConnection.setLocalDescription(restartOffer);
    socket.send(JSON.stringify({ offer: peerConnection.localDescription }));
  };

  async function refreshTurnCredential(
    reason: "connect" | "scheduled"
  ): Promise<void> {
    if (!appConfig.turnCredentialEndpoint || turnRefreshInFlightRef.current) {
      return;
    }

    turnRefreshInFlightRef.current = true;

    try {
      const turnCredential = await fetchTurnCredential();
      if (!turnCredential) {
        return;
      }

      applyIceServers(turnCredential.iceServers);

      const parsedExpiresAt = Date.parse(turnCredential.expiresAt);
      turnCredentialExpiresAtRef.current = Number.isFinite(parsedExpiresAt)
        ? parsedExpiresAt
        : Date.now() + turnCredential.ttlSeconds * 1000;

      scheduleTurnCredentialRefresh();

      if (reason === "scheduled" && peerConnectionRef.current) {
        peerConnectionRef.current.setConfiguration({
          iceServers: activeIceServersRef.current,
        });
        await restartIceAfterTurnRefresh();
      }
    } finally {
      turnRefreshInFlightRef.current = false;
    }
  }

  const closeConnections = (): void => {
    const socket = signalingSocketRef.current;
    const channel = dataChannelRef.current;
    const peerConnection = peerConnectionRef.current;

    clearTurnCredentialRefreshTimer();
    turnCredentialExpiresAtRef.current = null;
    incomingFilesRef.current.clear();
    setIsSendingFile(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    if (socket) {
      socket.onopen = null;
      socket.onmessage = null;
      socket.onclose = null;
      socket.onerror = null;
      socket.close();
    }

    if (channel) {
      channel.onopen = null;
      channel.onmessage = null;
      channel.onerror = null;
      channel.onclose = null;
      channel.close();
    }

    if (peerConnection) {
      peerConnection.onicecandidate = null;
      peerConnection.ondatachannel = null;
      peerConnection.onconnectionstatechange = null;
      peerConnection.close();
    }

    signalingSocketRef.current = null;
    dataChannelRef.current = null;
    peerConnectionRef.current = null;
    isCallerRef.current = false;
    activeIceServersRef.current = appConfig.iceServers;
  };

  const resetConnectionState = (
    note: string,
    noteType: MessageType = "system",
    nextStatus: ConnectionStatus = "idle"
  ): void => {
    if (isResettingRef.current) {
      return;
    }

    isResettingRef.current = true;
    closeConnections();
    setIsConnected(false);
    setStatus(nextStatus);
    setActiveRoom("");
    setMessageInput("");
    appendMessage("System", note, noteType);

    window.setTimeout(() => {
      isResettingRef.current = false;
    }, 0);
  };

  const handleIncomingFileTransfer = (
    payload: FileMetaPayload | FileChunkPayload | FileEndPayload
  ): void => {
    if (payload.type === "file-meta") {
      incomingFilesRef.current.set(payload.fileId, {
        sender: payload.sender,
        fileName: payload.fileName,
        fileSize: payload.fileSize,
        mimeType: payload.mimeType,
        chunks: [],
      });

      appendMessage(
        "System",
        `${payload.sender} is sending ${payload.fileName} (${formatFileSize(
          payload.fileSize
        )}).`,
        "system"
      );
      return;
    }

    if (payload.type === "file-chunk") {
      const transfer = incomingFilesRef.current.get(payload.fileId);
      if (!transfer) {
        return;
      }

      transfer.chunks.push(base64ToArrayBuffer(payload.chunkBase64));
      return;
    }

    const completedTransfer = incomingFilesRef.current.get(payload.fileId);
    if (!completedTransfer) {
      return;
    }

    incomingFilesRef.current.delete(payload.fileId);

    try {
      const blob = new Blob(completedTransfer.chunks, {
        type: completedTransfer.mimeType || "application/octet-stream",
      });
      const fileUrl = URL.createObjectURL(blob);

      appendMessage(
        completedTransfer.sender,
        `Sent a file: ${completedTransfer.fileName}`,
        "remote",
        {
          fileName: completedTransfer.fileName,
          fileSize: completedTransfer.fileSize,
          fileUrl,
          mimeType: completedTransfer.mimeType,
        }
      );
    } catch {
      appendMessage("System", "Could not decode received file.", "error");
    }
  };

  const setupDataChannel = (channel: RTCDataChannel): void => {
    dataChannelRef.current = channel;
    channel.bufferedAmountLowThreshold = Math.floor(DATA_CHANNEL_BUFFER_LIMIT / 2);

    channel.onopen = () => {
      setIsConnected(true);
      setStatus("online");
      appendMessage(
        "System",
        `Connected. You are chatting as ${localDisplayNameRef.current}.`,
        "system"
      );
    };

    channel.onmessage = (event) => {
      const rawData = typeof event.data === "string" ? event.data : "";
      const payload = parseDataChannelPayload(rawData);
      if (!payload) {
        appendMessage("Peer", rawData || "[Unsupported message payload]", "remote");
        return;
      }

      if (payload.type === "chat") {
        appendMessage(payload.sender ?? "Peer", payload.text, "remote");
        return;
      }

      handleIncomingFileTransfer(payload);
    };

    channel.onerror = () => {
      appendMessage("System", "Data channel error occurred.", "error");
      setStatus("error");
    };

    channel.onclose = () => {
      if (!isResettingRef.current) {
        resetConnectionState("Peer disconnected from the room.");
      }
    };
  };

  const createPeerConnection = async (): Promise<RTCPeerConnection> => {
    if (peerConnectionRef.current) {
      return peerConnectionRef.current;
    }

    const peerConnection = new RTCPeerConnection({
      iceServers: activeIceServersRef.current,
    });

    peerConnection.onicecandidate = (event) => {
      if (!event.candidate) {
        return;
      }

      const socket = signalingSocketRef.current;
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ iceCandidate: event.candidate }));
      }
    };

    peerConnection.ondatachannel = (event) => {
      setupDataChannel(event.channel);
    };

    peerConnection.onconnectionstatechange = () => {
      const state = peerConnection.connectionState;
      if ((state === "failed" || state === "disconnected") && !isResettingRef.current) {
        resetConnectionState("Connection lost.", "error", "error");
      }
    };

    peerConnectionRef.current = peerConnection;

    if (isCallerRef.current) {
      const channel = peerConnection.createDataChannel("chat");
      setupDataChannel(channel);

      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);

      const socket = signalingSocketRef.current;
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ offer: peerConnection.localDescription }));
      }
    }

    return peerConnection;
  };

  const connectToSignaling = (roomId: string): void => {
    const normalizedBaseUrl = appConfig.signalingServerUrl.endsWith("/")
      ? appConfig.signalingServerUrl.slice(0, -1)
      : appConfig.signalingServerUrl;

    const socket = new WebSocket(`${normalizedBaseUrl}/${encodeURIComponent(roomId)}`);
    signalingSocketRef.current = socket;

    socket.onopen = async () => {
      setStatus("waiting");
      appendMessage("System", `Joined room ${roomId}. Waiting for peer...`, "system");
    };

    socket.onmessage = async (event) => {
      try {
        const rawData = typeof event.data === "string" ? event.data : "";
        if (!rawData) {
          appendMessage("System", "Invalid signaling payload type.", "error");
          return;
        }

        const signalingMessage = JSON.parse(rawData) as SignalingMessage;
        let peerConnection = peerConnectionRef.current;

        if (signalingMessage.type === "waiting") {
          if (!hasCustomDisplayNameRef.current) {
            setLocalDisplayName("Host");
            localDisplayNameRef.current = "Host";
          }
          setStatus("waiting");
          appendMessage("System", "Waiting for another user to join the room.", "system");
          return;
        }

        if (signalingMessage.type === "ready") {
          if (signalingMessage.role === "caller") {
            isCallerRef.current = true;
            appendMessage("System", "Peer joined. Creating WebRTC offer...", "system");
            await createPeerConnection();
          } else {
            isCallerRef.current = false;
            appendMessage("System", "Peer joined. Waiting for offer...", "system");
          }
          return;
        }

        if (!peerConnection && signalingMessage.offer) {
          isCallerRef.current = false;
          peerConnection = await createPeerConnection();
        }

        if (signalingMessage.offer && peerConnection) {
          await peerConnection.setRemoteDescription(signalingMessage.offer);
          const answer = await peerConnection.createAnswer();
          await peerConnection.setLocalDescription(answer);
          socket.send(JSON.stringify({ answer: peerConnection.localDescription }));
        } else if (signalingMessage.answer && peerConnection) {
          await peerConnection.setRemoteDescription(signalingMessage.answer);
        } else if (signalingMessage.iceCandidate && peerConnection) {
          await peerConnection.addIceCandidate(signalingMessage.iceCandidate);
        } else if (signalingMessage.type === "peer-left") {
          resetConnectionState("Peer left the room.");
        }
      } catch {
        appendMessage("System", "Invalid signaling message received.", "error");
      }
    };

    socket.onerror = () => {
      setStatus("error");
      appendMessage("System", "Could not reach signaling server.", "error");
    };

    socket.onclose = () => {
      if (!isResettingRef.current && !isConnectedRef.current) {
        setStatus("idle");
      }
    };
  };

  const handleConnectSubmit = async (
    event: FormEvent<HTMLFormElement>
  ): Promise<void> => {
    event.preventDefault();
    closeConnections();

    const roomId = roomInput.trim();
    if (!roomId) {
      appendMessage("System", "Room ID is required.", "error");
      return;
    }

    if (!appConfig.signalingServerUrl) {
      setStatus("error");
      appendMessage(
        "System",
        "Missing VITE_SIGNALING_SERVER_URL in .env. Check your setup.",
        "error"
      );
      return;
    }

    const resolvedDisplayName =
      displayNameInput.trim() || appConfig.defaultDisplayName;
    hasCustomDisplayNameRef.current = displayNameInput.trim().length > 0;

    setLocalDisplayName(resolvedDisplayName);
    localDisplayNameRef.current = resolvedDisplayName;
    setStatus("connecting");
    setIsConnected(false);
    setActiveRoom(roomId);
    setRoomInput(roomId);
    setCopyLabel("Copy room ID");
    isCallerRef.current = false;

    setMessages([]);
    updateSystemNotice(`Connecting to room ${roomId} as ${resolvedDisplayName}...`);

    if (appConfig.turnCredentialEndpoint) {
      try {
        await refreshTurnCredential("connect");
      } catch {
        appendMessage(
          "System",
          "Could not fetch 1-hour TURN credential. Continuing with fallback ICE settings.",
          "error"
        );
      }
    }

    connectToSignaling(roomId);
  };

  const handleDisconnect = (): void => {
    resetConnectionState("You left the room.");
  };

  const handleSendMessage = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const text = messageInput.trim();

    if (!text) {
      return;
    }

    const channel = dataChannelRef.current;
    if (!channel || channel.readyState !== "open") {
      appendMessage("System", "Data channel is not ready.", "error");
      return;
    }

    const payload: ChatPayload = {
      type: "chat",
      sender: localDisplayNameRef.current,
      text,
    };

    channel.send(JSON.stringify(payload));
    appendMessage(localDisplayNameRef.current, text, "local");
    setMessageInput("");
  };

  const sendFile = async (file: File): Promise<void> => {
    const channel = dataChannelRef.current;
    if (!channel || channel.readyState !== "open") {
      appendMessage("System", "Data channel is not ready.", "error");
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      appendMessage(
        "System",
        `File is too large. Max allowed is ${formatFileSize(MAX_FILE_SIZE_BYTES)}.`,
        "error"
      );
      return;
    }

    setIsSendingFile(true);
    const fileId = createMessageId();

    try {
      const payload: FileMetaPayload = {
        type: "file-meta",
        fileId,
        sender: localDisplayNameRef.current,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type || "application/octet-stream",
      };
      channel.send(JSON.stringify(payload));

      for (
        let offset = 0;
        offset < file.size;
        offset += FILE_CHUNK_SIZE_BYTES
      ) {
        if (channel.readyState !== "open") {
          throw new Error("Channel closed while sending file");
        }

        const chunkBuffer = await file
          .slice(offset, offset + FILE_CHUNK_SIZE_BYTES)
          .arrayBuffer();

        const chunkPayload: FileChunkPayload = {
          type: "file-chunk",
          fileId,
          chunkBase64: arrayBufferToBase64(chunkBuffer),
        };

        channel.send(JSON.stringify(chunkPayload));

        if (channel.bufferedAmount > DATA_CHANNEL_BUFFER_LIMIT) {
          await waitForDataChannelDrain(channel);
        }
      }

      const endPayload: FileEndPayload = {
        type: "file-end",
        fileId,
      };
      channel.send(JSON.stringify(endPayload));

      appendMessage(
        localDisplayNameRef.current,
        `Sent a file: ${file.name}`,
        "local",
        {
          fileName: file.name,
          fileSize: file.size,
          fileUrl: URL.createObjectURL(file),
          mimeType: file.type || "application/octet-stream",
        }
      );
    } catch {
      appendMessage("System", "Failed to send file.", "error");
    } finally {
      setIsSendingFile(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handlePickFile = (): void => {
    if (!isConnected || isSendingFile) {
      return;
    }

    fileInputRef.current?.click();
  };

  const handleFileInputChange = (event: ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    void sendFile(file);
  };

  const handleCopyRoom = async (): Promise<void> => {
    const roomId = activeRoom || roomInput.trim();
    if (!roomId) {
      setCopyLabel("No room");
      window.setTimeout(() => setCopyLabel("Copy room ID"), 1200);
      return;
    }

    try {
      await navigator.clipboard.writeText(roomId);
      setCopyLabel("Copied");
    } catch {
      setCopyLabel("Copy failed");
    }

    window.setTimeout(() => setCopyLabel("Copy room ID"), 1200);
  };

  const statusDotClassName = useMemo(
    () => `status-panel__dot status-panel__dot--${status}`,
    [status]
  );

  const controlsLocked =
    status === "connecting" || status === "waiting" || isConnected;
  const canDisconnect =
    status === "connecting" || status === "waiting" || isConnected;
  const isImmersiveMode = isConnected;

  return (
    <div className={`chat-app ${isImmersiveMode ? "chat-app--immersive" : ""}`}>
      <main className="chat-app__shell">
        {!isImmersiveMode && (
          <header className="chat-app__header">
            <h1 className="chat-app__title">P2P Chat</h1>
          </header>
        )}

        {!isImmersiveMode && (
          <StatusPanel
            statusLabel={STATUS_LABELS[status]}
            statusDotClassName={statusDotClassName}
            activeRoom={activeRoom}
          />
        )}

        {!isImmersiveMode && (
          <ConnectPanel
            displayNameInput={displayNameInput}
            roomInput={roomInput}
            defaultDisplayName={appConfig.defaultDisplayName}
            controlsLocked={controlsLocked}
            copyLabel={copyLabel}
            canDisconnect={canDisconnect}
            status={status}
            onDisplayNameChange={setDisplayNameInput}
            onRoomChange={setRoomInput}
            onSubmit={handleConnectSubmit}
            onCopyRoom={handleCopyRoom}
            onDisconnect={handleDisconnect}
          />
        )}

        <SystemLogPanel notice={systemNotice} />

        <MessagesPanel messages={messages} viewportRef={messagesViewportRef} />

        <Composer
          isConnected={isConnected}
          isImmersiveMode={isImmersiveMode}
          isSendingFile={isSendingFile}
          messageInput={messageInput}
          localDisplayName={localDisplayName}
          fileInputRef={fileInputRef}
          onMessageInputChange={setMessageInput}
          onSubmit={handleSendMessage}
          onPickFile={handlePickFile}
          onFileInputChange={handleFileInputChange}
          onDisconnect={handleDisconnect}
        />
      </main>
    </div>
  );
}

export default App;



