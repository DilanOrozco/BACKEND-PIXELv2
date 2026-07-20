import type { Response } from "express";
import {
  DashboardForbiddenError,
  DashboardNotFoundError,
  DashboardService,
  DashboardValidationError,
} from "../../applications/services/dashboard.service";
import type { AuthRequest } from "../middlewares/auth.middleware";

const dashboardService = new DashboardService();

const mensajeError = (error: unknown) =>
  error instanceof Error ? error.message : "Error inesperado.";

export class DashboardController {
  async obtenerDashboardAdmin(req: AuthRequest, res: Response) {
    try {
      const dashboard = await dashboardService.obtenerDashboardAdmin(
        req.query as Record<string, unknown>,
      );

      return res.status(200).json({
        data: dashboard,
      });
    } catch (error: unknown) {
      if (error instanceof DashboardValidationError) {
        return res.status(400).json({
          message: mensajeError(error),
        });
      }

      if (error instanceof DashboardForbiddenError) {
        return res.status(403).json({
          message: mensajeError(error),
        });
      }

      if (error instanceof DashboardNotFoundError) {
        return res.status(404).json({
          message: mensajeError(error),
        });
      }

      return res.status(500).json({
        message: "Error interno del servidor.",
      });
    }
  }

  async obtenerDashboardCliente(req: AuthRequest, res: Response) {
    try {
      const dashboard = await dashboardService.obtenerDashboardCliente(
        req.user,
        req.query as Record<string, unknown>,
      );

      return res.status(200).json({
        data: dashboard,
      });
    } catch (error: unknown) {
      if (error instanceof DashboardValidationError) {
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
