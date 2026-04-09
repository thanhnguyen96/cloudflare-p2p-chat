import type { Env } from "./types";

const parseCsv = (input: string | undefined): string[] =>
  (input ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

export const resolveAllowedOrigin = (
  origin: string | null,
  env: Env
): string | null => {
  if (!origin) {
    return null;
  }

  const allowedOrigins = parseCsv(env.TURN_ALLOWED_ORIGINS);
  if (allowedOrigins.length === 0) {
    return null;
  }

  return allowedOrigins.includes(origin) ? origin : null;
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
