import type { Response } from "express";
import {
  ReporteService,
  ReporteValidationError,
  type UsuarioGeneradorReporte,
} from "../../applications/services/reporte.service";
import type { TipoReporte } from "../../applications/validators/reporte.validator";
import {
  crearPdfReporte,
  nombreArchivoReporte,
} from "../../utils/reports/report-pdf.util";
import type { AuthRequest } from "../middlewares/auth.middleware";

const reporteService = new ReporteService();

const usuarioGenerador = (req: AuthRequest): UsuarioGeneradorReporte => ({
  idUsuario: Number(req.user?.idUsuario),
  nombre: typeof req.user?.nombre === "string" ? req.user.nombre : undefined,
  correo: typeof req.user?.correo === "string" ? req.user.correo : undefined,
});

const responderError = (res: Response, error: unknown) => {
  if (error instanceof ReporteValidationError) {
    return res.status(400).json({ message: error.message });
  }
  return res.status(500).json({ message: "Error interno del servidor." });
};

export class ReporteController {
  private async responderJson(tipo: TipoReporte, req: AuthRequest, res: Response) {
    try {
      const reporte = await reporteService.construirReporte(
        tipo,
        req.query as Record<string, unknown>,
        usuarioGenerador(req),
      );
      return res.status(200).json({ data: reporte });
    } catch (error: unknown) {
      return responderError(res, error);
    }
  }

  private async responderPdf(tipo: TipoReporte, req: AuthRequest, res: Response) {
    try {
      const reporte = await reporteService.construirReporte(
        tipo,
        req.query as Record<string, unknown>,
        usuarioGenerador(req),
        true,
      );
      const pdf = await crearPdfReporte(reporte);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${nombreArchivoReporte(reporte)}"`,
      );
      return res.status(200).send(pdf);
    } catch (error: unknown) {
      return responderError(res, error);
    }
  }

  ventas = (req: AuthRequest, res: Response) => this.responderJson("VENTAS", req, res);
  ventasPdf = (req: AuthRequest, res: Response) => this.responderPdf("VENTAS", req, res);
  pedidos = (req: AuthRequest, res: Response) => this.responderJson("PEDIDOS", req, res);
  pedidosPdf = (req: AuthRequest, res: Response) => this.responderPdf("PEDIDOS", req, res);
  cotizaciones = (req: AuthRequest, res: Response) => this.responderJson("COTIZACIONES", req, res);
  cotizacionesPdf = (req: AuthRequest, res: Response) => this.responderPdf("COTIZACIONES", req, res);
  abonos = (req: AuthRequest, res: Response) => this.responderJson("ABONOS", req, res);
  abonosPdf = (req: AuthRequest, res: Response) => this.responderPdf("ABONOS", req, res);
}
