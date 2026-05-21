// src/app/api/sse/route.ts
import { NextResponse } from 'next/server';
import { sseClients } from '@/lib/sse';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection confirmation
      controller.enqueue(encoder.encode('event: connected\ndata: {}\n\n'));

      const write = (data: string) => {
        try {
          controller.enqueue(encoder.encode(data));
        } catch {
          sseClients.delete(write);
        }
      };

      sseClients.add(write);

      // Heartbeat every 20s to keep connection alive
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': heartbeat\n\n'));
        } catch {
          clearInterval(heartbeat);
          sseClients.delete(write);
        }
      }, 20000);

      // Cleanup on close
      return () => {
        clearInterval(heartbeat);
        sseClients.delete(write);
      };
    },
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
