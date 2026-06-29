import { Router } from "express";
import { PedidoController } from "../controllers/pedido.controller";
import { AbonoController } from "../controllers/abono.controller";
import { DisenoController } from "../controllers/diseno.controller";
import { CompraController } from "../controllers/compra.controller";
import { verificarAuth } from "../middlewares/auth.middleware";
import { autorizarPermiso } from "../middlewares/permisos.middleware";

const router = Router();
const pedidoController = new PedidoController();
const abonoController = new AbonoController();
const disenoController = new DisenoController();
const compraController = new CompraController();

router.use(verificarAuth);

router.post(
  "/",
  autorizarPermiso("pedidos.crear"),
  pedidoController.crearPedido,
);

router.patch(
  "/:id/en-proceso",
  autorizarPermiso("pedidos.pasar_proceso"),
  pedidoController.marcarEnProceso,
);

router.patch(
  "/:id/finalizar",
  autorizarPermiso("pedidos.finalizar"),
  pedidoController.finalizarPedido,
);

router.patch(
  "/:id/anular",
  autorizarPermiso("pedidos.anular"),
  pedidoController.anularPedido,
);

router.patch(
  "/:id",
  autorizarPermiso("pedidos.editar"),
  pedidoController.actualizarPedido,
);

router.get(
  "/",
  autorizarPermiso("pedidos.ver"),
  pedidoController.listarPedidos,
);

router.get(
  "/buscar",
  autorizarPermiso("pedidos.ver"),
  pedidoController.buscarParcial,
);

router.get(
  "/:idPedido/abonos",
  autorizarPermiso("abonos.ver"),
  abonoController.listarPorPedido,
);

router.get(
  "/:idPedido/disenos",
  autorizarPermiso("disenos.ver"),
  disenoController.listarPorPedido,
);

router.get(
  "/:idPedido/compras",
  autorizarPermiso("compras.ver"),
  compraController.listarPorPedido,
);

router.get(
  "/:id",
  autorizarPermiso("pedidos.ver"),
  pedidoController.buscarPorId,
);

export default router;
