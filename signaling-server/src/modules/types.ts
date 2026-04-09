export interface Env {
  SIGNALING_SERVER: DurableObjectNamespace;
  TURN_KEY_ID?: string;
  TURN_API_TOKEN?: string;
  TURN_CREDENTIAL_TTL_SECONDS?: string;
  TURN_ALLOWED_ORIGINS?: string;
  TURN_STUN_URL?: string;
  TURN_URLS?: string;
}

export interface RoleMessage {
  type: "ready";
  role: "caller" | "callee";
}

export interface IceServerLike {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export interface TurnCredentialResponse {
  iceServers: IceServerLike[];
  ttlSeconds: number;
  issuedAt: string;
  expiresAt: string;
}
