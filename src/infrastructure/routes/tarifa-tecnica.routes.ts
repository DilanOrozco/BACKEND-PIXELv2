import { Router } from "express";
import { TarifaTecnicaController } from "../controllers/tarifa-tecnica.controller";
import { verificarAuth } from "../middlewares/auth.middleware";
import { autorizarPermiso } from "../middlewares/permisos.middleware";
import { crearControladorImpactoEliminacion } from "../controllers/deletion-impact.controller";

const router = Router();
const controller = new TarifaTecnicaController();

router.use(verificarAuth);
router.get("/", autorizarPermiso("tarifas.tecnicas.ver"), controller.listar);
router.get(
  "/:id/impacto-eliminacion",
  autorizarPermiso("tarifas.tecnicas.ver"),
  crearControladorImpactoEliminacion("tarifaTecnica"),
);
router.post(
  "/",
  autorizarPermiso("tarifas.tecnicas.crear"),
  controller.crear,
);
router.patch(
  "/:id",
  autorizarPermiso("tarifas.tecnicas.editar"),
  controller.actualizar,
);
router.delete(
  "/:id",
  autorizarPermiso("tarifas.tecnicas.eliminar"),
  controller.eliminar,
);
router.get(
  "/tecnicas/:idTecnica/descuentos",
  autorizarPermiso("tarifas.tecnicas.ver"),
  controller.listarDescuentos,
);
router.patch(
  "/tecnicas/:idTecnica/descuentos",
  autorizarPermiso("tarifas.tecnicas.editar"),
  controller.reemplazarDescuentos,
);

export default router;
