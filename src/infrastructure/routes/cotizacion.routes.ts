import { Router } from "express";
import { CotizacionController } from "../controllers/cotizacion.controller";
import { verificarAuth } from "../middlewares/auth.middleware";
import { autorizarRoles } from "../middlewares/roles.middleware";

const router = Router();
const cotizacionController = new CotizacionController();

router.use(verificarAuth);

// Cliente: solicita, edita, anula o aprueba solo sus cotizaciones.
router.post(
  "/cliente",
  autorizarRoles("Cliente"),
  cotizacionController.crearSolicitudCliente,
);

router.patch(
  "/:id/cliente",
  autorizarRoles("Cliente"),
  cotizacionController.editarSolicitudCliente,
);

router.patch(
  "/:id/anular",
  autorizarRoles("Admin", "Secretaria", "Cliente"),
  cotizacionController.anularCotizacion,
);

router.patch(
  "/:id/aprobar",
  autorizarRoles("Admin", "Secretaria", "Cliente"),
  cotizacionController.aprobarCotizacion,
);

// Empleado: Admin y Secretaria gestionan cotizaciones presenciales y precios.
router.post(
  "/",
  autorizarRoles("Admin", "Secretaria"),
  cotizacionController.crearCotizacionNormal,
);

router.patch(
  "/:id/cotizar",
  autorizarRoles("Admin", "Secretaria"),
  cotizacionController.cotizarCotizacion,
);

router.patch(
  "/:id",
  autorizarRoles("Admin", "Secretaria"),
  cotizacionController.actualizarCotizacion,
);

router.delete(
  "/:id/eliminar",
  autorizarRoles("Admin", "Secretaria"),
  cotizacionController.eliminarCotizacion,
);

router.delete(
  "/:id",
  autorizarRoles("Admin", "Secretaria"),
  cotizacionController.eliminarCotizacion,
);

// Consulta compartida: el service restringe al cliente a sus propios registros.
router.get(
  "/",
  autorizarRoles("Admin", "Secretaria", "Cliente"),
  cotizacionController.listarCotizaciones,
);

router.get(
  "/buscar",
  autorizarRoles("Admin", "Secretaria", "Cliente"),
  cotizacionController.buscarParcial,
);

router.get(
  "/:id",
  autorizarRoles("Admin", "Secretaria", "Cliente"),
  cotizacionController.buscarPorId,
);

export default router;
