import { Request, Response, NextFunction } from 'express';
import { adminAuth } from '../lib/firebase-admin.ts';

export interface AuthenticatedUser {
  uid: string;
  email: string;
  name?: string;
}

export interface AuthRequest extends Request {
  user?: AuthenticatedUser;
}

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing token' });
  }

  const token = authHeader.split('Bearer ')[1];

  // Support local session tokens for email/password and isolated demo sessions
  if (token.startsWith('local:')) {
    const parts = token.split(':');
    const uid = parts[1] || 'demo-smartspend-user';
    const email = parts[2] || 'demo@smartspend.app';
    const name = parts.slice(3).join(':') || 'Alex Morgan';
    req.user = { uid, email, name };
    return next();
  }

  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email || `${decodedToken.uid}@smartspend.app`,
      name: decodedToken.name || 'SmartSpend User',
    };
    return next();
  } catch (error) {
    console.error('Error verifying Firebase ID token:', error);
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};
