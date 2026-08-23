import { Router } from "express";
import { TecnicaController } from "../controllers/tecnica.controller";
import { verificarAuth } from "../middlewares/auth.middleware";
import { autorizarPermiso } from "../middlewares/permisos.middleware";
import { crearControladorImpactoEliminacion } from "../controllers/deletion-impact.controller";

const router = Router();
const tecnicaController = new TecnicaController();

router.use(verificarAuth);

router.post(
  "/",
  autorizarPermiso("tecnicas.crear"),
  tecnicaController.crearTecnica,
);

router.get(
  "/",
  autorizarPermiso("tecnicas.ver"),
  tecnicaController.listarTecnicas,
);

router.get(
  "/buscar",
  autorizarPermiso("tecnicas.ver"),
  tecnicaController.buscarParcial,
);

router.get(
  "/:id/impacto-eliminacion",
  autorizarPermiso("tecnicas.ver"),
  crearControladorImpactoEliminacion("tecnica"),
);

router.get(
  "/:id",
  autorizarPermiso("tecnicas.ver"),
  tecnicaController.buscarPorId,
);

router.patch(
  "/:id",
  autorizarPermiso("tecnicas.editar"),
  tecnicaController.actualizarTecnica,
);

router.delete(
  "/:id/eliminar",
  autorizarPermiso("tecnicas.eliminar"),
  tecnicaController.eliminarTecnica,
);

router.delete(
  "/:id",
  autorizarPermiso("tecnicas.desactivar"),
  tecnicaController.desactivarTecnica,
);

export default router;
