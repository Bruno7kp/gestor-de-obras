import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import type { AuthenticatedRequest } from './auth.types';

interface LoginBody {
  email: string;
  password: string;
  instanceId: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(@Body() body: LoginBody) {
    return this.authService.login(body);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('me')
  me(@Req() req: AuthenticatedRequest) {
    return req.user;
  }
}
