import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthenticatedOwner } from '../../auth/auth.types';

export const CurrentOwner = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedOwner => {
    const request = context
      .switchToHttp()
      .getRequest<{ user: AuthenticatedOwner }>();
    return request.user;
  },
);
