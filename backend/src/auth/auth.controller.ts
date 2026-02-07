import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import type { AuthenticatedRequest } from './auth.types';
import { PrismaService } from '../prisma/prisma.service';

interface LoginBody {
  email: string;
  password: string;
  instanceId: string;
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('login')
  async login(
    @Body() body: LoginBody,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(body);
    res.cookie('promeasure_token', result.accessToken, {
      httpOnly: true,
      sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 12 * 60 * 60 * 1000,
      path: '/',
    });

    return result;
  }

  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('promeasure_token', { path: '/' });
    return { ok: true };
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('me')
  async me(@Req() req: AuthenticatedRequest) {
    if (req.user.instanceName) return req.user;

    const instance = await this.prisma.instance.findUnique({
      where: { id: req.user.instanceId },
      select: { name: true },
    });

    return {
      ...req.user,
      instanceName: instance?.name,
    };
  }
}
