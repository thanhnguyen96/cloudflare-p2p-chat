import type { Env } from "./types";

const normalizeOrigin = (input: string): string | null => {
  const candidate = input.trim();
  if (!candidate) {
    return null;
  }

  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }

    return parsed.origin;
  } catch {
    return null;
  }
};

const parseCsv = (input: string | undefined): string[] =>
  (input ?? "")
    .split(",")
    .map((item) => normalizeOrigin(item))
    .filter((item): item is string => item !== null);

export const resolveAllowedOrigin = (
  origin: string | null,
  env: Env
): string | null => {
  if (!origin) {
    return null;
  }

  const normalizedOrigin = normalizeOrigin(origin);
  if (!normalizedOrigin) {
    return null;
  }

  const allowedOrigins = parseCsv(env.TURN_ALLOWED_ORIGINS);
  if (allowedOrigins.length === 0) {
    return null;
  }

  return allowedOrigins.includes(normalizedOrigin) ? normalizedOrigin : null;
};

const corsHeaders = (origin: string): Headers => {
  const headers = new Headers();
  headers.set("Access-Control-Allow-Origin", origin);
  headers.set("Access-Control-Allow-Methods", "GET,OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type");
  headers.set("Vary", "Origin");
  return headers;
};

export const withCors = (response: Response, origin: string): Response => {
  const headers = new Headers(response.headers);
  for (const [key, value] of corsHeaders(origin)) {
    headers.set(key, value);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};

export const jsonResponse = (
  body: unknown,
  origin: string,
  status = 200
): Response =>
  withCors(
    new Response(JSON.stringify(body), {
      status,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
      },
    }),
    origin
  );
