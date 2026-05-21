import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { assignLeadToProviders } from '@/lib/allocation';
import { broadcastUpdate } from '@/lib/sse';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, phone, city, serviceId, description } = body;

    if (!name || !phone || !city || !serviceId || !description) {
      return NextResponse.json({ error: 'All fields are required.' }, { status: 400 });
    }

    const parsedServiceId = Number(serviceId);

    const service = await prisma.service.findUnique({ where: { id: parsedServiceId } });
    if (!service) {
      return NextResponse.json({ error: 'Invalid service.' }, { status: 400 });
    }

    // Duplicate check
    const existing = await prisma.lead.findFirst({
      where: {
        phone: phone.trim(),
        serviceId: parsedServiceId,
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'This phone number has already submitted a lead for this service.' },
        { status: 409 }
      );
    }

    const lead = await prisma.lead.create({
      data: {
        name: name.trim(),
        phone: phone.trim(),
        city: city.trim(),
        description: description.trim(),
        serviceId: parsedServiceId,
      },
    });

    const assignedProviderIds = await assignLeadToProviders(lead.id, service.id, service.name);

    const assignments = await prisma.leadAssignment.findMany({
      where: { leadId: lead.id },
      include: { provider: true },
    });

    broadcastUpdate('lead_assigned', {
      lead: {
        id: lead.id,
        name: lead.name,
        city: lead.city,
        service: service.name,
        createdAt: lead.createdAt,
      },
      assignments: assignments.map((a: { providerId: number; provider: { name: string } }) => ({
        providerId: a.providerId,
        providerName: a.provider.name,
      })),
    });

    return NextResponse.json({
      success: true,
      leadId: lead.id,
      assignedProviders: assignedProviderIds,
    });

  } catch (error: unknown) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code: string }).code === 'P2002'
    ) {
      return NextResponse.json(
        { error: 'This phone number has already submitted a lead for this service.' },
        { status: 409 }
      );
    }
    console.error('Lead creation error:', error);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}

export async function GET() {
  const leads = await prisma.lead.findMany({
    include: {
      service: true,
      assignments: { include: { provider: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json(leads);
}