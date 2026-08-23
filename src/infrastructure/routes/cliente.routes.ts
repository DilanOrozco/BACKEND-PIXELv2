import { Router } from "express";
import { ClienteController } from "../controllers/cliente.controller";
import { verificarAuth } from "../middlewares/auth.middleware";
import { autorizarPermiso } from "../middlewares/permisos.middleware";
import { crearControladorImpactoEliminacion } from "../controllers/deletion-impact.controller";

const router = Router();
const clienteController = new ClienteController();

router.use(verificarAuth);

router.get(
  "/",
  autorizarPermiso("clientes.ver"),
  clienteController.listarClientes,
);

router.get(
  "/:id/pedidos",
  autorizarPermiso("pedidos.ver"),
  clienteController.listarPedidos,
);

router.get(
  "/:id/impacto-eliminacion",
  autorizarPermiso("clientes.ver"),
  crearControladorImpactoEliminacion("cliente"),
);

router.get(
  "/:id",
  autorizarPermiso("clientes.ver"),
  clienteController.buscarPorId,
);

router.patch(
  "/:id/desactivar",
  autorizarPermiso("clientes.desactivar"),
  clienteController.desactivarCliente,
);

router.delete(
  "/:id",
  autorizarPermiso("clientes.eliminar"),
  clienteController.eliminarCliente,
);

export default router;
