import type { Request, Response } from "express";
import { TarifaTecnicaService } from "../../applications/services/tarifa-tecnica.service";

const service = new TarifaTecnicaService();
const mensaje = (error: unknown) =>
  error instanceof Error ? error.message : "Error inesperado.";

export class TarifaTecnicaController {
  async listar(req: Request, res: Response) {
    try {
      return res.status(200).json(
        await service.listar(req.query as Record<string, unknown>),
      );
    } catch (error) {
      return res.status(400).json({ message: mensaje(error) });
    }
  }

  async crear(req: Request, res: Response) {
    try {
      return res.status(201).json({
        message: "Tarifa creada correctamente.",
        data: await service.crear(req.body),
      });
    } catch (error) {
      return res.status(400).json({ message: mensaje(error) });
    }
  }

  async actualizar(req: Request, res: Response) {
    try {
      return res.status(200).json({
        message: "Tarifa actualizada correctamente.",
        data: await service.actualizar(Number(req.params.id), req.body),
      });
    } catch (error) {
      return res.status(400).json({ message: mensaje(error) });
    }
  }

  async eliminar(req: Request, res: Response) {
    try {
      return res.status(200).json({
        message: "Tarifa eliminada correctamente.",
        data: await service.eliminar(Number(req.params.id)),
      });
    } catch (error) {
      return res.status(400).json({ message: mensaje(error) });
    }
  }

  async listarDescuentos(req: Request, res: Response) {
    try {
      return res.status(200).json({
        data: await service.listarDescuentos(Number(req.params.idTecnica)),
        deprecated: true,
        message:
          "Configuracion legacy: estos descuentos no se aplican a solicitudes nuevas.",
      });
    } catch (error) {
      return res.status(400).json({ message: mensaje(error) });
    }
  }

  async reemplazarDescuentos(req: Request, res: Response) {
    try {
      return res.status(200).json({
        message:
          "Descuentos legacy de la tecnica actualizados. No se aplican a solicitudes nuevas.",
        deprecated: true,
        data: await service.reemplazarDescuentos(
          Number(req.params.idTecnica),
          req.body,
        ),
      });
    } catch (error) {
      return res.status(400).json({ message: mensaje(error) });
    }
  }
}
