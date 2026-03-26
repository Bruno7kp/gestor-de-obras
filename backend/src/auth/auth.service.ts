import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';

interface LoginInput {
  email: string;
  password: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  private async getPermissionsForUser(userId: string): Promise<string[]> {
    const userRoles = await this.prisma.userRole.findMany({
      where: { userId },
      select: { roleId: true },
    });

    if (userRoles.length === 0) {
      return [];
    }

    const roleIds = userRoles.map((ur) => ur.roleId);

    const rolesWithPermissions = await this.prisma.rolePermission.findMany({
      where: {
        roleId: { in: roleIds },
      },
      include: {
        permission: {
          select: { code: true },
        },
      },
    });

    const permissionSet = new Set(
      rolesWithPermissions.map((rp) => rp.permission.code),
    );

    return Array.from(permissionSet);
  }

  async login(input: LoginInput) {
    // Procurar o usuário pelo email (único globalmente)
    const user = await this.prisma.user.findFirst({
      where: {
        email: input.email,
      },
      include: {
        roles: { include: { role: true } },
        instance: true,
      },
    });

    if (!user) throw new UnauthorizedException('Credenciais invalidas');

    const passwordValid = await bcrypt.compare(
      input.password,
      user.passwordHash,
    );
    if (!passwordValid)
      throw new UnauthorizedException('Credenciais invalidas');

    const roles = user.roles.map((r) => r.role.name);
    const permissions = await this.getPermissionsForUser(user.id);

    const payload = {
      sub: user.id,
      instanceId: user.instanceId,
      instanceName: user.instance.name,
      roles,
      permissions,
    };

    return {
      accessToken: await this.jwtService.signAsync(payload),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        profileImage: user.profileImage,
        instanceId: user.instanceId,
        instanceName: user.instance.name,
        roles,
        permissions,
      },
    };
  }

  async findUser(userId: string, instanceId: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        instanceId,
      },
      include: {
        roles: { include: { role: true } },
      },
    });

    if (!user) return null;

    const roles = user.roles.map((r) => r.role.name);
    const permissions = await this.getPermissionsForUser(user.id);

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      profileImage: user.profileImage,
      instanceId,
      roles,
      permissions,
    };
  }
}
