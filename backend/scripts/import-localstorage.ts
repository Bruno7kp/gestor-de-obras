/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import fs from 'fs/promises';

interface LocalStorageData {
  projects?: any[];
  groups?: any[];
  suppliers?: any[];
  biddings?: any[];
  globalSettings?: any;
}

const getLaborTotals = (
  pagamentos: Array<{ valor?: number }>,
  valorTotal: number,
): { valorPago: number; status: string } => {
  const valorPago = pagamentos.reduce((sum, p) => sum + (p.valor || 0), 0);
  const status =
    valorPago === 0 ? 'pendente' : valorPago >= valorTotal ? 'pago' : 'parcial';
  return { valorPago, status };
};

async function main() {
  const filePath = process.argv[2];
  const instanceName = process.argv[3] || 'Instância Importada';

  if (!filePath) {
    console.error(
      'Uso: ts-node scripts/import-localstorage.ts <data.json> [instanceName]',
    );
    process.exit(1);
  }

  const raw = await fs.readFile(filePath, 'utf-8');
  const data: LocalStorageData = JSON.parse(raw);

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  const instance = await prisma.instance.create({
    data: {
      name: instanceName,
      status: 'ACTIVE',
      globalSettings: {
        create: {
          defaultCompanyName:
            data.globalSettings?.defaultCompanyName ||
            'Sua Empresa de Engenharia',
          companyCnpj: data.globalSettings?.companyCnpj || '',
          userName: data.globalSettings?.userName || 'Administrador',
          language: data.globalSettings?.language || 'pt-BR',
          currencySymbol: data.globalSettings?.currencySymbol || 'R$',
          certificates: {
            create: (data.globalSettings?.certificates || []).map(
              (cert: any) => ({
                id: cert.id,
                name: cert.name,
                issuer: cert.issuer,
                expirationDate: new Date(cert.expirationDate),
                status: cert.status,
              }),
            ),
          },
        },
      },
      subscription: {
        create: {
          plan: 'TRIAL',
          status: 'ACTIVE',
          startDate: new Date(),
          billingCycle: 'monthly',
        },
      },
    },
  });

  const instanceId = instance.id;

  if (data.groups?.length) {
    await prisma.projectGroup.createMany({
      data: data.groups.map((group) => ({
        id: group.id,
        parentId: group.parentId || null,
        name: group.name,
        order: group.order || 0,
        instanceId,
      })),
    });
  }

  if (data.suppliers?.length) {
    await prisma.supplier.createMany({
      data: data.suppliers.map((supplier) => ({
        id: supplier.id,
        name: supplier.name,
        cnpj: supplier.cnpj,
        contactName: supplier.contactName || '',
        email: supplier.email || '',
        phone: supplier.phone || '',
        category: supplier.category,
        rating: supplier.rating || 0,
        notes: supplier.notes || '',
        order: supplier.order || 0,
        instanceId,
      })),
    });
  }

  if (data.biddings?.length) {
    await prisma.biddingProcess.createMany({
      data: data.biddings.map((bidding: any) => ({
        id: bidding.id,
        tenderNumber: bidding.tenderNumber,
        clientName: bidding.clientName,
        object: bidding.object,
        openingDate: bidding.openingDate,
        expirationDate: bidding.expirationDate,
        estimatedValue: bidding.estimatedValue,
        ourProposalValue: bidding.ourProposalValue,
        status: bidding.status,
        bdi: bidding.bdi,
        itemsSnapshot: bidding.items || [],
        assetsSnapshot: bidding.assets || [],
        instanceId,
      })),
    });
  }

  for (const project of data.projects || []) {
    const created = await prisma.project.create({
      data: {
        id: project.id,
        groupId: project.groupId || null,
        name: project.name,
        companyName: project.companyName,
        companyCnpj: project.companyCnpj || '',
        location: project.location || '',
        measurementNumber: project.measurementNumber || 1,
        referenceDate:
          project.referenceDate ?? new Date().toISOString().slice(0, 10),
        logo: project.logo || null,
        bdi: project.bdi ?? 25,
        contractTotalOverride: project.contractTotalOverride || null,
        currentTotalOverride: project.currentTotalOverride || null,
        strict: project.config?.strict ?? false,
        printCards: project.config?.printCards ?? true,
        printSubtotals: project.config?.printSubtotals ?? true,
        showSignatures: project.config?.showSignatures ?? true,
        instanceId,
        theme: project.theme
          ? {
              create: {
                fontFamily: project.theme.fontFamily,
                primary: project.theme.primary,
                accent: project.theme.accent,
                accentText: project.theme.accentText,
                border: project.theme.border,
                currencySymbol: project.theme.currencySymbol || null,
                headerBg: project.theme.header?.bg || '',
                headerText: project.theme.header?.text || '',
                categoryBg: project.theme.category?.bg || '',
                categoryText: project.theme.category?.text || '',
                footerBg: project.theme.footer?.bg || '',
                footerText: project.theme.footer?.text || '',
                kpiBg: project.theme.kpiHighlight?.bg || '',
                kpiText: project.theme.kpiHighlight?.text || '',
              },
            }
          : undefined,
        planning: {
          create: {
            schedule: project.planning?.schedule || {},
          },
        },
        journal: {
          create: {},
        },
      },
      include: {
        planning: { select: { id: true } },
        journal: { select: { id: true } },
      },
    });

    const planningId = created.planning?.id;
    if (!planningId) {
      throw new Error('Projeto importado sem planejamento');
    }

    const journalId = created.journal?.id;
    if (!journalId) {
      throw new Error('Projeto importado sem diario');
    }

    if (project.items?.length) {
      await prisma.workItem.createMany({
        data: project.items.map((item: any) => ({
          ...item,
          projectId: created.id,
        })),
      });
    }

    if (project.history?.length) {
      await prisma.measurementSnapshot.createMany({
        data: project.history.map((snap: any) => ({
          measurementNumber: snap.measurementNumber,
          date: snap.date,
          itemsSnapshot: snap.items || [],
          totals: snap.totals || {},
          projectId: created.id,
        })),
      });
    }

    if (project.assets?.length) {
      await prisma.projectAsset.createMany({
        data: project.assets.map((asset: any) => ({
          ...asset,
          projectId: created.id,
        })),
      });
    }

    if (project.expenses?.length) {
      await prisma.projectExpense.createMany({
        data: project.expenses.map((expense: any) => ({
          ...expense,
          status: expense.status || (expense.isPaid ? 'PAID' : 'PENDING'),
          issValue: expense.issValue ?? null,
          issPercentage: expense.issPercentage ?? null,
          projectId: created.id,
        })),
      });
    }

    if (project.workforce?.length) {
      await prisma.workforceMember.createMany({
        data: project.workforce.map((member: any) => ({
          id: member.id,
          nome: member.nome,
          cpf_cnpj: member.cpf_cnpj,
          empresa_vinculada: member.empresa_vinculada,
          foto: member.foto || null,
          cargo: member.cargo,
          projectId: created.id,
        })),
      });

      for (const member of project.workforce) {
        if (member.documentos?.length) {
          await prisma.staffDocument.createMany({
            data: member.documentos.map((doc: any) => ({
              id: doc.id,
              nome: doc.nome,
              dataVencimento: doc.dataVencimento,
              arquivoUrl: doc.arquivoUrl || null,
              status: doc.status,
              workforceMemberId: member.id,
            })),
          });
        }

        if (member.linkedWorkItemIds?.length) {
          await prisma.workItemResponsibility.createMany({
            data: member.linkedWorkItemIds.map((workItemId: string) => ({
              workItemId,
              workforceMemberId: member.id,
            })),
            skipDuplicates: true,
          });
        }
      }
    }

    if (project.laborContracts?.length) {
      for (const contract of project.laborContracts) {
        const pagamentos = contract.pagamentos || [];
        const totals = getLaborTotals(pagamentos, contract.valorTotal || 0);

        const createdContract = await (
          prisma as unknown as any
        ).laborContract.create({
          data: {
            id: contract.id,
            projectId: created.id,
            tipo: contract.tipo,
            descricao: contract.descricao,
            associadoId: contract.associadoId,
            valorTotal: contract.valorTotal || 0,
            valorPago: totals.valorPago,
            status: totals.status,
            dataInicio: contract.dataInicio,
            dataFim: contract.dataFim || null,
            linkedWorkItemId: contract.linkedWorkItemId || null,
            observacoes: contract.observacoes || null,
            ordem: contract.ordem || 0,
          },
        });

        if (pagamentos.length) {
          await (prisma as unknown as any).laborPayment.createMany({
            data: pagamentos.map((pag: any) => ({
              id: pag.id,
              data: pag.data,
              valor: pag.valor,
              descricao: pag.descricao || '',
              comprovante: pag.comprovante || null,
              laborContractId: createdContract.id,
            })),
          });
        }
      }
    }

    if (project.planning?.tasks?.length) {
      await prisma.planningTask.createMany({
        data: project.planning.tasks.map((task: any) => ({
          id: task.id,
          categoryId: task.categoryId || null,
          description: task.description,
          status: task.status,
          isCompleted: task.isCompleted,
          dueDate: task.dueDate,
          createdAt: task.createdAt,
          completedAt: task.completedAt || null,
          projectPlanningId: planningId,
        })),
      });
    }

    if (project.planning?.forecasts?.length) {
      await prisma.materialForecast.createMany({
        data: project.planning.forecasts.map((forecast: any) => ({
          id: forecast.id,
          description: forecast.description,
          unit: forecast.unit,
          quantityNeeded: forecast.quantityNeeded,
          unitPrice: forecast.unitPrice,
          estimatedDate: forecast.estimatedDate,
          purchaseDate: forecast.purchaseDate || null,
          deliveryDate: forecast.deliveryDate || null,
          status: forecast.status,
          isPaid: forecast.isPaid,
          order: forecast.order || 0,
          supplierId: forecast.supplierId || null,
          paymentProof: forecast.paymentProof || null,
          projectPlanningId: planningId,
        })),
      });
    }

    if (project.planning?.milestones?.length) {
      await prisma.milestone.createMany({
        data: project.planning.milestones.map((milestone: any) => ({
          id: milestone.id,
          title: milestone.title,
          date: milestone.date,
          isCompleted: milestone.isCompleted,
          projectPlanningId: planningId,
        })),
      });
    }

    if (project.journal?.entries?.length) {
      await prisma.journalEntry.createMany({
        data: project.journal.entries.map((entry: any) => ({
          id: entry.id,
          timestamp: entry.timestamp,
          type: entry.type,
          category: entry.category,
          title: entry.title,
          description: entry.description,
          weatherStatus: entry.weatherStatus || null,
          photoUrls: entry.photoUrls || [],
          projectJournalId: journalId,
        })),
      });
    }
  }

  await prisma.$disconnect();
  console.log('Importação concluída para instância:', instanceId);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
