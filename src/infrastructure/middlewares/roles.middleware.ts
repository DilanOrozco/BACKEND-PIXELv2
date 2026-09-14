import type { Response, NextFunction } from "express";
import type { AuthRequest } from "./auth.middleware";

export const autorizarRoles = (...rolesPermitidos: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        message: "Usuario no autenticado.",
      });
    }

    if (req.user.rol === "Admin") {
      return next();
    }

    if (!rolesPermitidos.includes(req.user.rol)) {
      return res.status(403).json({
        message: "No tienes permisos para realizar esta accion.",
      });
    }

    next();
  };
};
