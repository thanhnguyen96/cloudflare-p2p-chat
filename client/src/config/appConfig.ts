export interface ChatPayload {
  type: "chat";
  sender?: string;
  text: string;
}

const DEFAULT_STUN_URL = "stun:stun.cloudflare.com:3478";
const DEFAULT_TURN_TTL_SECONDS = 3600;
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
const readPositiveInt = (value: string | undefined): number | null => {
  const parsed = Number.parseInt(readEnv(value), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
};

const trimTrailingSlash = (value: string): string =>
  value.endsWith("/") ? value.slice(0, -1) : value;

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

const signalingHttpBaseUrl = trimTrailingSlash(
  signalingServerUrl.replace(/^wss:/i, "https:").replace(/^ws:/i, "http:")
);
const turnCredentialEndpoint = signalingHttpBaseUrl
  ? `${signalingHttpBaseUrl}/api/turn-credentials`
  : "";
const turnCredentialTtlSeconds =
  readPositiveInt(import.meta.env.VITE_TURN_CREDENTIAL_TTL_SECONDS) ??
  DEFAULT_TURN_TTL_SECONDS;

export const appConfig = {
  signalingServerUrl,
  defaultDisplayName,
  iceServers,
  turnCredentialEndpoint,
  turnCredentialTtlSeconds,
};
