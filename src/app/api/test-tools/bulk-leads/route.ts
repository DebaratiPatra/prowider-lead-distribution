// src/app/api/test-tools/bulk-leads/route.ts
import { NextResponse } from 'next/server';

const NAMES = ['Alice', 'Bob', 'Carol', 'David', 'Eve', 'Frank', 'Grace', 'Henry', 'Irene', 'Jack'];
const CITIES = ['Mumbai', 'Delhi', 'Bangalore', 'Chennai', 'Kolkata', 'Hyderabad', 'Pune', 'Ahmedabad', 'Jaipur', 'Surat'];

export async function POST() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  const timestamp = Date.now();

  // Build 10 concurrent lead requests across all 3 services
  const requests = NAMES.map((name, i) => {
    const serviceId = (i % 3) + 1;
    const phone = `99000${timestamp.toString().slice(-5)}${i}`;
    return fetch(`${baseUrl}/api/leads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        phone,
        city: CITIES[i],
        serviceId,
        description: `Bulk test lead ${i + 1} for service ${serviceId}`,
      }),
    }).then(async (r) => {
      const data = await r.json();
      return { name, phone, serviceId, status: r.status, data };
    }).catch(err => ({ name, phone, serviceId, status: 500, error: err.message }));
  });

  // Fire all simultaneously
  const results = await Promise.all(requests);

  const succeeded = results.filter(r => r.status === 200 || r.status === 201).length;
  const failed = results.filter(r => r.status !== 200 && r.status !== 201).length;

  return NextResponse.json({ results, summary: { total: 10, succeeded, failed } });
}
