import type { Request, Response } from "express";
import { TecnicaService } from "../../applications/services/tecnica.service";

const tecnicaService = new TecnicaService();

export class TecnicaController {
  async crearTecnica(req: Request, res: Response) {
    try {
      const tecnica = await tecnicaService.crearTecnica(req.body);

      return res.status(201).json({
        message: "Técnica creada correctamente.",
        data: tecnica,
      });
    } catch (error: any) {
      return res.status(400).json({
        message: error.message,
      });
    }
  }

  async listarTecnicas(req: Request, res: Response) {
    try {
      const tecnicas = await tecnicaService.listarTecnicas();

      return res.status(200).json({
        data: tecnicas,
      });
    } catch (error: any) {
      return res.status(404).json({
        message: error.message,
      });
    }
  }

  async buscarPorId(req: Request, res: Response) {
    try {
      const idTecnica = Number(req.params.id);

      const tecnica = await tecnicaService.buscarPorId(idTecnica);

      return res.status(200).json({
        data: tecnica,
      });
    } catch (error: any) {
      return res.status(404).json({
        message: error.message,
      });
    }
  }

  async buscarParcial(req: Request, res: Response) {
    try {
      const { termino } = req.query;

      const tecnicas = await tecnicaService.buscarParcial(String(termino || ""));

      return res.status(200).json({
        data: tecnicas,
      });
    } catch (error: any) {
      return res.status(404).json({
        message: error.message,
      });
    }
  }

  async actualizarTecnica(req: Request, res: Response) {
    try {
      const idTecnica = Number(req.params.id);

      const tecnica = await tecnicaService.actualizarTecnica(
        idTecnica,
        req.body
      );

      return res.status(200).json({
        message: "Técnica actualizada correctamente.",
        data: tecnica,
      });
    } catch (error: any) {
      return res.status(400).json({
        message: error.message,
      });
    }
  }

  async desactivarTecnica(req: Request, res: Response) {
    try {
      const idTecnica = Number(req.params.id);

      const tecnica = await tecnicaService.desactivarTecnica(idTecnica);

      return res.status(200).json({
        message: "Técnica desactivada correctamente.",
        data: tecnica,
      });
    } catch (error: any) {
      return res.status(404).json({
        message: error.message,
      });
    }
  }
}