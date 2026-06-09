import type { Request, Response } from "express";
import { ProveedorService } from "../../applications/services/proveedor.service";

const proveedorService = new ProveedorService();

const mensajeError = (error: unknown) =>
  error instanceof Error ? error.message : "Error inesperado.";

export class ProveedorController {
  async crearProveedor(req: Request, res: Response) {
    try {
      const proveedor = await proveedorService.crearProveedor(req.body);

      return res.status(201).json({
        message: "Proveedor creado correctamente.",
        data: proveedor,
      });
    } catch (error: unknown) {
      return res.status(400).json({
        message: mensajeError(error),
      });
    }
  }

  async listarProveedores(req: Request, res: Response) {
    try {
      const proveedores = await proveedorService.listarProveedores(
        req.query as Record<string, unknown>,
      );

      return res.status(200).json({
        data: proveedores,
      });
    } catch (error: unknown) {
      return res.status(404).json({
        message: mensajeError(error),
      });
    }
  }

  async buscarPorId(req: Request, res: Response) {
    try {
      const idProveedor = Number(req.params.id);
      const proveedor = await proveedorService.buscarPorId(idProveedor);

      return res.status(200).json({
        data: proveedor,
      });
    } catch (error: unknown) {
      return res.status(404).json({
        message: mensajeError(error),
      });
    }
  }

  async buscarParcial(req: Request, res: Response) {
    try {
      const { termino } = req.query;
      const proveedores = await proveedorService.buscarParcial(
        String(termino || ""),
      );

      return res.status(200).json({
        data: proveedores,
      });
    } catch (error: unknown) {
      return res.status(404).json({
        message: mensajeError(error),
      });
    }
  }

  async actualizarProveedor(req: Request, res: Response) {
    try {
      const idProveedor = Number(req.params.id);
      const proveedor = await proveedorService.actualizarProveedor(
        idProveedor,
        req.body,
      );

      return res.status(200).json({
        message: "Proveedor actualizado correctamente.",
        data: proveedor,
      });
    } catch (error: unknown) {
      return res.status(400).json({
        message: mensajeError(error),
      });
    }
  }

  async desactivarProveedor(req: Request, res: Response) {
    try {
      const idProveedor = Number(req.params.id);
      const proveedor = await proveedorService.desactivarProveedor(idProveedor);

      return res.status(200).json({
        message: "Proveedor desactivado correctamente.",
        data: proveedor,
      });
    } catch (error: unknown) {
      return res.status(400).json({
        message: mensajeError(error),
      });
    }
  }

  async eliminarProveedor(req: Request, res: Response) {
    try {
      const idProveedor = Number(req.params.id);
      const proveedor = await proveedorService.eliminarProveedor(idProveedor);

      return res.status(200).json({
        message: "Proveedor eliminado correctamente.",
        data: proveedor,
      });
    } catch (error: unknown) {
      return res.status(400).json({
        message: mensajeError(error),
      });
    }
  }
}
