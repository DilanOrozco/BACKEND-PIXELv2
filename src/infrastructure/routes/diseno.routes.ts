import { Router } from "express";
import { DisenoController } from "../controllers/diseno.controller";
import { verificarAuth } from "../middlewares/auth.middleware";
import { autorizarPermiso } from "../middlewares/permisos.middleware";

const router = Router();
const controller = new DisenoController();

router.use(verificarAuth);

router.post("/", autorizarPermiso("disenos.crear"), controller.crearDiseno);
router.get("/", autorizarPermiso("disenos.ver"), controller.listarDisenos);
router.get(
  "/produccion/pendientes",
  autorizarPermiso("disenos.produccion"),
  controller.listarProduccionPendiente,
);
router.get("/:id", autorizarPermiso("disenos.ver"), controller.buscarPorId);
router.patch("/:id", autorizarPermiso("disenos.editar"), controller.actualizarDiseno);
router.patch("/:id/aprobar", autorizarPermiso("disenos.aprobar"), controller.aprobarDiseno);
router.delete("/:id", autorizarPermiso("disenos.eliminar"), controller.eliminarDiseno);

export default router;
