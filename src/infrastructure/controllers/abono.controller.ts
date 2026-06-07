import type { Response } from "express";
import { AbonoService } from "../../applications/services/abono.service";
import type { AuthRequest } from "../middlewares/auth.middleware";

const abonoService = new AbonoService();

const mensajeError = (error: unknown) =>
  error instanceof Error ? error.message : "Error inesperado.";

export class AbonoController {
  async crearAbono(req: AuthRequest, res: Response) {
    try {
      const abono = await abonoService.crearAbono(req.body, req.user);
      const estado = (abono as { estado?: string } | null)?.estado;

      return res.status(201).json({
        message: estado === "CONFIRMADO"
          ? "Abono confirmado correctamente."
          : "Abono registrado correctamente y pendiente de confirmación.",
        data: abono,
      });
    } catch (error: unknown) {
      return res.status(400).json({
        message: mensajeError(error),
      });
    }
  }

  async confirmarAbono(req: AuthRequest, res: Response) {
    try {
      const idAbono = Number(req.params.id);
      const abono = await abonoService.confirmarAbono(
        idAbono,
        req.user,
        req.body,
      );

      return res.status(200).json({
        message: "Abono confirmado correctamente.",
        data: abono,
      });
    } catch (error: unknown) {
      return res.status(400).json({
        message: mensajeError(error),
      });
    }
  }

  async rechazarAbono(req: AuthRequest, res: Response) {
    try {
      const idAbono = Number(req.params.id);
      const abono = await abonoService.rechazarAbono(
        idAbono,
        req.user,
        req.body,
      );

      return res.status(200).json({
        message: "Abono rechazado correctamente.",
        data: abono,
      });
    } catch (error: unknown) {
      return res.status(400).json({
        message: mensajeError(error),
      });
    }
  }

  async listarAbonos(req: AuthRequest, res: Response) {
    try {
      const abonos = await abonoService.listarAbonos(
        req.query as Record<string, unknown>,
      );

      return res.status(200).json({
        data: abonos,
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
      const abonos = await abonoService.listarPorPedido(idPedido, req.user);

      return res.status(200).json({
        data: abonos,
      });
    } catch (error: unknown) {
      return res.status(404).json({
        message: mensajeError(error),
      });
    }
  }

  async buscarPorId(req: AuthRequest, res: Response) {
    try {
      const idAbono = Number(req.params.id);
      const abono = await abonoService.buscarPorId(idAbono, req.user);

      return res.status(200).json({
        data: abono,
      });
    } catch (error: unknown) {
      return res.status(404).json({
        message: mensajeError(error),
      });
    }
  }

  async actualizarAbono(req: AuthRequest, res: Response) {
    try {
      const idAbono = Number(req.params.id);
      const abono = await abonoService.actualizarAbonoPendiente(
        idAbono,
        req.body,
      );

      return res.status(200).json({
        message: "Abono actualizado correctamente.",
        data: abono,
      });
    } catch (error: unknown) {
      return res.status(400).json({
        message: mensajeError(error),
      });
    }
  }

  async eliminarAbono(req: AuthRequest, res: Response) {
    try {
      const idAbono = Number(req.params.id);
      const abono = await abonoService.eliminarAbonoPendiente(idAbono);

      return res.status(200).json({
        message: "Abono eliminado correctamente.",
        data: abono,
      });
    } catch (error: unknown) {
      return res.status(400).json({
        message: mensajeError(error),
      });
    }
  }
}
