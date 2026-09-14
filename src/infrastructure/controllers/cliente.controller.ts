import type { Request, Response } from "express";
import { ClienteService } from "../../applications/services/cliente.service";

const clienteService = new ClienteService();

const mensajeError = (error: unknown) =>
  error instanceof Error ? error.message : "Error inesperado.";

export class ClienteController {
  async listarClientes(req: Request, res: Response) {
    try {
      const clientes = await clienteService.listarClientes(
        req.query as Record<string, unknown>,
      );

      return res.status(200).json(clientes);
    } catch (error: unknown) {
      return res.status(400).json({
        message: mensajeError(error),
      });
    }
  }

  async buscarPorId(req: Request, res: Response) {
    try {
      const cliente = await clienteService.buscarPorId(Number(req.params.id));

      return res.status(200).json({
        data: cliente,
      });
    } catch (error: unknown) {
      return res.status(404).json({
        message: mensajeError(error),
      });
    }
  }

  async listarPedidos(req: Request, res: Response) {
    try {
      const pedidos = await clienteService.listarPedidos(
        Number(req.params.id),
        req.query as Record<string, unknown>,
      );
      return res.status(200).json(pedidos);
    } catch (error: unknown) {
      return res.status(404).json({ message: mensajeError(error) });
    }
  }

  async desactivarCliente(req: Request, res: Response) {
    try {
      const cliente = await clienteService.desactivarCliente(
        Number(req.params.id),
      );

      return res.status(200).json({
        message: "Cliente desactivado correctamente.",
        data: cliente,
      });
    } catch (error: unknown) {
      return res.status(400).json({
        message: mensajeError(error),
      });
    }
  }

  async eliminarCliente(req: Request, res: Response) {
    try {
      const cliente = await clienteService.eliminarCliente(Number(req.params.id));

      return res.status(200).json({
        message: "Cliente eliminado correctamente.",
        data: cliente,
      });
    } catch (error: unknown) {
      return res.status(400).json({
        message: mensajeError(error),
      });
    }
  }
}
