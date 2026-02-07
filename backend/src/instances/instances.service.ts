import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RolesService } from '../roles/roles.service';

interface CreateInstanceInput {
  name: string;
  status?: string;
}

@Injectable()
export class InstancesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rolesService: RolesService,
  ) {}

  async create(input: CreateInstanceInput) {
    const instance = await this.prisma.instance.create({
      data: {
        name: input.name,
        status: input.status || 'ACTIVE',
      },
    });

    await this.rolesService.seedDefaultRoles(instance.id);

    return instance;
  }

  findAll() {
    return this.prisma.instance.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  findById(id: string) {
    return this.prisma.instance.findUnique({
      where: { id },
    });
  }
}
