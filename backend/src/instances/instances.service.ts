import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface CreateInstanceInput {
  name: string;
  status?: string;
}

@Injectable()
export class InstancesService {
  constructor(private readonly prisma: PrismaService) {}

  create(input: CreateInstanceInput) {
    return this.prisma.instance.create({
      data: {
        name: input.name,
        status: input.status || 'ACTIVE',
      },
    });
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
