import { Router } from "express";
import { ProveedorController } from "../controllers/proveedor.controller";
import { verificarAuth } from "../middlewares/auth.middleware";
import { autorizarPermiso } from "../middlewares/permisos.middleware";
import { crearControladorImpactoEliminacion } from "../controllers/deletion-impact.controller";

const router = Router();
const proveedorController = new ProveedorController();

router.use(verificarAuth);

router.post(
  "/",
  autorizarPermiso("proveedores.crear"),
  proveedorController.crearProveedor,
);

router.get(
  "/",
  autorizarPermiso("proveedores.ver"),
  proveedorController.listarProveedores,
);

router.get(
  "/buscar",
  autorizarPermiso("proveedores.ver"),
  proveedorController.buscarParcial,
);

router.get(
  "/:id/impacto-eliminacion",
  autorizarPermiso("proveedores.ver"),
  crearControladorImpactoEliminacion("proveedor"),
);

router.get(
  "/:id",
  autorizarPermiso("proveedores.ver"),
  proveedorController.buscarPorId,
);

router.patch(
  "/:id",
  autorizarPermiso("proveedores.editar"),
  proveedorController.actualizarProveedor,
);

router.delete(
  "/:id/eliminar",
  autorizarPermiso("proveedores.eliminar"),
  proveedorController.eliminarProveedor,
);

router.delete(
  "/:id",
  autorizarPermiso("proveedores.desactivar"),
  proveedorController.desactivarProveedor,
);

export default router;
