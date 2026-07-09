import type { Response } from "express";
import { PermisoService } from "../../applications/services/permiso.service";
import type { AuthRequest } from "../middlewares/auth.middleware";

const permisoService = new PermisoService();

export class PermisoController {
  async sincronizarPermisos(_req: AuthRequest, res: Response) {
    try {
      const permisos = await permisoService.sincronizarPermisosSistema();

      return res.status(200).json({
        message: "Permisos sincronizados correctamente.",
        data: permisos,
      });
    } catch (error: any) {
      return res.status(400).json({
        message: error.message,
      });
    }
  }

  async listarPermisos(_req: AuthRequest, res: Response) {
    try {
      const permisos = await permisoService.listarPermisos();

      return res.status(200).json({
        data: permisos,
      });
    } catch (error: any) {
      return res.status(400).json({
        message: error.message,
      });
    }
  }

  async listarPermisosPorRol(req: AuthRequest, res: Response) {
    try {
      const idRol = Number(req.params.idRol);
      const permisos = await permisoService.listarPermisosPorRol(idRol);

      return res.status(200).json({
        data: permisos,
      });
    } catch (error: any) {
      return res.status(400).json({
        message: error.message,
      });
    }
  }

  async asignarPermisosARol(req: AuthRequest, res: Response) {
    try {
      const idRol = Number(req.params.idRol);
      const rol = await permisoService.asignarPermisosARol(
        idRol,
        req.body.permisos,
      );

      return res.status(200).json({
        message: "Permisos asignados correctamente.",
        data: rol,
      });
    } catch (error: any) {
      return res.status(400).json({
        message: error.message,
      });
    }
  }
}
