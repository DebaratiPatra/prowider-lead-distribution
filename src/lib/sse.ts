// src/lib/sse.ts
/**
 * Server-Sent Events broadcaster.
 * Maintains a global set of active SSE response writers.
 * When a lead is assigned, we broadcast to all connected dashboards.
 */

type SSEWriter = (data: string) => void;

const globalForSSE = globalThis as unknown as {
  sseClients: Set<SSEWriter>;
};

if (!globalForSSE.sseClients) {
  globalForSSE.sseClients = new Set();
}

export const sseClients = globalForSSE.sseClients;

export function broadcastUpdate(event: string, data: unknown) {
  const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const write of sseClients) {
    try {
      write(message);
    } catch {
      sseClients.delete(write);
    }
  }
}
