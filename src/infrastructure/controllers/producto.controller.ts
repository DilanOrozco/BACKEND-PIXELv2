import type { Request, Response } from "express";
import { ProductoService } from "../../applications/services/producto.service";

const productoService = new ProductoService();

const mensajeError = (error: unknown) =>
  error instanceof Error ? error.message : "Error inesperado.";

export class ProductoController {
  async listarProductos(req: Request, res: Response) {
    try {
      const productos = await productoService.listarProductos(
        req.query as Record<string, unknown>,
      );

      return res.status(200).json(productos);
    } catch (error: unknown) {
      return res.status(400).json({
        message: mensajeError(error),
      });
    }
  }

  async buscarPorId(req: Request, res: Response) {
    try {
      const producto = await productoService.buscarPorId(Number(req.params.id));

      return res.status(200).json({
        data: producto,
      });
    } catch (error: unknown) {
      return res.status(404).json({
        message: mensajeError(error),
      });
    }
  }

  async crearProducto(req: Request, res: Response) {
    try {
      const producto = await productoService.crearProducto(req.body);

      return res.status(201).json({
        message: "Producto creado correctamente.",
        data: producto,
      });
    } catch (error: unknown) {
      return res.status(400).json({
        message: mensajeError(error),
      });
    }
  }

  async actualizarProducto(req: Request, res: Response) {
    try {
      const producto = await productoService.actualizarProducto(
        Number(req.params.id),
        req.body,
      );

      return res.status(200).json({
        message: "Producto actualizado correctamente.",
        data: producto,
      });
    } catch (error: unknown) {
      return res.status(400).json({
        message: mensajeError(error),
      });
    }
  }

  async desactivarProducto(req: Request, res: Response) {
    try {
      const producto = await productoService.desactivarProducto(
        Number(req.params.id),
      );

      return res.status(200).json({
        message: "Producto desactivado correctamente.",
        data: producto,
      });
    } catch (error: unknown) {
      return res.status(400).json({
        message: mensajeError(error),
      });
    }
  }

  async eliminarProducto(req: Request, res: Response) {
    try {
      const producto = await productoService.eliminarProducto(
        Number(req.params.id),
      );

      return res.status(200).json({
        message: "Producto eliminado correctamente.",
        data: producto,
      });
    } catch (error: unknown) {
      return res.status(400).json({
        message: mensajeError(error),
      });
    }
  }

  async listarRangos(req: Request, res: Response) {
    try {
      const rangos = await productoService.listarRangos(Number(req.params.id));

      return res.status(200).json({
        data: rangos,
      });
    } catch (error: unknown) {
      return res.status(400).json({
        message: mensajeError(error),
      });
    }
  }

  async reemplazarRangos(req: Request, res: Response) {
    try {
      const producto = await productoService.reemplazarRangos(
        Number(req.params.id),
        req.body,
      );

      return res.status(200).json({
        message: "Rangos actualizados correctamente.",
        data: producto,
      });
    } catch (error: unknown) {
      return res.status(400).json({
        message: mensajeError(error),
      });
    }
  }
}
