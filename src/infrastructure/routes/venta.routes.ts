import { Router } from "express";
import { VentaController } from "../controllers/venta.controller";
import { verificarAuth } from "../middlewares/auth.middleware";
import { autorizarRoles } from "../middlewares/roles.middleware";

const router = Router();
const ventaController = new VentaController();

router.use(verificarAuth);

router.get(
  "/resumen",
  autorizarRoles("Admin", "Secretaria"),
  ventaController.obtenerResumen,
);

router.get(
  "/resumen-periodo",
  autorizarRoles("Admin", "Secretaria"),
  ventaController.obtenerResumenPeriodo,
);

router.get(
  "/buscar",
  autorizarRoles("Admin", "Secretaria"),
  ventaController.buscarVentas,
);

router.get(
  "/",
  autorizarRoles("Admin", "Secretaria"),
  ventaController.listarVentas,
);

export default router;
