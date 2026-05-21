// src/app/api/webhook/route.ts
/**
 * Webhook endpoint simulating a payment gateway confirmation.
 * Resets ALL provider quotas to 10.
 *
 * Idempotency: caller must supply `Idempotency-Key` header.
 * If the same key is used twice, the second call returns 200 but
 * does NOT re-process (no duplicate quota reset).
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { broadcastUpdate } from '@/lib/sse';

export async function POST(req: NextRequest) {
  const idempotencyKey = req.headers.get('Idempotency-Key');

  if (!idempotencyKey) {
    return NextResponse.json(
      { error: 'Idempotency-Key header is required.' },
      { status: 400 }
    );
  }

  // Check if this key was already processed
  const existing = await prisma.webhookEvent.findUnique({
    where: { idempotencyKey },
  });

  if (existing) {
    return NextResponse.json({
      success: true,
      message: 'Already processed (idempotent).',
      alreadyProcessed: true,
      processedAt: existing.processedAt,
    });
  }

  // Process: reset all provider quotas
  await prisma.$transaction(async (tx) => {
    // Record the event FIRST to prevent race conditions
    await tx.webhookEvent.create({
      data: {
        idempotencyKey,
        type: 'quota_reset',
      },
    });

    // Reset all providers
    await tx.provider.updateMany({
      data: { usedQuota: 0 },
    });
  });

  // Broadcast quota reset to dashboards
  broadcastUpdate('quota_reset', { message: 'All provider quotas have been reset to 10.' });

  return NextResponse.json({
    success: true,
    message: 'All provider quotas reset to 10.',
    alreadyProcessed: false,
  });
}
