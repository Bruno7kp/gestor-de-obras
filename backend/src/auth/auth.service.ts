import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';

interface LoginInput {
  email: string;
  password: string;
  instanceId: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(input: LoginInput) {
    const instance = await this.prisma.instance.findFirst({
      where: {
        OR: [
          { id: input.instanceId },
          { name: { equals: input.instanceId, mode: 'insensitive' } },
        ],
      },
    });

    if (!instance) {
      throw new UnauthorizedException('Credenciais invalidas');
    }

    const user = await this.prisma.user.findFirst({
      where: {
        email: input.email,
        instanceId: instance.id,
      },
      include: {
        roles: { include: { role: true } },
      },
    });

    if (!user) throw new UnauthorizedException('Credenciais invalidas');

    const passwordValid = await bcrypt.compare(
      input.password,
      user.passwordHash,
    );
    if (!passwordValid)
      throw new UnauthorizedException('Credenciais invalidas');

    const payload = {
      sub: user.id,
      instanceId: instance.id,
      instanceName: instance.name,
      roles: user.roles.map((r) => r.role.name),
    };

    return {
      accessToken: await this.jwtService.signAsync(payload),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        instanceId: instance.id,
        instanceName: instance.name,
        roles: payload.roles,
      },
    };
  }
}
