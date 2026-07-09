import type { Request, Response } from "express";
import { PublicCotizacionService } from "../../applications/services/public-cotizacion.service";

const publicCotizacionService = new PublicCotizacionService();

const mensajeError = (error: unknown) =>
  error instanceof Error ? error.message : "Error inesperado.";

export class PublicController {
  async listarProductos(req: Request, res: Response) {
    try {
      const productos = await publicCotizacionService.listarProductos(
        req.query as Record<string, unknown>,
      );

      return res.status(200).json({
        data: productos,
      });
    } catch (error: unknown) {
      return res.status(400).json({
        message: mensajeError(error),
      });
    }
  }

  async listarCategoriasProducto(_req: Request, res: Response) {
    try {
      const categorias =
        await publicCotizacionService.listarCategoriasProducto();

      return res.status(200).json({
        data: categorias,
      });
    } catch (error: unknown) {
      return res.status(400).json({
        message: mensajeError(error),
      });
    }
  }

  async listarTecnicas(_req: Request, res: Response) {
    try {
      const tecnicas = await publicCotizacionService.listarTecnicas();

      return res.status(200).json({
        data: tecnicas,
      });
    } catch (error: unknown) {
      return res.status(400).json({
        message: mensajeError(error),
      });
    }
  }

  async calcularCotizacion(req: Request, res: Response) {
    try {
      const calculo = await publicCotizacionService.calcular(req.body);

      return res.status(200).json({
        data: calculo,
      });
    } catch (error: unknown) {
      return res.status(400).json({
        message: mensajeError(error),
      });
    }
  }

  async crearCotizacion(req: Request, res: Response) {
    try {
      const cotizacion = await publicCotizacionService.crearCotizacion(req.body);

      return res.status(201).json({
        message: "Cotizacion creada correctamente.",
        data: cotizacion,
      });
    } catch (error: unknown) {
      return res.status(400).json({
        message: mensajeError(error),
      });
    }
  }
}
