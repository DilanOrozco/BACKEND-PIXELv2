import { Router } from "express";
import { CotizacionController } from "../controllers/cotizacion.controller";
import { verificarAuth } from "../middlewares/auth.middleware";
import { autorizarRoles } from "../middlewares/roles.middleware";
import { autorizarPermiso } from "../middlewares/permisos.middleware";

const router = Router();
const cotizacionController = new CotizacionController();

router.use(verificarAuth);

// Cliente: solicita, edita, anula o aprueba solo sus cotizaciones.
router.post(
  "/cliente",
  autorizarRoles("Cliente"),
  autorizarPermiso("cotizaciones.crear_cliente"),
  cotizacionController.crearSolicitudCliente,
);

router.patch(
  "/:id/cliente",
  autorizarRoles("Cliente"),
  autorizarPermiso("cotizaciones.editar_cliente"),
  cotizacionController.editarSolicitudCliente,
);

router.patch(
  "/:id/anular",
  autorizarPermiso("cotizaciones.anular"),
  cotizacionController.anularCotizacion,
);

router.patch(
  "/:id/aprobar",
  autorizarPermiso("cotizaciones.aprobar"),
  cotizacionController.aprobarCotizacion,
);

// Empleado: Admin y Secretaria gestionan cotizaciones presenciales y precios.
router.post(
  "/",
  autorizarPermiso("cotizaciones.crear_presencial"),
  cotizacionController.crearCotizacionNormal,
);

router.patch(
  "/:id/cotizar",
  autorizarPermiso("cotizaciones.cotizar"),
  cotizacionController.cotizarCotizacion,
);

router.patch(
  "/:id",
  autorizarPermiso("cotizaciones.editar"),
  cotizacionController.actualizarCotizacion,
);

router.delete(
  "/:id/eliminar",
  autorizarPermiso("cotizaciones.eliminar"),
  cotizacionController.eliminarCotizacion,
);

router.delete(
  "/:id",
  autorizarPermiso("cotizaciones.eliminar"),
  cotizacionController.eliminarCotizacion,
);

// Consulta compartida: el service restringe al cliente a sus propios registros.
router.get(
  "/",
  autorizarPermiso("cotizaciones.ver"),
  cotizacionController.listarCotizaciones,
);

router.get(
  "/buscar",
  autorizarPermiso("cotizaciones.ver"),
  cotizacionController.buscarParcial,
);

router.get(
  "/:id",
  autorizarPermiso("cotizaciones.ver"),
  cotizacionController.buscarPorId,
);

export default router;
