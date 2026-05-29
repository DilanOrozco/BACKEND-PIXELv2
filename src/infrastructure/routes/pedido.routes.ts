import { Router } from "express";
import { PedidoController } from "../controllers/pedido.controller";
import { verificarAuth } from "../middlewares/auth.middleware";
import { autorizarRoles } from "../middlewares/roles.middleware";

const router = Router();
const pedidoController = new PedidoController();

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

// Cliente: solo puede agregar observaciones mientras el pedido este pendiente.
router.patch(
  "/:id",
  autorizarRoles("Cliente"),
  pedidoController.actualizarObservacionesCliente,
);

// Consulta compartida: el service restringe al cliente a sus propios pedidos.
router.get(
  "/",
  autorizarRoles("Admin", "Secretaria", "Cliente"),
  pedidoController.listarPedidos,
);

router.get(
  "/buscar",
  autorizarRoles("Admin", "Secretaria", "Cliente"),
  pedidoController.buscarParcial,
);

router.get(
  "/:id",
  autorizarRoles("Admin", "Secretaria", "Cliente"),
  pedidoController.buscarPorId,
);

export default router;
