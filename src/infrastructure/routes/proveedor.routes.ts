import { Router } from "express";
import { ProveedorController } from "../controllers/proveedor.controller";
import { verificarAuth } from "../middlewares/auth.middleware";
import { autorizarRoles } from "../middlewares/roles.middleware";

const router = Router();
const proveedorController = new ProveedorController();

router.use(verificarAuth);

router.post(
  "/",
  autorizarRoles("Admin", "Secretaria"),
  proveedorController.crearProveedor,
);

router.get(
  "/",
  autorizarRoles("Admin", "Secretaria"),
  proveedorController.listarProveedores,
);

router.get(
  "/buscar",
  autorizarRoles("Admin", "Secretaria"),
  proveedorController.buscarParcial,
);

router.get(
  "/:id",
  autorizarRoles("Admin", "Secretaria"),
  proveedorController.buscarPorId,
);

router.patch(
  "/:id",
  autorizarRoles("Admin", "Secretaria"),
  proveedorController.actualizarProveedor,
);

router.delete(
  "/:id/eliminar",
  autorizarRoles("Admin"),
  proveedorController.eliminarProveedor,
);

router.delete(
  "/:id",
  autorizarRoles("Admin", "Secretaria"),
  proveedorController.desactivarProveedor,
);

export default router;
