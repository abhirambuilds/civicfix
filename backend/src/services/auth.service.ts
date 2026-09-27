import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { UserRole } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { config } from '../config/env.js';
import { AuthJwtPayload, SafeUserResponse } from '../types/auth.types.js';
import { RegisterInput, LoginInput } from '../validators/auth.validator.js';

const BCRYPT_ROUNDS = 10;

export interface ServiceResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  statusCode?: number;
}

export interface LoginResultData {
  token: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: UserRole;
  };
}

/**
 * Generates an HS256 signed JWT containing the user ID subject and role.
 */
export function generateToken(user: { id: string; role: UserRole }): string {
  const payload: AuthJwtPayload = {
    sub: user.id,
    role: user.role,
  };

  return jwt.sign(payload, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn as jwt.SignOptions['expiresIn'],
  });
}

/**
 * Verifies a JWT token and extracts the subject payload.
 * Throws JsonWebTokenError or TokenExpiredError on failure.
 */
export function verifyToken(token: string): AuthJwtPayload {
  const decoded = jwt.verify(token, config.jwtSecret) as jwt.JwtPayload;

  if (!decoded.sub || !decoded.role) {
    throw new jwt.JsonWebTokenError('Invalid token payload structure');
  }

  return {
    sub: decoded.sub as string,
    role: decoded.role as UserRole,
    iat: decoded.iat,
    exp: decoded.exp,
  };
}

/**
 * Registers a new user account.
 * Crucial Security: Always sets role to USER regardless of any external input.
 */
export async function registerUser(
  input: RegisterInput
): Promise<ServiceResult<SafeUserResponse>> {
  const normalizedEmail = input.email.trim().toLowerCase();

  // 1. Check for duplicate account
  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (existingUser) {
    return {
      success: false,
      error: 'An account with this email address already exists.',
      statusCode: 409,
    };
  }

  // 2. Hash password with bcrypt
  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);

  // 3. Create user strictly with USER role
  const newUser = await prisma.user.create({
    data: {
      name: input.name.trim(),
      email: normalizedEmail,
      passwordHash,
      role: UserRole.USER, // Forced public citizen role
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return {
    success: true,
    data: newUser,
    statusCode: 201,
  };
}

/**
 * Authenticates user credentials and returns a signed JWT.
 * Security: Uses generic error messages to avoid enumeration attacks.
 */
export async function loginUser(
  input: LoginInput
): Promise<ServiceResult<LoginResultData>> {
  const normalizedEmail = input.email.trim().toLowerCase();

  // 1. Find user by email
  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (!user) {
    return {
      success: false,
      error: 'Invalid email or password.',
      statusCode: 401,
    };
  }

  // 2. Verify account is active
  if (!user.isActive) {
    return {
      success: false,
      error: 'Your account has been deactivated. Please contact support.',
      statusCode: 401,
    };
  }

  // 3. Compare password hash
  const isMatch = await bcrypt.compare(input.password, user.passwordHash);

  if (!isMatch) {
    return {
      success: false,
      error: 'Invalid email or password.',
      statusCode: 401,
    };
  }

  // 4. Generate JWT
  const token = generateToken({ id: user.id, role: user.role });

  return {
    success: true,
    data: {
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    },
    statusCode: 200,
  };
}

/**
 * Retrieves the currently authenticated user's profile from the database.
 */
export async function getCurrentUser(
  userId: string
): Promise<ServiceResult<SafeUserResponse>> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user || !user.isActive) {
    return {
      success: false,
      error: 'User not found or account is deactivated.',
      statusCode: 401,
    };
  }

  return {
    success: true,
    data: user,
    statusCode: 200,
  };
}
