import jwt from 'jsonwebtoken';

export interface TokenPayload {
  userId: string;
  role: string;
  email: string | null;
}

export function generateToken(payload: TokenPayload): string {
  return jwt.sign(payload, process.env.JWT_SECRET || 'secret', {
    expiresIn: '7d',
  });
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, process.env.JWT_SECRET || 'secret') as TokenPayload;
  } catch (error) {
    return null;
  }
}

export function generateRefreshToken(userId: string): string {
  return jwt.sign({ userId }, process.env.JWT_SECRET || 'secret', {
    expiresIn: '30d',
  });
}
