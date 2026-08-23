import { Router } from "express";
import { CotizacionController } from "../controllers/cotizacion.controller";
import { verificarAuth } from "../middlewares/auth.middleware";
import { autorizarRoles } from "../middlewares/roles.middleware";
import {
  autorizarAlgunPermiso,
  autorizarPermiso,
} from "../middlewares/permisos.middleware";
import { crearControladorImpactoEliminacion } from "../controllers/deletion-impact.controller";

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

router.post(
  "/:id/responder",
  autorizarRoles("Cliente"),
  autorizarPermiso("cotizaciones.cliente.responder"),
  cotizacionController.responderPropuestaCliente,
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

router.post(
  "/:id/propuestas",
  autorizarPermiso("cotizaciones.propuesta.enviar"),
  cotizacionController.enviarPropuesta,
);

router.post(
  "/:id/respuesta-cliente",
  autorizarPermiso("cotizaciones.respuesta_cliente.registrar"),
  cotizacionController.registrarRespuestaCliente,
);

router.get(
  "/:id/versiones",
  autorizarPermiso("cotizaciones.versiones.ver"),
  cotizacionController.listarVersiones,
);

router.get(
  "/:id/impacto-eliminacion",
  autorizarPermiso("cotizaciones.ver"),
  crearControladorImpactoEliminacion("cotizacion"),
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
  autorizarAlgunPermiso("cotizaciones.ver", "cotizaciones.cliente.ver"),
  cotizacionController.listarCotizaciones,
);

router.get(
  "/buscar",
  autorizarAlgunPermiso("cotizaciones.ver", "cotizaciones.cliente.ver"),
  cotizacionController.buscarParcial,
);

router.get(
  "/:id",
  autorizarAlgunPermiso("cotizaciones.ver", "cotizaciones.cliente.ver"),
  cotizacionController.buscarPorId,
);

export default router;
