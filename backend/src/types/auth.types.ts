import { UserRole } from '@prisma/client';

export interface AuthenticatedUser {
  id: string;
  role: UserRole;
}

export interface AuthJwtPayload {
  sub: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

export interface SafeUserResponse {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}
