import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedUser } from '~/enums/index';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser | null => {
    const request = ctx.switchToHttp().getRequest();
    return request.user ?? null;
  },
);
