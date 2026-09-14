import type { Response } from "express";
import { CompraService } from "../../applications/services/compra.service";
import type { AuthRequest } from "../middlewares/auth.middleware";

const compraService = new CompraService();

const mensajeError = (error: unknown) =>
  error instanceof Error ? error.message : "Error inesperado.";

export class CompraController {
  async crearCompra(req: AuthRequest, res: Response) {
    try {
      const compra = await compraService.crearCompra(req.body, req.user);

      return res.status(201).json({
        message: "Compra creada correctamente.",
        data: compra,
      });
    } catch (error: unknown) {
      return res.status(400).json({
        message: mensajeError(error),
      });
    }
  }

  async listarCompras(req: AuthRequest, res: Response) {
    try {
      const compras = await compraService.listarCompras(
        req.query as Record<string, unknown>,
        req.user,
      );

      return res.status(200).json({
        data: compras,
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
      const compras = await compraService.listarPorPedido(idPedido, req.user);

      return res.status(200).json({
        data: compras,
      });
    } catch (error: unknown) {
      return res.status(404).json({
        message: mensajeError(error),
      });
    }
  }

  async buscarPorId(req: AuthRequest, res: Response) {
    try {
      const idCompra = Number(req.params.id);
      const compra = await compraService.buscarPorId(idCompra, req.user);

      return res.status(200).json({
        data: compra,
      });
    } catch (error: unknown) {
      return res.status(404).json({
        message: mensajeError(error),
      });
    }
  }

  async actualizarCompra(req: AuthRequest, res: Response) {
    try {
      const idCompra = Number(req.params.id);
      const compra = await compraService.actualizarCompra(
        idCompra,
        req.body,
        req.user,
      );

      return res.status(200).json({
        message: "Compra actualizada correctamente.",
        data: compra,
      });
    } catch (error: unknown) {
      return res.status(400).json({
        message: mensajeError(error),
      });
    }
  }

  async confirmarCompra(req: AuthRequest, res: Response) {
    try {
      const idCompra = Number(req.params.id);
      const compra = await compraService.confirmarCompra(idCompra, req.user);

      return res.status(200).json({
        message: "Compra confirmada correctamente.",
        data: compra,
      });
    } catch (error: unknown) {
      return res.status(400).json({
        message: mensajeError(error),
      });
    }
  }

  async anularCompra(req: AuthRequest, res: Response) {
    try {
      const idCompra = Number(req.params.id);
      const compra = await compraService.anularCompra(
        idCompra,
        req.body,
        req.user,
      );

      return res.status(200).json({
        message: "Compra anulada correctamente.",
        data: compra,
      });
    } catch (error: unknown) {
      return res.status(400).json({
        message: mensajeError(error),
      });
    }
  }

  async eliminarCompra(req: AuthRequest, res: Response) {
    try {
      const idCompra = Number(req.params.id);
      const compra = await compraService.eliminarCompra(idCompra, req.user);

      return res.status(200).json({
        message: "Compra eliminada correctamente.",
        data: compra,
      });
    } catch (error: unknown) {
      return res.status(400).json({
        message: mensajeError(error),
      });
    }
  }

  async obtenerResumen(req: AuthRequest, res: Response) {
    try {
      const resumen = await compraService.obtenerResumen(
        req.query as Record<string, unknown>,
        req.user,
      );

      return res.status(200).json({
        data: resumen,
      });
    } catch (error: unknown) {
      return res.status(400).json({
        message: mensajeError(error),
      });
    }
  }
}
