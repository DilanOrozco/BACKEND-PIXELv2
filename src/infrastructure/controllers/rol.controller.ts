import type { Request, Response } from "express";
import { RolService } from "../../applications/services/rol.service";

const rolService = new RolService();

export class RolController {
  async crearRol(req: Request, res: Response) {
    try {
      // Más adelante aquí se validará que solo el Admin pueda crear roles.
      const { nombre, descripcion } = req.body;

      const rol = await rolService.crearRol(nombre, descripcion);

      return res.status(201).json({
        message: "Rol creado correctamente.",
        data: rol,
      });
    } catch (error: any) {
      return res.status(400).json({
        message: error.message,
      });
    }
  }

  async listarRoles(req: Request, res: Response) {
    try {
      const roles = await rolService.listarRoles();

      return res.status(200).json({
        data: roles,
      });
    } catch (error: any) {
      return res.status(404).json({
        message: error.message,
      });
    }
  }

  async buscarPorNombre(req: Request, res: Response) {
    try {
      const { nombre } = req.query;

      const roles = await rolService.buscarPorNombre(String(nombre || ""));

      return res.status(200).json({
        data: roles,
      });
    } catch (error: any) {
      return res.status(404).json({
        message: error.message,
      });
    }
  }

  async actualizarRol(req: Request, res: Response) {
    try {
      const idRol = Number(req.params.id);
      const data = req.body;

      const rol = await rolService.actualizarRol(idRol, data);

      return res.status(200).json({
        message: "Rol actualizado correctamente.",
        data: rol,
      });
    } catch (error: any) {
      return res.status(400).json({
        message: error.message,
      });
    }
  }

  async desactivarRol(req: Request, res: Response) {
    try {
      const idRol = Number(req.params.id);

      const rol = await rolService.desactivarRol(idRol);

      return res.status(200).json({
        message: "Rol desactivado correctamente.",
        data: rol,
      });
    } catch (error: any) {
      return res.status(404).json({
        message: error.message,
      });
    }
  }

  async eliminarRol(req: Request, res: Response) {
    try {
      const idRol = Number(req.params.id);

      const rol = await rolService.eliminarRol(idRol);

      return res.status(200).json({
        message: "Rol eliminado correctamente.",
        data: rol,
      });
    } catch (error: any) {
      return res.status(400).json({
        message: error.message,
      });
    }
  }
}
