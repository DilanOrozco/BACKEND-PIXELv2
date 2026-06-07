import { Router } from "express";
import { AbonoController } from "../controllers/abono.controller";
import { verificarAuth } from "../middlewares/auth.middleware";
import { autorizarRoles } from "../middlewares/roles.middleware";

const router = Router();
const controller = new AbonoController();

router.post(
  "/",
  verificarAuth,
  autorizarRoles("Admin", "Secretaria", "Cliente"),
  controller.crearAbono,
);

router.get(
  "/",
  verificarAuth,
  autorizarRoles("Admin", "Secretaria"),
  controller.listarAbonos,
);

router.get(
  "/:id",
  verificarAuth,
  autorizarRoles("Admin", "Secretaria", "Cliente", "Diseñador"),
  controller.buscarPorId,
);

router.patch(
  "/:id",
  verificarAuth,
  autorizarRoles("Admin", "Secretaria"),
  controller.actualizarAbono,
);

router.patch(
  "/:id/confirmar",
  verificarAuth,
  autorizarRoles("Admin", "Secretaria"),
  controller.confirmarAbono,
);

router.patch(
  "/:id/rechazar",
  verificarAuth,
  autorizarRoles("Admin", "Secretaria"),
  controller.rechazarAbono,
);

router.delete(
  "/:id",
  verificarAuth,
  autorizarRoles("Admin", "Secretaria"),
  controller.eliminarAbono,
);

export default router;
