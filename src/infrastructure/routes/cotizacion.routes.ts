import { Router } from "express";
import { CotizacionController } from "../controllers/cotizacion.controller";
import { verificarAuth } from "../middlewares/auth.middleware";
import { autorizarRoles } from "../middlewares/roles.middleware";

const router = Router();
const cotizacionController = new CotizacionController();

router.use(verificarAuth);

router.post(
  "/",
  autorizarRoles("Admin", "Secretaria", "Cliente"),
  cotizacionController.crearCotizacionNormal
);

router.post(
  "/rapida",
  autorizarRoles("Admin", "Secretaria"),
  cotizacionController.crearCotizacionRapida
);

router.get(
  "/",
  autorizarRoles("Admin", "Secretaria", "Cliente"),
  cotizacionController.listarCotizaciones
);

router.get(
  "/buscar",
  autorizarRoles("Admin", "Secretaria", "Cliente"),
  cotizacionController.buscarParcial
);

router.get(
  "/:id",
  autorizarRoles("Admin", "Secretaria", "Cliente"),
  cotizacionController.buscarPorId
);

router.patch(
  "/:id",
  autorizarRoles("Admin", "Secretaria"),
  cotizacionController.actualizarCotizacion
);

router.patch(
  "/:id/aprobar",
  autorizarRoles("Admin", "Secretaria", "Cliente"),
  cotizacionController.aprobarCotizacion
);

router.patch(
  "/:id/rechazar",
  autorizarRoles("Admin", "Secretaria", "Cliente"),
  cotizacionController.rechazarCotizacion
);

export default router;