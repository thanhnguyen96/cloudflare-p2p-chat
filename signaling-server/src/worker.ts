import { SignalingServer } from "./modules/signalingServer";
import { handleTurnCredentialsRequest } from "./modules/turn";
import type { Env } from "./modules/types";

export { SignalingServer };

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/turn-credentials") {
      return handleTurnCredentialsRequest(request, env);
    }

    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return new Response("Expected WebSocket upgrade", {
        status: 426,
        headers: {
          Upgrade: "websocket",
        },
      });
    }

    const roomId = decodeURIComponent(url.pathname.slice(1));

    if (!roomId || roomId.includes("/")) {
      return new Response("Invalid URL. Expected format: /<room-id>", {
        status: 400,
      });
    }

    const id = env.SIGNALING_SERVER.idFromName(roomId);
    const stub = env.SIGNALING_SERVER.get(id);

    return stub.fetch(request);
  },
};
