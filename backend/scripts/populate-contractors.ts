/**
 * populate-contractors.ts
 *
 * One-time migration script that creates Contractor records from existing
 * WorkforceMember.empresa_vinculada values and links them via contractorId.
 *
 * Logic:
 *   1. Find all WorkforceMembers with non-empty empresa_vinculada and no contractorId.
 *   2. Group by (instanceId, name) — instance comes from project.instanceId.
 *   3. For each unique (instanceId, name), upsert a Contractor record.
 *   4. Link each WorkforceMember to its Contractor via contractorId.
 *
 * Usage:
 *   DRY_RUN=1 npx ts-node scripts/populate-contractors.ts   # preview only
 *   npx ts-node scripts/populate-contractors.ts               # apply changes
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const DRY_RUN = process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true';

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter } as any);

  console.log(`\n🔧 populate-contractors.ts  (DRY_RUN=${DRY_RUN})\n`);

  // 1. Fetch all workforce members with empresa_vinculada set but no contractorId
  const members = await prisma.workforceMember.findMany({
    where: {
      empresa_vinculada: { not: '' },
      contractorId: null,
    },
    select: {
      id: true,
      empresa_vinculada: true,
      project: {
        select: { instanceId: true },
      },
    },
  });

  console.log(`Found ${members.length} workforce members with empresa_vinculada and no contractorId.\n`);

  if (members.length === 0) {
    console.log('Nothing to do.');
    await prisma.$disconnect();
    await pool.end();
    return;
  }

  // 2. Group by (instanceId, normalised name)
  const groups = new Map<string, { instanceId: string; originalName: string; memberIds: string[] }>();

  for (const m of members) {
    const instanceId = m.project.instanceId;
    const name = m.empresa_vinculada.trim();
    const key = `${instanceId}::${name.toLowerCase()}`;

    if (!groups.has(key)) {
      groups.set(key, { instanceId, originalName: name, memberIds: [] });
    }
    groups.get(key)!.memberIds.push(m.id);
  }

  console.log(`Grouped into ${groups.size} unique (instance, name) pairs.\n`);

  let contractorsCreated = 0;
  let contractorsReused = 0;
  let membersLinked = 0;

  for (const [key, group] of groups) {
    // 3. Check if a Contractor with this name already exists in the instance
    const existing = await prisma.contractor.findFirst({
      where: {
        instanceId: group.instanceId,
        name: { equals: group.originalName, mode: 'insensitive' as any },
      },
    });

    let contractorId: string;

    if (existing) {
      contractorId = existing.id;
      contractorsReused++;
      console.log(`  ♻ Reuse contractor "${existing.name}" (${contractorId}) for instance ${group.instanceId}`);
    } else {
      if (DRY_RUN) {
        contractorId = `<dry-run-${key}>`;
        console.log(`  + [DRY] Would create contractor "${group.originalName}" for instance ${group.instanceId}`);
      } else {
        const created = await prisma.contractor.create({
          data: {
            name: group.originalName,
            instanceId: group.instanceId,
            status: 'active',
            type: 'pj',
          },
        });
        contractorId = created.id;
        console.log(`  ✓ Created contractor "${created.name}" (${contractorId}) for instance ${group.instanceId}`);
      }
      contractorsCreated++;
    }

    // 4. Link WorkforceMembers
    for (const memberId of group.memberIds) {
      if (DRY_RUN) {
        console.log(`    [DRY] Would link member ${memberId} → contractor ${contractorId}`);
      } else {
        await prisma.workforceMember.update({
          where: { id: memberId },
          data: { contractorId },
        });
        console.log(`    ✓ Linked member ${memberId} → contractor ${contractorId}`);
      }
      membersLinked++;
    }
  }

  console.log(`\n--- Summary ---`);
  console.log(`Contractors created: ${contractorsCreated}`);
  console.log(`Contractors reused:  ${contractorsReused}`);
  console.log(`Members linked:      ${membersLinked}`);
  if (DRY_RUN) console.log(`\n⚠ DRY RUN — no changes were applied. Run without DRY_RUN=1 to apply.`);
  console.log();

  await prisma.$disconnect();
  await pool.end();
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
