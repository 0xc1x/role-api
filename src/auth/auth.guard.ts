import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { createSecretKey } from 'node:crypto';
import { jwtVerify } from 'jose';
import { eq } from 'drizzle-orm';
import { Inject } from '@nestjs/common';
import type { AppRole } from '@0xc1x/role-commons';
import { IS_PUBLIC_KEY } from '../common/decorators/public.decorator';
import type { Env } from '../config/env.schema';
import { type Database } from '../database/database.module';
import { DRIZZLE } from '../database/database.tokens';
import { profiles } from '../database/schema';
import type { AuthUser } from './auth.types';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly config: ConfigService<Env, true>,
    @Inject(DRIZZLE) private readonly db: Database,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<{
      headers: { authorization?: string };
      user?: AuthUser;
    }>();

    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid Authorization header');
    }

    const token = header.slice('Bearer '.length).trim();
    if (!token) {
      throw new UnauthorizedException('Missing access token');
    }

    let sub: string;
    let email: string | null = null;

    try {
      const secret = this.config.get('SUPABASE_JWT_SECRET', { infer: true });
      const key = createSecretKey(Buffer.from(secret, 'utf8'));
      const { payload } = await jwtVerify(token, key, {
        algorithms: ['HS256'],
      });

      if (!payload.sub || typeof payload.sub !== 'string') {
        throw new UnauthorizedException('Invalid token subject');
      }
      sub = payload.sub;
      email =
        typeof payload.email === 'string'
          ? payload.email
          : typeof payload.user_email === 'string'
            ? payload.user_email
            : null;
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException('Invalid or expired access token');
    }

    const [profile] = await this.db
      .select({
        id: profiles.id,
        email: profiles.email,
        role: profiles.role,
      })
      .from(profiles)
      .where(eq(profiles.id, sub))
      .limit(1);

    if (!profile) {
      throw new UnauthorizedException('Profile not found for authenticated user');
    }

    request.user = {
      id: profile.id,
      email: profile.email ?? email,
      role: profile.role as AppRole,
    };

    return true;
  }
}
