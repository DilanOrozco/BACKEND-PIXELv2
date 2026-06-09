import type { Response } from "express";
import {
  VentaService,
  VentaValidationError,
} from "../../applications/services/venta.service";
import type { AuthRequest } from "../middlewares/auth.middleware";

const ventaService = new VentaService();

const mensajeError = (error: unknown) =>
  error instanceof Error ? error.message : "Error inesperado.";

export class VentaController {
  async listarVentas(req: AuthRequest, res: Response) {
    try {
      const ventas = await ventaService.listarVentas(
        req.query as Record<string, unknown>,
      );

      return res.status(200).json({
        data: ventas,
      });
    } catch (error: unknown) {
      if (error instanceof VentaValidationError) {
        return res.status(400).json({
          message: mensajeError(error),
        });
      }

      return res.status(404).json({
        message: mensajeError(error),
      });
    }
  }

  async buscarVentas(req: AuthRequest, res: Response) {
    try {
      const ventas = await ventaService.buscarVentas(
        req.query as Record<string, unknown>,
      );

      return res.status(200).json({
        data: ventas,
      });
    } catch (error: unknown) {
      if (error instanceof VentaValidationError) {
        return res.status(400).json({
          message: mensajeError(error),
        });
      }

      return res.status(404).json({
        message: mensajeError(error),
      });
    }
  }

  async obtenerResumen(req: AuthRequest, res: Response) {
    try {
      const resumen = await ventaService.obtenerResumen(
        req.query as Record<string, unknown>,
      );

      return res.status(200).json({
        data: resumen,
      });
    } catch (error: unknown) {
      if (error instanceof VentaValidationError) {
        return res.status(400).json({
          message: mensajeError(error),
        });
      }

      return res.status(500).json({
        message: "Error interno del servidor.",
      });
    }
  }

  async obtenerResumenPeriodo(req: AuthRequest, res: Response) {
    try {
      const resumen = await ventaService.obtenerResumenPeriodo(
        req.query as Record<string, unknown>,
      );

      return res.status(200).json({
        data: resumen,
      });
    } catch (error: unknown) {
      if (error instanceof VentaValidationError) {
        return res.status(400).json({
          message: mensajeError(error),
        });
      }

      return res.status(500).json({
        message: "Error interno del servidor.",
      });
    }
  }
}
