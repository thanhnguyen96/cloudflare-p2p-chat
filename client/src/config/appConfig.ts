export interface ChatPayload {
  type: "chat";
  sender?: string;
  text: string;
}

const DEFAULT_STUN_URL = "stun:stun.cloudflare.com:3478";
const DEFAULT_TURN_URLS = [
  "turn:turn.cloudflare.com:3478?transport=udp",
  "turn:turn.cloudflare.com:3478?transport=tcp",
  "turns:turn.cloudflare.com:5349?transport=tcp",
  "turn:turn.cloudflare.com:53?transport=udp",
  "turn:turn.cloudflare.com:80?transport=tcp",
  "turns:turn.cloudflare.com:443?transport=tcp",
];

const parseCsv = (input: string | undefined): string[] =>
  (input ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const readEnv = (value: string | undefined): string => value?.trim() ?? "";

const signalingServerUrl = readEnv(import.meta.env.VITE_SIGNALING_SERVER_URL);
const defaultDisplayName =
  readEnv(import.meta.env.VITE_DEFAULT_DISPLAY_NAME) || "Guest";
const stunUrl = readEnv(import.meta.env.VITE_STUN_URL) || DEFAULT_STUN_URL;
const turnUrls = parseCsv(import.meta.env.VITE_TURN_URLS);
const turnUsername = readEnv(import.meta.env.VITE_TURN_USERNAME);
const turnCredential = readEnv(import.meta.env.VITE_TURN_CREDENTIAL);

const iceServers: RTCIceServer[] = [{ urls: stunUrl }];

const resolvedTurnUrls = turnUrls.length > 0 ? turnUrls : DEFAULT_TURN_URLS;
if (turnUsername && turnCredential) {
  iceServers.push({
    urls: resolvedTurnUrls,
    username: turnUsername,
    credential: turnCredential,
  });
}

export const appConfig = {
  signalingServerUrl,
  defaultDisplayName,
  iceServers,
};
