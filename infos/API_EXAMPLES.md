# API Routes - Exemplos de Implementação

Este documento contém exemplos práticos de como implementar as rotas de API para o ProMeasure Pro usando Next.js 14+ (App Router) e Prisma.

## 📁 Estrutura de Pastas

```
app/
  api/
    projects/
      route.ts              # GET /api/projects (listar)
      [id]/
        route.ts            # GET/PUT/DELETE /api/projects/:id
        work-items/
          route.ts          # GET/POST /api/projects/:id/work-items
          [itemId]/
            route.ts        # GET/PUT/DELETE /api/projects/:id/work-items/:itemId
    auth/
      login/route.ts
      register/route.ts
    organizations/
      [id]/
        members/route.ts
```

## 🔐 Middleware de Autenticação

```typescript
// lib/auth.ts
import { NextRequest } from 'next/server';
import { verify } from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';

export interface AuthenticatedRequest extends NextRequest {
  user: {
    id: string;
    email: string;
    organizationId: string;
    role: string;
  };
}

export async function authenticate(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  
  if (!token) {
    throw new Error('No token provided');
  }
  
  try {
    const decoded = verify(token, process.env.JWT_SECRET!) as any;
    
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        organizationId: true,
        role: true,
      },
    });
    
    if (!user) {
      throw new Error('User not found');
    }
    
    return user;
  } catch (error) {
    throw new Error('Invalid token');
  }
}

// Wrapper para rotas protegidas
export function withAuth(handler: (req: NextRequest, user: any) => Promise<Response>) {
  return async (req: NextRequest) => {
    try {
      const user = await authenticate(req);
      return await handler(req, user);
    } catch (error) {
      return Response.json(
        { error: error.message },
        { status: 401 }
      );
    }
  };
}
```

## 🏢 Middleware de Validação de Tier

```typescript
// lib/tier-validation.ts
import { prisma } from '@/lib/prisma';

export const TIER_LIMITS = {
  FREE: { projects: 3, users: 2, storage: 100 * 1024 * 1024 },
  PRO: { projects: 50, users: 10, storage: 10 * 1024 * 1024 * 1024 },
  ENTERPRISE: { projects: -1, users: -1, storage: -1 },
};

export async function checkProjectLimit(organizationId: string) {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    include: {
      _count: { select: { projects: true } },
    },
  });
  
  if (!org) {
    throw new Error('Organization not found');
  }
  
  const limit = TIER_LIMITS[org.planTier].projects;
  
  if (limit !== -1 && org._count.projects >= limit) {
    throw new Error(
      `Project limit reached (${limit}). Upgrade to ${org.planTier === 'FREE' ? 'PRO' : 'ENTERPRISE'} plan.`
    );
  }
}

export async function checkUserLimit(organizationId: string) {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    include: {
      _count: { select: { users: true } },
    },
  });
  
  if (!org) {
    throw new Error('Organization not found');
  }
  
  const limit = TIER_LIMITS[org.planTier].users;
  
  if (limit !== -1 && org._count.users >= limit) {
    throw new Error(
      `User limit reached (${limit}). Upgrade to PRO plan.`
    );
  }
}

export async function checkStorageLimit(organizationId: string, additionalBytes: number) {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    include: {
      assets: {
        select: { fileSize: true },
      },
    },
  });
  
  if (!org) {
    throw new Error('Organization not found');
  }
  
  const currentUsage = org.assets.reduce((sum, asset) => sum + Number(asset.fileSize), 0);
  const limit = TIER_LIMITS[org.planTier].storage;
  
  if (limit !== -1 && currentUsage + additionalBytes > limit) {
    const limitMB = (limit / (1024 * 1024)).toFixed(0);
    throw new Error(
      `Storage limit reached (${limitMB}MB). Upgrade to PRO plan.`
    );
  }
}
```

## 📋 API: Listar Projetos

```typescript
// app/api/projects/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const GET = withAuth(async (req: NextRequest, user) => {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');
  const groupId = searchParams.get('groupId');
  
  const projects = await prisma.project.findMany({
    where: {
      organizationId: user.organizationId,
      ...(status && { status }),
      ...(groupId && { groupId }),
      deletedAt: null,
    },
    include: {
      group: { select: { name: true } },
      creator: { select: { name: true, email: true } },
      _count: {
        select: {
          workItems: true,
          members: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
  
  return NextResponse.json(projects);
});

export const POST = withAuth(async (req: NextRequest, user) => {
  const body = await req.json();
  
  // Validar limite de projetos
  await checkProjectLimit(user.organizationId);
  
  const project = await prisma.project.create({
    data: {
      name: body.name,
      companyName: body.companyName,
      location: body.location,
      contractTotal: body.contractTotal || 0,
      bdi: body.bdi || 0,
      organizationId: user.organizationId,
      creatorId: user.id,
      groupId: body.groupId,
    },
  });
  
  // Criar audit log
  await prisma.auditLog.create({
    data: {
      action: 'CREATE_PROJECT',
      entityType: 'PROJECT',
      entityId: project.id,
      newValue: { name: project.name },
      userId: user.id,
      organizationId: user.organizationId,
    },
  });
  
  return NextResponse.json(project, { status: 201 });
});
```

## 🔍 API: Obter Projeto Específico

```typescript
// app/api/projects/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const GET = withAuth(async (
  req: NextRequest,
  user,
  { params }: { params: { id: string } }
) => {
  const project = await prisma.project.findFirst({
    where: {
      id: params.id,
      organizationId: user.organizationId,
      deletedAt: null,
    },
    include: {
      workItems: {
        orderBy: { order: 'asc' },
      },
      theme: true,
      members: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      },
    },
  });
  
  if (!project) {
    return NextResponse.json(
      { error: 'Project not found' },
      { status: 404 }
    );
  }
  
  return NextResponse.json(project);
});

export const PUT = withAuth(async (
  req: NextRequest,
  user,
  { params }: { params: { id: string } }
) => {
  const body = await req.json();
  
  // Verificar se projeto existe e pertence à organização
  const existing = await prisma.project.findFirst({
    where: {
      id: params.id,
      organizationId: user.organizationId,
    },
  });
  
  if (!existing) {
    return NextResponse.json(
      { error: 'Project not found' },
      { status: 404 }
    );
  }
  
  const updated = await prisma.project.update({
    where: { id: params.id },
    data: {
      name: body.name,
      companyName: body.companyName,
      location: body.location,
      contractTotal: body.contractTotal,
      bdi: body.bdi,
      status: body.status,
    },
  });
  
  // Audit log
  await prisma.auditLog.create({
    data: {
      action: 'UPDATE_PROJECT',
      entityType: 'PROJECT',
      entityId: params.id,
      oldValue: existing,
      newValue: updated,
      userId: user.id,
      organizationId: user.organizationId,
    },
  });
  
  return NextResponse.json(updated);
});

export const DELETE = withAuth(async (
  req: NextRequest,
  user,
  { params }: { params: { id: string } }
) => {
  // Soft delete
  const deleted = await prisma.project.update({
    where: {
      id: params.id,
      organizationId: user.organizationId,
    },
    data: {
      deletedAt: new Date(),
    },
  });
  
  await prisma.auditLog.create({
    data: {
      action: 'DELETE_PROJECT',
      entityType: 'PROJECT',
      entityId: params.id,
      userId: user.id,
      organizationId: user.organizationId,
    },
  });
  
  return NextResponse.json({ success: true });
});
```

## 🏗️ API: WorkItems (EAP)

```typescript
// app/api/projects/[id]/work-items/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const GET = withAuth(async (
  req: NextRequest,
  user,
  { params }: { params: { id: string } }
) => {
  const items = await prisma.workItem.findMany({
    where: { projectId: params.id },
    orderBy: [
      { order: 'asc' },
      { wbs: 'asc' },
    ],
  });
  
  return NextResponse.json(items);
});

export const POST = withAuth(async (
  req: NextRequest,
  user,
  { params }: { params: { id: string } }
) => {
  const body = await req.json();
  
  // Verificar se projeto pertence à organização
  const project = await prisma.project.findFirst({
    where: {
      id: params.id,
      organizationId: user.organizationId,
    },
  });
  
  if (!project) {
    return NextResponse.json(
      { error: 'Project not found' },
      { status: 404 }
    );
  }
  
  const item = await prisma.workItem.create({
    data: {
      description: body.description,
      type: body.type,
      wbs: body.wbs,
      order: body.order,
      unit: body.unit || 'UN',
      code: body.code,
      source: body.source,
      contractQuantity: body.contractQuantity || 0,
      unitPrice: body.unitPrice || 0,
      unitPriceNoBdi: body.unitPriceNoBdi || 0,
      contractTotal: body.contractTotal || 0,
      parentId: body.parentId,
      projectId: params.id,
    },
  });
  
  return NextResponse.json(item, { status: 201 });
});
```

## 📸 API: Criar Snapshot de Medição

```typescript
// app/api/projects/[id]/snapshots/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const POST = withAuth(async (
  req: NextRequest,
  user,
  { params }: { params: { id: string } }
) => {
  const body = await req.json();
  
  // Obter todos os work items atuais
  const items = await prisma.workItem.findMany({
    where: { projectId: params.id },
  });
  
  // Calcular totais
  const contractTotal = items.reduce((sum, item) => sum + Number(item.contractTotal), 0);
  const periodTotal = items.reduce((sum, item) => sum + Number(item.currentTotal), 0);
  const accumulatedTotal = items.reduce((sum, item) => sum + Number(item.accumulatedTotal), 0);
  const progressPercent = contractTotal > 0 ? (accumulatedTotal / contractTotal) * 100 : 0;
  
  // Criar snapshot
  const snapshot = await prisma.measurementSnapshot.create({
    data: {
      projectId: params.id,
      measurementNumber: body.measurementNumber,
      referenceDate: new Date(body.referenceDate),
      contractTotal,
      periodTotal,
      accumulatedTotal,
      progressPercent,
      itemsSnapshot: items, // JSON congelado
    },
  });
  
  // Atualizar projeto
  await prisma.project.update({
    where: { id: params.id },
    data: {
      measurementNumber: body.measurementNumber,
      referenceDate: new Date(body.referenceDate),
    },
  });
  
  // Criar entrada automática no diário
  await prisma.journalEntry.create({
    data: {
      type: 'AUTO',
      category: 'PROGRESS',
      title: `Medição ${body.measurementNumber} realizada`,
      description: `Progresso: ${progressPercent.toFixed(2)}% | Valor: R$ ${accumulatedTotal.toFixed(2)}`,
      projectId: params.id,
      authorId: user.id,
    },
  });
  
  return NextResponse.json(snapshot, { status: 201 });
});
```

## 🔐 API: Gerenciar Membros do Projeto

```typescript
// app/api/projects/[id]/members/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const GET = withAuth(async (
  req: NextRequest,
  user,
  { params }: { params: { id: string } }
) => {
  const members = await prisma.projectMember.findMany({
    where: { projectId: params.id },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      },
    },
  });
  
  return NextResponse.json(members);
});

export const POST = withAuth(async (
  req: NextRequest,
  user,
  { params }: { params: { id: string } }
) => {
  const body = await req.json();
  
  // Apenas ADMIN e MANAGER podem adicionar membros
  if (!['ADMIN', 'MANAGER'].includes(user.role)) {
    return NextResponse.json(
      { error: 'Insufficient permissions' },
      { status: 403 }
    );
  }
  
  const member = await prisma.projectMember.create({
    data: {
      userId: body.userId,
      projectId: params.id,
      accessLevel: body.accessLevel || 'READ',
    },
  });
  
  return NextResponse.json(member, { status: 201 });
});
```

## 📊 API: Estatísticas da Organização

```typescript
// app/api/organizations/[id]/stats/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const GET = withAuth(async (
  req: NextRequest,
  user,
  { params }: { params: { id: string } }
) => {
  // Verificar se usuário pertence à organização
  if (user.organizationId !== params.id) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 403 }
    );
  }
  
  const [
    projectCount,
    userCount,
    activeProjects,
    totalContractValue,
    storageUsage,
  ] = await Promise.all([
    prisma.project.count({
      where: { organizationId: params.id, deletedAt: null },
    }),
    prisma.user.count({
      where: { organizationId: params.id },
    }),
    prisma.project.count({
      where: { 
        organizationId: params.id,
        status: 'ACTIVE',
        deletedAt: null,
      },
    }),
    prisma.project.aggregate({
      where: { organizationId: params.id, deletedAt: null },
      _sum: { contractTotal: true },
    }),
    prisma.projectAsset.aggregate({
      where: {
        project: { organizationId: params.id },
      },
      _sum: { fileSize: true },
    }),
  ]);
  
  const org = await prisma.organization.findUnique({
    where: { id: params.id },
  });
  
  const stats = {
    projects: {
      current: projectCount,
      limit: TIER_LIMITS[org.planTier].projects,
      active: activeProjects,
    },
    users: {
      current: userCount,
      limit: TIER_LIMITS[org.planTier].users,
    },
    storage: {
      current: Number(storageUsage._sum.fileSize || 0),
      limit: TIER_LIMITS[org.planTier].storage,
    },
    financial: {
      totalContractValue: Number(totalContractValue._sum.contractTotal || 0),
    },
    tier: org.planTier,
  };
  
  return NextResponse.json(stats);
});
```

## 🧪 Testes de Exemplo

```typescript
// __tests__/api/projects.test.ts
import { POST } from '@/app/api/projects/route';
import { prisma } from '@/lib/prisma';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    project: {
      create: jest.fn(),
    },
    organization: {
      findUnique: jest.fn(),
    },
  },
}));

describe('POST /api/projects', () => {
  it('should create a project within tier limits', async () => {
    // Mock organization with FREE tier
    (prisma.organization.findUnique as jest.Mock).mockResolvedValue({
      id: 'org_1',
      planTier: 'FREE',
      _count: { projects: 2 }, // Under limit of 3
    });
    
    const req = new Request('http://localhost/api/projects', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Test Project',
        companyName: 'Test Company',
      }),
    });
    
    const response = await POST(req as any, {
      id: 'user_1',
      organizationId: 'org_1',
      role: 'ADMIN',
    });
    
    expect(response.status).toBe(201);
  });
  
  it('should reject when tier limit is reached', async () => {
    (prisma.organization.findUnique as jest.Mock).mockResolvedValue({
      id: 'org_1',
      planTier: 'FREE',
      _count: { projects: 3 }, // At limit
    });
    
    const req = new Request('http://localhost/api/projects', {
      method: 'POST',
      body: JSON.stringify({ name: 'Test' }),
    });
    
    await expect(
      POST(req as any, { organizationId: 'org_1' })
    ).rejects.toThrow('Project limit reached');
  });
});
```

---

## 📚 Recursos Adicionais

- [Next.js App Router](https://nextjs.org/docs/app)
- [Prisma Client API](https://www.prisma.io/docs/reference/api-reference/prisma-client-reference)
- [NextAuth.js](https://next-auth.js.org/)
- [Zod Validation](https://zod.dev/)
