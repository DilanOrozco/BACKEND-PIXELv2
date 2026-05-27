import { Router } from "express";
import { TecnicaController } from "../controllers/tecnica.controller";
import { verificarAuth } from "../middlewares/auth.middleware";
import { autorizarRoles } from "../middlewares/roles.middleware";

const router = Router();
const tecnicaController = new TecnicaController();

router.use(verificarAuth);

router.post(
  "/",
  autorizarRoles("Admin", "Secretaria"),
  tecnicaController.crearTecnica,
);

router.get(
  "/",
  autorizarRoles("Admin", "Secretaria", "Cliente"),
  tecnicaController.listarTecnicas,
);

router.get(
  "/buscar",
  autorizarRoles("Admin", "Secretaria", "Cliente"),
  tecnicaController.buscarParcial,
);

router.get(
  "/:id",
  autorizarRoles("Admin", "Secretaria", "Cliente"),
  tecnicaController.buscarPorId,
);

router.patch(
  "/:id",
  autorizarRoles("Admin", "Secretaria"),
  tecnicaController.actualizarTecnica,
);

router.delete(
  "/:id/eliminar",
  autorizarRoles("Admin", "Secretaria"),
  tecnicaController.eliminarTecnica,
);

router.delete(
  "/:id",
  autorizarRoles("Admin", "Secretaria"),
  tecnicaController.desactivarTecnica,
);

export default router;
