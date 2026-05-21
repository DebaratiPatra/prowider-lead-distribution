// src/lib/allocation.ts
/**
 * Lead Allocation Engine
 *
 * Rules:
 *   Service 1 → Provider 1 mandatory, pool: P2,P3,P4
 *   Service 2 → Provider 5 mandatory, pool: P6,P7,P8
 *   Service 3 → Provider 1 + Provider 4 mandatory, pool: P2,P3,P5,P6,P7,P8
 *
 * Each lead gets exactly 3 provider assignments.
 * Fair allocation = round-robin by position stored in AllocationState.
 * Concurrency: all DB mutations happen inside a serializable transaction
 * with advisory locking to prevent double-assignment.
 */

import { prisma } from './prisma';
import { Prisma } from '@prisma/client';

const TOTAL_ASSIGNMENTS = 3;

// Mandatory provider NAMES per service name
const MANDATORY_MAP: Record<string, string[]> = {
  'Service 1': ['Provider 1'],
  'Service 2': ['Provider 5'],
  'Service 3': ['Provider 1', 'Provider 4'],
};

export async function assignLeadToProviders(leadId: number, serviceId: number, serviceName: string): Promise<number[]> {
  // Use a PostgreSQL advisory lock keyed to the serviceId to prevent
  // concurrent transactions from assigning the same pool slot twice.
  // pg_advisory_xact_lock is released automatically at end of transaction.
  return await prisma.$transaction(
    async (tx) => {
      // Acquire advisory lock for this service's pool
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${serviceId})`;

      // Fetch all providers with current quota info
      const allProviders = await tx.provider.findMany();
      const providerByName = Object.fromEntries(allProviders.map(p => [p.name, p]));

      const mandatoryNames = MANDATORY_MAP[serviceName] ?? [];
      const assigned: number[] = [];
      const assignedProviderIds = new Set<number>();

      // ── 1. Assign mandatory providers (skip if quota exhausted) ──
      for (const name of mandatoryNames) {
        const p = providerByName[name];
        if (!p) continue;
        if (p.usedQuota >= p.monthlyQuota) continue; // quota full, skip mandatory
        if (assignedProviderIds.has(p.id)) continue;

        assigned.push(p.id);
        assignedProviderIds.add(p.id);

        await tx.provider.update({
          where: { id: p.id },
          data: { usedQuota: { increment: 1 } },
        });
      }

      // ── 2. Fill remaining slots from the fair pool ──
      const slotsNeeded = TOTAL_ASSIGNMENTS - assigned.length;

      if (slotsNeeded > 0) {
        // Get pool entries sorted by position (round-robin order)
        const poolEntries = await tx.allocationState.findMany({
          where: { serviceId },
          orderBy: { position: 'asc' },
          include: { provider: true },
        });

        let filled = 0;
        // Track which pool entries we advance
        const toAdvance: number[] = [];

        for (const entry of poolEntries) {
          if (filled >= slotsNeeded) break;
          const p = entry.provider;
          if (assignedProviderIds.has(p.id)) continue;
          if (p.usedQuota >= p.monthlyQuota) continue;

          assigned.push(p.id);
          assignedProviderIds.add(p.id);
          toAdvance.push(entry.id);

          await tx.provider.update({
            where: { id: p.id },
            data: { usedQuota: { increment: 1 } },
          });

          filled++;
        }

        // Rotate pool: move used entries to the back by reassigning positions
        // Get max position in pool
        if (toAdvance.length > 0) {
          const maxEntry = await tx.allocationState.findFirst({
            where: { serviceId },
            orderBy: { position: 'desc' },
          });
          let nextPos = (maxEntry?.position ?? 0) + 1;

          for (const entryId of toAdvance) {
            await tx.allocationState.update({
              where: { id: entryId },
              data: { position: nextPos++ },
            });
          }
        }
      }

      // ── 3. Create LeadAssignment records ──
      for (const providerId of assigned) {
        await tx.leadAssignment.create({
          data: { leadId, providerId },
        });
      }

      return assigned;
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      timeout: 15000,
    }
  );
}
