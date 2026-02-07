import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

interface JwtPayload {
  sub: string;
  instanceId: string;
  instanceName?: string;
  roles: string[];
  permissions?: string[];
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    const cookieExtractor = (
      req: { cookies?: Record<string, string> } | undefined,
    ) => req?.cookies?.promeasure_token ?? null;

    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        cookieExtractor,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'change-me',
    });
  }

  validate(payload: JwtPayload) {
    return {
      id: payload.sub,
      instanceId: payload.instanceId,
      instanceName: payload.instanceName,
      roles: payload.roles,
      permissions: payload.permissions ?? [],
    };
  }
}
