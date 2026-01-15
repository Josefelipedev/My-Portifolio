import bcrypt from 'bcryptjs';
import { SignJWT } from 'jose';
import prisma from './prisma';
import { sendVerificationCode, sendLoginAlert } from './email';

const CODE_EXPIRY_MINUTES = 10;
const SESSION_EXPIRY_HOURS = 24;

// Generate a 6-digit verification code
function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Generate a secure session token
function generateSessionToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 64; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

interface LoginStep1Result {
  success: boolean;
  error?: string;
  requiresVerification?: boolean;
  userId?: string;
  token?: string; // Token returned directly in dev mode (no verification needed)
}

interface LoginStep2Result {
  success: boolean;
  error?: string;
  token?: string;
}

interface RequestInfo {
  ipAddress: string;
  userAgent: string;
}

// Check if running in development mode (localhost)
function isDevMode(): boolean {
  return process.env.NODE_ENV === 'development';
}

// Step 1: Validate email and password, send verification code
// In development mode, skip verification and return token directly
export async function initiateLogin(
  email: string,
  password: string,
  requestInfo: RequestInfo
): Promise<LoginStep1Result> {
  try {
    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      // Record failed attempt
      await recordLoginAttempt(null, requestInfo, false, 'User not found');
      return { success: false, error: 'Email ou senha inválidos' };
    }

    if (!user.isActive) {
      await recordLoginAttempt(user.id, requestInfo, false, 'Account disabled');
      return { success: false, error: 'Conta desativada' };
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      await recordLoginAttempt(user.id, requestInfo, false, 'Invalid password');
      return { success: false, error: 'Email ou senha inválidos' };
    }

    // In development mode, skip email verification and create session directly
    if (isDevMode()) {
      // Invalidate ALL existing sessions for this user
      await prisma.session.updateMany({
        where: { userId: user.id, isValid: true },
        data: { isValid: false },
      });

      // Create new session
      const sessionToken = generateSessionToken();
      const expiresAt = new Date(Date.now() + SESSION_EXPIRY_HOURS * 60 * 60 * 1000);

      await prisma.session.create({
        data: {
          userId: user.id,
          token: sessionToken,
          ipAddress: requestInfo.ipAddress,
          userAgent: requestInfo.userAgent,
          expiresAt,
        },
      });

      // Create JWT for cookie
      const secret = new TextEncoder().encode(process.env.JWT_SECRET);
      const jwt = await new SignJWT({
        userId: user.id,
        sessionToken,
      })
        .setProtectedHeader({ alg: 'HS256' })
        .setExpirationTime(`${SESSION_EXPIRY_HOURS}h`)
        .setIssuedAt()
        .sign(secret);

      // Record successful login
      await recordLoginAttempt(user.id, requestInfo, true);

      return {
        success: true,
        requiresVerification: false,
        userId: user.id,
        token: jwt,
      };
    }

    // Production mode: require email verification
    // Invalidate any existing verification codes
    await prisma.verificationCode.updateMany({
      where: {
        userId: user.id,
        isUsed: false,
        type: 'login',
      },
      data: { isUsed: true },
    });

    // Generate new verification code
    const code = generateCode();
    const expiresAt = new Date(Date.now() + CODE_EXPIRY_MINUTES * 60 * 1000);

    await prisma.verificationCode.create({
      data: {
        userId: user.id,
        code,
        type: 'login',
        expiresAt,
      },
    });

    // Send code via email
    const emailSent = await sendVerificationCode(user.email, code, user.name);
    if (!emailSent) {
      return { success: false, error: 'Falha ao enviar código. Tente novamente.' };
    }

    return {
      success: true,
      requiresVerification: true,
      userId: user.id,
    };
  } catch (error) {
    console.error('Login initiation error:', error);
    return { success: false, error: 'Erro interno. Tente novamente.' };
  }
}

// Step 2: Verify code and create session
export async function verifyCodeAndCreateSession(
  userId: string,
  code: string,
  requestInfo: RequestInfo
): Promise<LoginStep2Result> {
  try {
    // Find valid verification code
    const verificationCode = await prisma.verificationCode.findFirst({
      where: {
        userId,
        code,
        type: 'login',
        isUsed: false,
        expiresAt: { gt: new Date() },
      },
      include: { user: true },
    });

    if (!verificationCode) {
      await recordLoginAttempt(userId, requestInfo, false, 'Invalid or expired code');
      return { success: false, error: 'Código inválido ou expirado' };
    }

    // Mark code as used
    await prisma.verificationCode.update({
      where: { id: verificationCode.id },
      data: { isUsed: true },
    });

    // Invalidate ALL existing sessions for this user (single session enforcement)
    await prisma.session.updateMany({
      where: { userId, isValid: true },
      data: { isValid: false },
    });

    // Create new session
    const sessionToken = generateSessionToken();
    const expiresAt = new Date(Date.now() + SESSION_EXPIRY_HOURS * 60 * 60 * 1000);

    await prisma.session.create({
      data: {
        userId,
        token: sessionToken,
        ipAddress: requestInfo.ipAddress,
        userAgent: requestInfo.userAgent,
        expiresAt,
      },
    });

    // Create JWT for cookie
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    const jwt = await new SignJWT({
      userId,
      sessionToken,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime(`${SESSION_EXPIRY_HOURS}h`)
      .setIssuedAt()
      .sign(secret);

    // Record successful login
    await recordLoginAttempt(userId, requestInfo, true);

    // Send login alert email
    await sendLoginAlert(
      verificationCode.user.email,
      verificationCode.user.name,
      requestInfo.ipAddress,
      requestInfo.userAgent,
      new Date()
    );

    return { success: true, token: jwt };
  } catch (error) {
    console.error('Verification error:', error);
    return { success: false, error: 'Erro interno. Tente novamente.' };
  }
}

// Validate session from JWT
export async function validateSession(jwt: string): Promise<{ valid: boolean; userId?: string }> {
  try {
    const { jwtVerify } = await import('jose');
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);

    const { payload } = await jwtVerify(jwt, secret);
    const { userId, sessionToken } = payload as { userId: string; sessionToken: string };

    // Check if session is still valid in database
    const session = await prisma.session.findFirst({
      where: {
        userId,
        token: sessionToken,
        isValid: true,
        expiresAt: { gt: new Date() },
      },
    });

    if (!session) {
      return { valid: false };
    }

    return { valid: true, userId };
  } catch {
    return { valid: false };
  }
}

// Logout - invalidate session
export async function logout(jwt: string): Promise<boolean> {
  try {
    const { jwtVerify } = await import('jose');
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);

    const { payload } = await jwtVerify(jwt, secret);
    const { sessionToken } = payload as { sessionToken: string };

    await prisma.session.updateMany({
      where: { token: sessionToken },
      data: { isValid: false },
    });

    return true;
  } catch {
    return false;
  }
}

// Record login attempt for history
async function recordLoginAttempt(
  userId: string | null,
  requestInfo: RequestInfo,
  success: boolean,
  failReason?: string
): Promise<void> {
  if (!userId) return;

  try {
    await prisma.loginHistory.create({
      data: {
        userId,
        ipAddress: requestInfo.ipAddress,
        userAgent: requestInfo.userAgent,
        success,
        failReason,
      },
    });
  } catch (error) {
    console.error('Failed to record login attempt:', error);
  }
}

// Get login history for a user
export async function getLoginHistory(userId: string, limit = 10) {
  return prisma.loginHistory.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

// Get active sessions for a user
export async function getActiveSessions(userId: string) {
  return prisma.session.findMany({
    where: {
      userId,
      isValid: true,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  });
}

// Invalidate all sessions (force logout everywhere)
export async function invalidateAllSessions(userId: string): Promise<void> {
  await prisma.session.updateMany({
    where: { userId, isValid: true },
    data: { isValid: false },
  });
}

// Hash password for user creation
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}
