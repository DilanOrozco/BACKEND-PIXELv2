import { Router } from "express";
import { DisenoController } from "../controllers/diseno.controller";
import { verificarAuth } from "../middlewares/auth.middleware";
import { autorizarRoles } from "../middlewares/roles.middleware";

const router = Router();
const controller = new DisenoController();

router.post(
  "/",
  verificarAuth,
  autorizarRoles("Admin", "Secretaria", "Diseñador"),
  controller.crearDiseno,
);

router.get(
  "/",
  verificarAuth,
  autorizarRoles("Admin", "Secretaria", "Diseñador"),
  controller.listarDisenos,
);

router.get(
  "/produccion/pendientes",
  verificarAuth,
  autorizarRoles("Admin", "Secretaria", "Diseñador"),
  controller.listarProduccionPendiente,
);

router.get(
  "/:id",
  verificarAuth,
  autorizarRoles("Admin", "Secretaria", "Diseñador", "Cliente"),
  controller.buscarPorId,
);

router.patch(
  "/:id",
  verificarAuth,
  autorizarRoles("Admin", "Secretaria", "Diseñador"),
  controller.actualizarDiseno,
);

router.patch(
  "/:id/aprobar",
  verificarAuth,
  autorizarRoles("Admin", "Secretaria", "Cliente"),
  controller.aprobarDiseno,
);

router.delete(
  "/:id",
  verificarAuth,
  autorizarRoles("Admin", "Secretaria"),
  controller.eliminarDiseno,
);

export default router;
