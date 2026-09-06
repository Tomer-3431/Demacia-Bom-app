import { Request, Response } from "express";
import { isConnected } from "../db/connection";

export function checkAuth(req: Request, res: Response) {
  // TODO: add authorization
  const authorized = true;

  if (!authorized)
    return res.status(401).json({ authorized: false, message: "Unauthorized" });
  return res.status(200).json({ authorized: true, message: "OK" });
}

export function checkDBConnection(req: Request, res: Response) {
    const connected = isConnected();
    return res.status(connected ? 200 : 503).json({ connected });
}
