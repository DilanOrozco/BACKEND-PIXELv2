import type { Request, Response, NextFunction } from "express";
import { verificarToken } from "../../utils/jwt.util";

export interface AuthRequest extends Request {
  user?: any;
}

export const verificarAuth = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        message: "Token no proporcionado.",
      });
    }

    const token = authHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        message: "Token inválido.",
      });
    }

    const decoded = verificarToken(token);

    req.user = decoded;

    next();
  } catch {
    return res.status(401).json({
      message: "Token inválido o expirado.",
    });
  }
};