import type { Response } from "express";
import { DisenoService } from "../../applications/services/diseno.service";
import type { AuthRequest } from "../middlewares/auth.middleware";

const disenoService = new DisenoService();

const mensajeError = (error: unknown) =>
  error instanceof Error ? error.message : "Error inesperado.";

export class DisenoController {
  async crearDiseno(req: AuthRequest, res: Response) {
    try {
      const diseno = await disenoService.crearDiseno(req.body, req.user);

      return res.status(201).json({
        message: "Diseño creado correctamente.",
        data: diseno,
      });
    } catch (error: unknown) {
      return res.status(400).json({
        message: mensajeError(error),
      });
    }
  }

  async listarDisenos(req: AuthRequest, res: Response) {
    try {
      const disenos = await disenoService.listarDisenos(
        req.query as Record<string, unknown>,
        req.user,
      );

      return res.status(200).json({
        data: disenos,
      });
    } catch (error: unknown) {
      return res.status(404).json({
        message: mensajeError(error),
      });
    }
  }

  async listarPorPedido(req: AuthRequest, res: Response) {
    try {
      const idPedido = Number(req.params.idPedido);
      const disenos = await disenoService.listarPorPedido(idPedido, req.user);

      return res.status(200).json({
        data: disenos,
      });
    } catch (error: unknown) {
      return res.status(404).json({
        message: mensajeError(error),
      });
    }
  }

  async buscarPorId(req: AuthRequest, res: Response) {
    try {
      const idDiseno = Number(req.params.id);
      const diseno = await disenoService.buscarPorId(idDiseno, req.user);

      return res.status(200).json({
        data: diseno,
      });
    } catch (error: unknown) {
      return res.status(404).json({
        message: mensajeError(error),
      });
    }
  }

  async actualizarDiseno(req: AuthRequest, res: Response) {
    try {
      const idDiseno = Number(req.params.id);
      const diseno = await disenoService.actualizarDiseno(
        idDiseno,
        req.body,
        req.user,
      );

      return res.status(200).json({
        message: "Diseño actualizado correctamente.",
        data: diseno,
      });
    } catch (error: unknown) {
      return res.status(400).json({
        message: mensajeError(error),
      });
    }
  }

  async aprobarDiseno(req: AuthRequest, res: Response) {
    try {
      const idDiseno = Number(req.params.id);
      const resultado = await disenoService.aprobarDiseno(
        idDiseno,
        req.user,
        req.body,
      );

      return res.status(200).json({
        message: resultado.pasoAProduccion
          ? "Diseño aprobado correctamente. El pedido pasó a producción."
          : "Diseño aprobado correctamente, pero el pedido aún no puede pasar a producción porque falta el abono mínimo del 50%.",
        data: {
          diseno: resultado.diseno,
          pedido: resultado.pedido,
        },
      });
    } catch (error: unknown) {
      return res.status(400).json({
        message: mensajeError(error),
      });
    }
  }

  async eliminarDiseno(req: AuthRequest, res: Response) {
    try {
      const idDiseno = Number(req.params.id);
      const diseno = await disenoService.eliminarDiseno(idDiseno, req.user);

      return res.status(200).json({
        message: "Diseño eliminado correctamente.",
        data: diseno,
      });
    } catch (error: unknown) {
      return res.status(400).json({
        message: mensajeError(error),
      });
    }
  }

  async listarProduccionPendiente(req: AuthRequest, res: Response) {
    try {
      const produccion = await disenoService.listarProduccionPendiente(
        req.user,
      );

      return res.status(200).json({
        data: produccion,
      });
    } catch (error: unknown) {
      return res.status(404).json({
        message: mensajeError(error),
      });
    }
  }
}
