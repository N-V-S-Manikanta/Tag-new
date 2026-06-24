import asyncHandler from 'express-async-handler';
import { verifyToken } from '../utils/token.js';
import User from '../models/User.js';

// Verifies JWT (Bearer header) and attaches req.user.
export const protect = asyncHandler(async (req, res, next) => {
  let token;
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    token = header.split(' ')[1];
  }
  if (!token) {
    res.status(401);
    throw new Error('Not authorized, no token');
  }
  try {
    const decoded = verifyToken(token);
    const user = await User.findById(decoded.id).populate('organization', 'name slug logo color isActive');
    if (!user || !user.isActive) {
      res.status(401);
      throw new Error('Not authorized, user not found');
    }
    req.user = user;
    next();
  } catch (err) {
    res.status(401);
    throw new Error('Not authorized, token failed');
  }
});

// Restricts a route to one or more roles. Usage: authorize('CEO')
export const authorize = (...roles) =>
  asyncHandler(async (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      res.status(403);
      throw new Error(`Role '${req.user.role}' is not allowed to access this resource`);
    }
    next();
  });
