import { Router } from "express";
import { PermisoController } from "../controllers/permiso.controller";
import { verificarAuth } from "../middlewares/auth.middleware";
import { autorizarPermiso } from "../middlewares/permisos.middleware";

const router = Router();
const permisoController = new PermisoController();

router.use(verificarAuth);

router.post(
  "/sincronizar",
  autorizarPermiso("permisos.asignar"),
  permisoController.sincronizarPermisos,
);

router.get(
  "/",
  autorizarPermiso("permisos.ver"),
  permisoController.listarPermisos,
);

router.get(
  "/roles/:idRol",
  autorizarPermiso("permisos.ver"),
  permisoController.listarPermisosPorRol,
);

router.patch(
  "/roles/:idRol",
  autorizarPermiso("permisos.asignar"),
  permisoController.asignarPermisosARol,
);

export default router;
