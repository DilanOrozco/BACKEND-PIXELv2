import type { Response, NextFunction } from "express";
import type { AuthRequest } from "./auth.middleware";
import { PermisoService } from "../../applications/services/permiso.service";
import type { CodigoPermiso } from "../../utils/permisos";

const permisoService = new PermisoService();

export const autorizarPermiso = (codigoPermiso: CodigoPermiso) => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          message: "Usuario no autenticado.",
        });
      }

      if (req.user.rol === "Admin") {
        return next();
      }

      const tienePermiso = await permisoService.rolTienePermiso(
        Number(req.user.idRol),
        codigoPermiso,
      );

      if (!tienePermiso) {
        return res.status(403).json({
          message: "No tienes permisos para realizar esta accion.",
        });
      }

      next();
    } catch {
      return res.status(403).json({
        message: "No se pudo validar el permiso del usuario.",
      });
    }
  };
};
