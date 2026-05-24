import type { Response } from "express";
import { CotizacionService } from "../../applications/services/cotizacion.service";
import type { AuthRequest } from "../middlewares/auth.middleware";

const cotizacionService = new CotizacionService();

export class CotizacionController {
  async crearSolicitudCliente(req: AuthRequest, res: Response) {
    try {
      const cotizacion = await cotizacionService.crearSolicitudCliente(
        req.body,
        req.user,
      );

      return res.status(201).json({
        message: "Solicitud de cotizacion creada correctamente.",
        data: cotizacion,
      });
    } catch (error: any) {
      return res.status(400).json({
        message: error.message,
      });
    }
  }

  async editarSolicitudCliente(req: AuthRequest, res: Response) {
    try {
      const idCotizacion = Number(req.params.id);

      const cotizacion = await cotizacionService.editarSolicitudCliente(
        idCotizacion,
        req.body,
        req.user,
      );

      return res.status(200).json({
        message: "Solicitud de cotizacion actualizada correctamente.",
        data: cotizacion,
      });
    } catch (error: any) {
      return res.status(400).json({
        message: error.message,
      });
    }
  }

  async crearCotizacionNormal(req: AuthRequest, res: Response) {
    try {
      const cotizacion = await cotizacionService.crearCotizacionNormal(
        req.body,
        req.user,
      );

      return res.status(201).json({
        message: "Cotizacion presencial creada correctamente.",
        data: cotizacion,
      });
    } catch (error: any) {
      return res.status(400).json({
        message: error.message,
      });
    }
  }

  async crearCotizacionRapida(req: AuthRequest, res: Response) {
    try {
      const cotizacion = await cotizacionService.crearCotizacionRapida(
        req.body,
        req.user,
      );

      return res.status(201).json({
        message: "Cotizacion rapida creada, aprobada y con pedido simulado.",
        data: cotizacion,
      });
    } catch (error: any) {
      return res.status(400).json({
        message: error.message,
      });
    }
  }

  async listarCotizaciones(req: AuthRequest, res: Response) {
    try {
      const cotizaciones = await cotizacionService.listarCotizaciones(req.user);

      return res.status(200).json({
        data: cotizaciones,
      });
    } catch (error: any) {
      return res.status(404).json({
        message: error.message,
      });
    }
  }

  async buscarPorId(req: AuthRequest, res: Response) {
    try {
      const idCotizacion = Number(req.params.id);

      const cotizacion = await cotizacionService.buscarPorId(
        idCotizacion,
        req.user,
      );

      return res.status(200).json({
        data: cotizacion,
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

      const cotizaciones = await cotizacionService.buscarParcial(
        String(termino || ""),
        req.user,
      );

      return res.status(200).json({
        data: cotizaciones,
      });
    } catch (error: any) {
      return res.status(404).json({
        message: error.message,
      });
    }
  }

  async actualizarCotizacion(req: AuthRequest, res: Response) {
    try {
      const idCotizacion = Number(req.params.id);

      const cotizacion = await cotizacionService.actualizarCotizacion(
        idCotizacion,
        req.body,
      );

      return res.status(200).json({
        message: "Cotizacion actualizada correctamente.",
        data: cotizacion,
      });
    } catch (error: any) {
      return res.status(400).json({
        message: error.message,
      });
    }
  }

  async cotizarCotizacion(req: AuthRequest, res: Response) {
    try {
      const idCotizacion = Number(req.params.id);

      const cotizacion = await cotizacionService.cotizarCotizacion(
        idCotizacion,
        req.body,
      );

      return res.status(200).json({
        message: "Cotizacion enviada al cliente con precios asignados.",
        data: cotizacion,
      });
    } catch (error: any) {
      return res.status(400).json({
        message: error.message,
      });
    }
  }

  async anularCotizacion(req: AuthRequest, res: Response) {
    try {
      const idCotizacion = Number(req.params.id);

      const cotizacion = await cotizacionService.anularCotizacion(
        idCotizacion,
        req.user,
      );

      return res.status(200).json({
        message: "Cotizacion anulada correctamente.",
        data: cotizacion,
      });
    } catch (error: any) {
      return res.status(400).json({
        message: error.message,
      });
    }
  }

  async aprobarCotizacion(req: AuthRequest, res: Response) {
    try {
      const idCotizacion = Number(req.params.id);

      const cotizacion = await cotizacionService.aprobarCotizacion(
        idCotizacion,
        req.user,
      );

      return res.status(200).json({
        message: "Cotizacion aprobada correctamente.",
        data: cotizacion,
      });
    } catch (error: any) {
      return res.status(400).json({
        message: error.message,
      });
    }
  }

  async rechazarCotizacion(req: AuthRequest, res: Response) {
    try {
      const idCotizacion = Number(req.params.id);

      const cotizacion = await cotizacionService.rechazarCotizacion(
        idCotizacion,
        req.user,
      );

      return res.status(200).json({
        message: "Cotizacion rechazada correctamente.",
        data: cotizacion,
      });
    } catch (error: any) {
      return res.status(400).json({
        message: error.message,
      });
    }
  }
}
