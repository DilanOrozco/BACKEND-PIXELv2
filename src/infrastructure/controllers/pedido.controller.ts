import type { Response } from "express";
import { PedidoService } from "../../applications/services/pedido.service";
import type { AuthRequest } from "../middlewares/auth.middleware";

const pedidoService = new PedidoService();

export class PedidoController {
  async crearPedido(req: AuthRequest, res: Response) {
    try {
      const pedido = await pedidoService.crearPedido(req.body, req.user);

      return res.status(201).json({
        message: "Pedido creado correctamente desde la cotizacion aprobada.",
        data: pedido,
      });
    } catch (error: any) {
      return res.status(400).json({
        message: error.message,
      });
    }
  }

  async listarPedidos(req: AuthRequest, res: Response) {
    try {
      const pedidos = await pedidoService.listarPedidos(
        req.user,
        req.query as Record<string, unknown>,
      );

      return res.status(200).json(pedidos);
    } catch (error: any) {
      return res.status(404).json({
        message: error.message,
      });
    }
  }

  async buscarPorId(req: AuthRequest, res: Response) {
    try {
      const idPedido = Number(req.params.id);
      const pedido = await pedidoService.buscarPorId(idPedido, req.user);

      return res.status(200).json({
        data: pedido,
      });
    } catch (error: any) {
      return res.status(404).json({
        message: error.message,
      });
    }
  }

  async buscarParcial(req: AuthRequest, res: Response) {
    try {
      const { termino } = req.query;
      const pedidos = await pedidoService.buscarParcial(
        String(termino || ""),
        req.user,
      );

      return res.status(200).json({
        data: pedidos,
      });
    } catch (error: any) {
      return res.status(404).json({
        message: error.message,
      });
    }
  }

  async actualizarPedido(req: AuthRequest, res: Response) {
    try {
      const idPedido = Number(req.params.id);
      const pedido = await pedidoService.actualizarPedido(
        idPedido,
        req.body,
        req.user,
      );

      return res.status(200).json({
        message: "Pedido actualizado correctamente.",
        data: pedido,
      });
    } catch (error: any) {
      return res.status(400).json({
        message: error.message,
      });
    }
  }

  async marcarEnProceso(req: AuthRequest, res: Response) {
    try {
      const idPedido = Number(req.params.id);
      const pedido = await pedidoService.marcarEnProceso(
        idPedido,
        req.body,
        req.user,
      );

      return res.status(200).json({
        message: "Pedido cambiado a EN_PROCESO correctamente.",
        data: pedido,
      });
    } catch (error: any) {
      return res.status(400).json({
        message: error.message,
      });
    }
  }

  async finalizarPedido(req: AuthRequest, res: Response) {
    try {
      const idPedido = Number(req.params.id);
      const pedido = await pedidoService.finalizarPedido(
        idPedido,
        req.body,
        req.user,
      );

      return res.status(200).json({
        message: "Pedido finalizado correctamente.",
        data: pedido,
      });
    } catch (error: any) {
      return res.status(400).json({
        message: error.message,
      });
    }
  }

  async marcarPendienteSaldoFinal(req: AuthRequest, res: Response) {
    try {
      const idPedido = Number(req.params.id);
      const pedido = await pedidoService.marcarPendienteSaldoFinal(
        idPedido,
        req.body,
        req.user,
      );

      return res.status(200).json({
        message: "Pedido marcado como pendiente de saldo final correctamente.",
        data: pedido,
      });
    } catch (error: any) {
      return res.status(400).json({
        message: error.message,
      });
    }
  }

  async anularPedido(req: AuthRequest, res: Response) {
    try {
      const idPedido = Number(req.params.id);
      const pedido = await pedidoService.anularPedido(
        idPedido,
        req.body,
        req.user,
      );

      return res.status(200).json({
        message: "Pedido anulado correctamente.",
        data: pedido,
      });
    } catch (error: any) {
      return res.status(400).json({
        message: error.message,
      });
    }
  }
}
