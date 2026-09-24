import { Router } from "express";
import { ReporteController } from "../controllers/reporte.controller";
import { verificarAuth } from "../middlewares/auth.middleware";
import { autorizarPermiso } from "../middlewares/permisos.middleware";

const router = Router();
const controller = new ReporteController();

router.use(verificarAuth);

router.get("/ventas/pdf", autorizarPermiso("ventas.ver"), controller.ventasPdf);
router.get("/ventas", autorizarPermiso("ventas.ver"), controller.ventas);
router.get("/pedidos/pdf", autorizarPermiso("pedidos.ver"), controller.pedidosPdf);
router.get("/pedidos", autorizarPermiso("pedidos.ver"), controller.pedidos);
router.get(
  "/cotizaciones/pdf",
  autorizarPermiso("cotizaciones.ver"),
  controller.cotizacionesPdf,
);
router.get(
  "/cotizaciones",
  autorizarPermiso("cotizaciones.ver"),
  controller.cotizaciones,
);
router.get("/abonos/pdf", autorizarPermiso("abonos.ver"), controller.abonosPdf);
router.get("/abonos", autorizarPermiso("abonos.ver"), controller.abonos);

export default router;
