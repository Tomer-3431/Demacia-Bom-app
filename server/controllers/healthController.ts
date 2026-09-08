import { NextFunction, Request, Response } from "express";
import { isConnected } from "../db/connection";
import { allowedOrigins } from "../app";
import 'dotenv/config';

const CLIENT_SECRET_KEY = process.env.CLIENT_SECRET;

export function checkAuth(req: Request, res: Response, next: NextFunction) {
  const origin = req.headers.origin;

  if (origin && !allowedOrigins.includes(origin)) {
    return res.status(403).json({ messeage: 'Origin not allowed' });
  }

  const clientSecret = req.headers['x-client-secret'];

  if (clientSecret !== CLIENT_SECRET_KEY) {
    return res.status(401).json({ message: 'Invalid or missing client secrets' });
  }

  return next();
}

export function checkDBConnection(req: Request, res: Response) {
  const connected = isConnected();
  return res.status(connected ? 200 : 503).json({ connected });
}
