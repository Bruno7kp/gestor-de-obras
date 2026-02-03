import { PrismaClient, PlanTier, UserRole, ProjectStatus, ItemType } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // ============================================================================
  // 1. Criar Organização de Teste (Tier FREE)
  // ============================================================================
  
  const org = await prisma.organization.upsert({
    where: { slug: 'construtora-demo' },
    update: {},
    create: {
      name: 'Construtora Demo Ltda',
      slug: 'construtora-demo',
      planTier: PlanTier.FREE,
      projectLimit: 3,
      userLimit: 2,
      storageLimit: 104857600, // 100MB
    },
  });

  console.log('✅ Organization created:', org.name);

  // ============================================================================
  // 2. Criar Usuários
  // ============================================================================

  const passwordHash = await bcrypt.hash('senha123', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@demo.com' },
    update: {},
    create: {
      email: 'admin@demo.com',
      name: 'João Silva',
      passwordHash,
      role: UserRole.ADMIN,
      emailVerified: true,
      position: 'Diretor de Obras',
      organizationId: org.id,
    },
  });

  const engineer = await prisma.user.upsert({
    where: { email: 'engenheiro@demo.com' },
    update: {},
    create: {
      email: 'engenheiro@demo.com',
      name: 'Maria Santos',
      passwordHash,
      role: UserRole.ENGINEER,
      emailVerified: true,
      position: 'Engenheira de Campo',
      organizationId: org.id,
    },
  });

  console.log('✅ Users created:', admin.name, engineer.name);

  // ============================================================================
  // 3. Criar Grupo de Projetos
  // ============================================================================

  const group = await prisma.projectGroup.create({
    data: {
      name: 'Obras 2024',
      order: 0,
      organizationId: org.id,
    },
  });

  console.log('✅ Project group created:', group.name);

  // ============================================================================
  // 4. Criar Projeto de Exemplo
  // ============================================================================

  const project = await prisma.project.create({
    data: {
      name: 'Reforma da Escola Municipal',
      companyName: 'Prefeitura Municipal',
      location: 'São Paulo - SP',
      status: ProjectStatus.ACTIVE,
      contractTotal: 500000.00,
      bdi: 28.50,
      measurementNumber: 1,
      referenceDate: new Date('2024-02-01'),
      strictMode: false,
      printCards: true,
      printSubtotals: true,
      showSignatures: true,
      organizationId: org.id,
      groupId: group.id,
      creatorId: admin.id,
    },
  });

  console.log('✅ Project created:', project.name);

  // ============================================================================
  // 5. Atribuir Membros ao Projeto
  // ============================================================================

  await prisma.projectMember.createMany({
    data: [
      {
        userId: admin.id,
        projectId: project.id,
        accessLevel: 'ADMIN',
      },
      {
        userId: engineer.id,
        projectId: project.id,
        accessLevel: 'WRITE',
      },
    ],
  });

  console.log('✅ Project members assigned');

  // ============================================================================
  // 6. Criar Estrutura de WorkItems (EAP Simples)
  // ============================================================================

  // Categoria 1: Serviços Preliminares
  const cat1 = await prisma.workItem.create({
    data: {
      description: 'SERVIÇOS PRELIMINARES',
      type: ItemType.CATEGORY,
      wbs: '1',
      order: 0,
      unit: '-',
      contractQuantity: 0,
      unitPrice: 0,
      unitPriceNoBdi: 0,
      contractTotal: 45000.00,
      projectId: project.id,
    },
  });

  await prisma.workItem.createMany({
    data: [
      {
        description: 'Mobilização e desmobilização',
        type: ItemType.ITEM,
        wbs: '1.1',
        order: 0,
        parentId: cat1.id,
        unit: 'UN',
        code: 'SINAPI-74209/001',
        source: 'SINAPI',
        contractQuantity: 1,
        unitPrice: 15000.00,
        unitPriceNoBdi: 11673.15,
        contractTotal: 15000.00,
        currentQuantity: 1,
        currentTotal: 15000.00,
        currentPercentage: 100.00,
        accumulatedQuantity: 1,
        accumulatedTotal: 15000.00,
        accumulatedPercentage: 100.00,
        balanceQuantity: 0,
        balanceTotal: 0,
        projectId: project.id,
      },
      {
        description: 'Placa de obra',
        type: ItemType.ITEM,
        wbs: '1.2',
        order: 1,
        parentId: cat1.id,
        unit: 'm²',
        code: 'SINAPI-74080/001',
        source: 'SINAPI',
        contractQuantity: 6,
        unitPrice: 850.00,
        unitPriceNoBdi: 661.48,
        contractTotal: 5100.00,
        currentQuantity: 6,
        currentTotal: 5100.00,
        currentPercentage: 100.00,
        accumulatedQuantity: 6,
        accumulatedTotal: 5100.00,
        accumulatedPercentage: 100.00,
        balanceQuantity: 0,
        balanceTotal: 0,
        projectId: project.id,
      },
    ],
  });

  // Categoria 2: Alvenaria e Estrutura
  const cat2 = await prisma.workItem.create({
    data: {
      description: 'ALVENARIA E ESTRUTURA',
      type: ItemType.CATEGORY,
      wbs: '2',
      order: 1,
      unit: '-',
      contractQuantity: 0,
      unitPrice: 0,
      unitPriceNoBdi: 0,
      contractTotal: 180000.00,
      projectId: project.id,
    },
  });

  await prisma.workItem.createMany({
    data: [
      {
        description: 'Alvenaria de vedação - tijolo cerâmico',
        type: ItemType.ITEM,
        wbs: '2.1',
        order: 0,
        parentId: cat2.id,
        unit: 'm²',
        code: 'SINAPI-87447',
        source: 'SINAPI',
        contractQuantity: 450,
        unitPrice: 120.00,
        unitPriceNoBdi: 93.38,
        contractTotal: 54000.00,
        currentQuantity: 180,
        currentTotal: 21600.00,
        currentPercentage: 40.00,
        accumulatedQuantity: 180,
        accumulatedTotal: 21600.00,
        accumulatedPercentage: 40.00,
        balanceQuantity: 270,
        balanceTotal: 32400.00,
        projectId: project.id,
      },
      {
        description: 'Concreto FCK 25 MPa',
        type: ItemType.ITEM,
        wbs: '2.2',
        order: 1,
        parentId: cat2.id,
        unit: 'm³',
        code: 'SINAPI-04330',
        source: 'SINAPI',
        contractQuantity: 85,
        unitPrice: 580.00,
        unitPriceNoBdi: 451.36,
        contractTotal: 49300.00,
        currentQuantity: 25,
        currentTotal: 14500.00,
        currentPercentage: 29.41,
        accumulatedQuantity: 25,
        accumulatedTotal: 14500.00,
        accumulatedPercentage: 29.41,
        balanceQuantity: 60,
        balanceTotal: 34800.00,
        projectId: project.id,
      },
    ],
  });

  console.log('✅ WorkItems created (2 categories, 4 items)');

  // ============================================================================
  // 7. Criar Snapshot Inicial
  // ============================================================================

  const allItems = await prisma.workItem.findMany({
    where: { projectId: project.id },
  });

  await prisma.measurementSnapshot.create({
    data: {
      projectId: project.id,
      measurementNumber: 1,
      referenceDate: new Date('2024-02-01'),
      contractTotal: 500000.00,
      periodTotal: 36100.00,
      accumulatedTotal: 36100.00,
      progressPercent: 7.22,
      itemsSnapshot: allItems,
    },
  });

  console.log('✅ Measurement snapshot created');

  // ============================================================================
  // 8. Criar Despesas de Exemplo
  // ============================================================================

  await prisma.projectExpense.createMany({
    data: [
      {
        description: 'Cimento CP-II 50kg',
        entityName: 'Cimento Forte Ltda',
        type: 'MATERIAL',
        itemType: ItemType.ITEM,
        wbs: '1',
        order: 0,
        date: new Date('2024-01-15'),
        paymentDate: new Date('2024-01-30'),
        unit: 'SC',
        quantity: 150,
        unitPrice: 32.50,
        amount: 4875.00,
        isPaid: true,
        projectId: project.id,
      },
      {
        description: 'Pedreiro - Janeiro/2024',
        entityName: 'José Pereira da Silva',
        type: 'LABOR',
        itemType: ItemType.ITEM,
        wbs: '2',
        order: 0,
        date: new Date('2024-01-31'),
        paymentDate: new Date('2024-02-05'),
        unit: 'MÊS',
        quantity: 1,
        unitPrice: 3500.00,
        amount: 3500.00,
        isPaid: true,
        projectId: project.id,
      },
    ],
  });

  console.log('✅ Expenses created');

  // ============================================================================
  // 9. Criar Entradas de Diário de Obra
  // ============================================================================

  await prisma.journalEntry.createMany({
    data: [
      {
        timestamp: new Date('2024-01-15T08:00:00'),
        type: 'MANUAL',
        category: 'PROGRESS',
        title: 'Início da Alvenaria',
        description: 'Iniciados os serviços de alvenaria no pavimento térreo.',
        weatherStatus: 'SUNNY',
        projectId: project.id,
        authorId: engineer.id,
      },
      {
        timestamp: new Date('2024-01-20T14:30:00'),
        type: 'AUTO',
        category: 'FINANCIAL',
        title: 'Item atingiu 100%',
        description: 'O item "Mobilização e desmobilização" atingiu 100% de execução.',
        projectId: project.id,
        authorId: admin.id,
      },
    ],
  });

  console.log('✅ Journal entries created');

  // ============================================================================
  // 10. Criar Configurações Globais
  // ============================================================================

  await prisma.globalSettings.create({
    data: {
      defaultCompanyName: 'Construtora Demo Ltda',
      companyCnpj: '12.345.678/0001-90',
      userName: 'João Silva',
      language: 'pt-BR',
      currencySymbol: 'R$',
      organizationId: org.id,
    },
  });

  console.log('✅ Global settings created');

  // ============================================================================
  // 11. Criar Tema do Projeto
  // ============================================================================

  await prisma.projectTheme.create({
    data: {
      projectId: project.id,
      fontFamily: 'Inter',
      primary: '#000000',
      accent: '#2563eb',
      accentText: '#ffffff',
      border: '#000000',
      currencySymbol: 'R$',
      headerTheme: { bg: '#0f172a', text: '#ffffff' },
      categoryTheme: { bg: '#f1f5f9', text: '#000000' },
      footerTheme: { bg: '#0f172a', text: '#ffffff' },
      kpiHighlightTheme: { bg: '#eff6ff', text: '#1d4ed8' },
    },
  });

  console.log('✅ Project theme created');

  // ============================================================================
  // 12. Criar Audit Log de Exemplo
  // ============================================================================

  await prisma.auditLog.create({
    data: {
      action: 'CREATE_PROJECT',
      entityType: 'PROJECT',
      entityId: project.id,
      oldValue: null,
      newValue: {
        name: project.name,
        status: project.status,
      },
      userId: admin.id,
      organizationId: org.id,
      ipAddress: '192.168.1.1',
      userAgent: 'Mozilla/5.0 (Seed Script)',
    },
  });

  console.log('✅ Audit log created');

  console.log('\n✅ Seed completed successfully!');
  console.log('\n📊 Summary:');
  console.log(`   Organization: ${org.name} (${org.planTier})`);
  console.log(`   Users: 2 (admin@demo.com, engenheiro@demo.com)`);
  console.log(`   Projects: 1 (${project.name})`);
  console.log(`   WorkItems: 6 (2 categories, 4 items)`);
  console.log(`   Expenses: 2`);
  console.log(`   Journal entries: 2`);
  console.log('\n🔑 Login credentials:');
  console.log('   Email: admin@demo.com');
  console.log('   Password: senha123');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
