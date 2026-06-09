import { Router } from "express";
import { PedidoController } from "../controllers/pedido.controller";
import { AbonoController } from "../controllers/abono.controller";
import { DisenoController } from "../controllers/diseno.controller";
import { CompraController } from "../controllers/compra.controller";
import { verificarAuth } from "../middlewares/auth.middleware";
import { autorizarRoles } from "../middlewares/roles.middleware";

const router = Router();
const pedidoController = new PedidoController();
const abonoController = new AbonoController();
const disenoController = new DisenoController();
const compraController = new CompraController();
const ROL_DISENADOR = "Dise\u00f1ador";

router.use(verificarAuth);

// Admin/Secretaria: crean pedidos desde cotizaciones aprobadas y manejan estados.
router.post(
  "/",
  autorizarRoles("Admin", "Secretaria"),
  pedidoController.crearPedido,
);

router.patch(
  "/:id/en-proceso",
  autorizarRoles("Admin", "Secretaria"),
  pedidoController.marcarEnProceso,
);

router.patch(
  "/:id/finalizar",
  autorizarRoles("Admin", "Secretaria"),
  pedidoController.finalizarPedido,
);

router.patch(
  "/:id/anular",
  autorizarRoles("Admin", "Secretaria"),
  pedidoController.anularPedido,
);

// Cliente actualiza observaciones; Admin/Secretaria tambien asignan fecha estimada.
router.patch(
  "/:id",
  autorizarRoles("Admin", "Secretaria", "Cliente"),
  pedidoController.actualizarPedido,
);

// Consulta compartida: el service restringe al cliente a sus propios pedidos.
router.get(
  "/",
  autorizarRoles("Admin", "Secretaria", "Cliente", "Diseñador"),
  pedidoController.listarPedidos,
);

router.get(
  "/buscar",
  autorizarRoles("Admin", "Secretaria", "Cliente", "Diseñador"),
  pedidoController.buscarParcial,
);

router.get(
  "/:idPedido/abonos",
  autorizarRoles("Admin", "Secretaria", "Cliente", "Diseñador"),
  abonoController.listarPorPedido,
);

router.get(
  "/:idPedido/disenos",
  autorizarRoles("Admin", "Secretaria", "Cliente", "Diseñador"),
  disenoController.listarPorPedido,
);

router.get(
  "/:idPedido/compras",
  autorizarRoles("Admin", "Secretaria", ROL_DISENADOR),
  compraController.listarPorPedido,
);

router.get(
  "/:id",
  autorizarRoles("Admin", "Secretaria", "Cliente", "Diseñador"),
  pedidoController.buscarPorId,
);

export default router;
