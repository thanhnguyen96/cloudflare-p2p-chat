import { jsonResponse, resolveAllowedOrigin, withCors } from "./cors";
import type { Env, IceServerLike, TurnCredentialResponse } from "./types";

const TURN_API_BASE = "https://rtc.live.cloudflare.com/v1";
const DEFAULT_TURN_TTL_SECONDS = 3600;
const DEFAULT_STUN_URL = "stun:stun.cloudflare.com:3478";
const DEFAULT_TURN_URLS = [
  "turn:turn.cloudflare.com:3478?transport=udp",
  "turn:turn.cloudflare.com:3478?transport=tcp",
  "turns:turn.cloudflare.com:5349?transport=tcp",
  "turn:turn.cloudflare.com:53?transport=udp",
  "turn:turn.cloudflare.com:80?transport=tcp",
  "turns:turn.cloudflare.com:443?transport=tcp",
];

const asRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;

const parseCsv = (input: string | undefined): string[] =>
  (input ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const parseTtlSeconds = (input: string | undefined): number => {
  const parsed = Number.parseInt((input ?? "").trim(), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_TURN_TTL_SECONDS;
  }

  return Math.min(parsed, 86_400);
};

const normalizeIceServer = (value: unknown): IceServerLike | null => {
  const record = asRecord(value);
  if (!record) {
    return null;
  }

  const rawUrls = record.urls;
  const urls =
    typeof rawUrls === "string"
      ? rawUrls
      : Array.isArray(rawUrls)
      ? rawUrls.filter((item): item is string => typeof item === "string")
      : null;

  if (!urls || (Array.isArray(urls) && urls.length === 0)) {
    return null;
  }

  const normalized: IceServerLike = { urls };
  if (typeof record.username === "string" && record.username) {
    normalized.username = record.username;
  }
  if (typeof record.credential === "string" && record.credential) {
    normalized.credential = record.credential;
  }

  return normalized;
};

const fallbackIceServers = (
  username: string,
  credential: string,
  env: Env
): IceServerLike[] => {
  const stunUrl = (env.TURN_STUN_URL ?? "").trim() || DEFAULT_STUN_URL;
  const turnUrls = parseCsv(env.TURN_URLS);
  const resolvedTurnUrls = turnUrls.length > 0 ? turnUrls : DEFAULT_TURN_URLS;

  return [
    { urls: stunUrl },
    {
      urls: resolvedTurnUrls,
      username,
      credential,
    },
  ];
};

const extractIceServersFromApi = (
  payload: unknown,
  env: Env
): IceServerLike[] => {
  const rootRecord = asRecord(payload);
  if (!rootRecord) {
    return [];
  }

  const resultRecord = asRecord(rootRecord.result) ?? rootRecord;

  const rawIceServers = resultRecord.iceServers;
  if (Array.isArray(rawIceServers)) {
    const parsedIceServers = rawIceServers
      .map((item) => normalizeIceServer(item))
      .filter((item): item is IceServerLike => item !== null);

    if (parsedIceServers.length > 0) {
      return parsedIceServers;
    }
  }

  const username =
    typeof resultRecord.username === "string" ? resultRecord.username : "";
  const credential =
    typeof resultRecord.credential === "string" ? resultRecord.credential : "";

  if (username && credential) {
    return fallbackIceServers(username, credential, env);
  }

  return [];
};

const issueTurnCredential = async (env: Env): Promise<TurnCredentialResponse> => {
  const keyId = (env.TURN_KEY_ID ?? "").trim();
  const apiToken = (env.TURN_API_TOKEN ?? "").trim();

  if (!keyId || !apiToken) {
    throw new Error("Missing TURN_KEY_ID or TURN_API_TOKEN on signaling server");
  }

  const ttlSeconds = parseTtlSeconds(env.TURN_CREDENTIAL_TTL_SECONDS);

  const apiResponse = await fetch(
    `${TURN_API_BASE}/turn/keys/${encodeURIComponent(
      keyId
    )}/credentials/generate-ice-servers`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ttl: ttlSeconds }),
    }
  );

  const rawPayload = await apiResponse.json<unknown>().catch(() => null);
  if (!apiResponse.ok) {
    throw new Error(
      `Cloudflare TURN API request failed with status ${apiResponse.status}`
    );
  }

  const iceServers = extractIceServersFromApi(rawPayload, env);
  if (iceServers.length === 0) {
    throw new Error("Cloudflare TURN API returned no usable iceServers");
  }

  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + ttlSeconds * 1000);

  return {
    iceServers,
    ttlSeconds,
    issuedAt: issuedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };
};

export const handleTurnCredentialsRequest = async (
  request: Request,
  env: Env
): Promise<Response> => {
  const allowedOrigin = resolveAllowedOrigin(request.headers.get("Origin"), env);
  if (!allowedOrigin) {
    return new Response("Forbidden", { status: 403 });
  }

  if (request.method === "OPTIONS") {
    return withCors(new Response(null, { status: 204 }), allowedOrigin);
  }

  if (request.method !== "GET") {
    return jsonResponse({ error: "Method not allowed" }, allowedOrigin, 405);
  }

  try {
    const payload = await issueTurnCredential(env);
    return jsonResponse(payload, allowedOrigin);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to issue TURN credential";
    return jsonResponse({ error: message }, allowedOrigin, 500);
  }
};
