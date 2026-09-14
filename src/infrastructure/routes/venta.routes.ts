import { Router } from "express";
import { VentaController } from "../controllers/venta.controller";
import { verificarAuth } from "../middlewares/auth.middleware";
import { autorizarPermiso } from "../middlewares/permisos.middleware";

const router = Router();
const ventaController = new VentaController();

router.use(verificarAuth);

router.get(
  "/resumen",
  autorizarPermiso("ventas.resumen"),
  ventaController.obtenerResumen,
);

router.get(
  "/resumen-periodo",
  autorizarPermiso("ventas.resumen"),
  ventaController.obtenerResumenPeriodo,
);

router.get(
  "/buscar",
  autorizarPermiso("ventas.ver"),
  ventaController.buscarVentas,
);

router.get(
  "/",
  autorizarPermiso("ventas.ver"),
  ventaController.listarVentas,
);

export default router;
