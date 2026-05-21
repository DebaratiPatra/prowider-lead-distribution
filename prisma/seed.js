// prisma/seed.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Upsert Services
  const service1 = await prisma.service.upsert({
    where: { name: 'Service 1' },
    update: {},
    create: { name: 'Service 1' },
  });
  const service2 = await prisma.service.upsert({
    where: { name: 'Service 2' },
    update: {},
    create: { name: 'Service 2' },
  });
  const service3 = await prisma.service.upsert({
    where: { name: 'Service 3' },
    update: {},
    create: { name: 'Service 3' },
  });

  console.log('Services created:', service1.id, service2.id, service3.id);

  // Upsert 8 Providers
  const providers = [];
  for (let i = 1; i <= 8; i++) {
    const p = await prisma.provider.upsert({
      where: { name: `Provider ${i}` },
      update: {},
      create: {
        name: `Provider ${i}`,
        monthlyQuota: 10,
        usedQuota: 0,
      },
    });
    providers.push(p);
  }
  console.log('Providers created:', providers.map(p => p.id));

  // Build AllocationState (round-robin pool positions per service)
  // Service 1 pool: Providers 2,3,4 (indices 1,2,3 in providers array)
  // Service 2 pool: Providers 6,7,8 (indices 5,6,7)
  // Service 3 pool: Providers 2,3,5,6,7,8 (indices 1,2,4,5,6,7)

  const pools = {
    [service1.id]: [providers[1], providers[2], providers[3]],         // P2,P3,P4
    [service2.id]: [providers[5], providers[6], providers[7]],         // P6,P7,P8
    [service3.id]: [providers[1], providers[2], providers[4], providers[5], providers[6], providers[7]], // P2,P3,P5,P6,P7,P8
  };

  for (const [serviceId, pool] of Object.entries(pools)) {
    for (let pos = 0; pos < pool.length; pos++) {
      await prisma.allocationState.upsert({
        where: {
          serviceId_providerId: {
            serviceId: parseInt(serviceId),
            providerId: pool[pos].id,
          },
        },
        update: {},
        create: {
          serviceId: parseInt(serviceId),
          providerId: pool[pos].id,
          position: pos,
        },
      });
    }
  }

  console.log('AllocationState seeded.');
  console.log('Seed complete!');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
