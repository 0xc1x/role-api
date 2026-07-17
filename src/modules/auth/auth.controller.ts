import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { ApiBody, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { AuthUser } from '../../auth/auth.types';
import { AuthService } from './auth.service';
import {
  LoginRequestSchema,
  RegisterRequestSchema,
} from '@0xc1x/role-commons';
import type { LoginRequest, RegisterRequest } from '@0xc1x/role-commons';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sign in with email and password' })
  @ApiBody({ type: Object })
  login(
    @Body(new ZodValidationPipe(LoginRequestSchema))
    body: LoginRequest,
  ) {
    return this.authService.login(body);
  }

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new admin account' })
  @ApiBody({ type: Object })
  register(
    @Body(new ZodValidationPipe(RegisterRequestSchema))
    body: RegisterRequest,
  ) {
    return this.authService.register(body);
  }

  @Get('me')
  @ApiOperation({ summary: 'Get current authenticated user profile' })
  @ApiOkResponse({ description: 'The authenticated user profile' })
  getProfile(@CurrentUser() user: AuthUser) {
    return { user };
  }
}
