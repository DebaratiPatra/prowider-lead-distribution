// src/app/api/services/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const services = await prisma.service.findMany({ orderBy: { id: 'asc' } });
  return NextResponse.json(services);
}
