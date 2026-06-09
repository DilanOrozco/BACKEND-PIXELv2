import { Router } from "express";
import { CompraController } from "../controllers/compra.controller";
import { verificarAuth } from "../middlewares/auth.middleware";
import { autorizarRoles } from "../middlewares/roles.middleware";

const router = Router();
const compraController = new CompraController();
const ROL_DISENADOR = "Dise\u00f1ador";

router.use(verificarAuth);

router.post(
  "/",
  autorizarRoles("Admin", "Secretaria"),
  compraController.crearCompra,
);

router.get(
  "/resumen",
  autorizarRoles("Admin", "Secretaria"),
  compraController.obtenerResumen,
);

router.get(
  "/",
  autorizarRoles("Admin", "Secretaria", ROL_DISENADOR),
  compraController.listarCompras,
);

router.get(
  "/:id",
  autorizarRoles("Admin", "Secretaria", ROL_DISENADOR),
  compraController.buscarPorId,
);

router.patch(
  "/:id/confirmar",
  autorizarRoles("Admin", "Secretaria"),
  compraController.confirmarCompra,
);

router.patch(
  "/:id/anular",
  autorizarRoles("Admin", "Secretaria"),
  compraController.anularCompra,
);

router.patch(
  "/:id",
  autorizarRoles("Admin", "Secretaria"),
  compraController.actualizarCompra,
);

router.delete(
  "/:id",
  autorizarRoles("Admin", "Secretaria"),
  compraController.eliminarCompra,
);

export default router;
