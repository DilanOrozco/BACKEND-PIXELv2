import { Router } from "express";
import { AbonoController } from "../controllers/abono.controller";
import { verificarAuth } from "../middlewares/auth.middleware";
import { autorizarPermiso } from "../middlewares/permisos.middleware";
import { uploadPaymentReceipt } from "../middlewares/upload.middleware";

const router = Router();
const controller = new AbonoController();

router.use(verificarAuth);

router.post(
  "/",
  autorizarPermiso("abonos.crear"),
  uploadPaymentReceipt,
  controller.crearAbono,
);
router.get("/", autorizarPermiso("abonos.ver"), controller.listarAbonos);
router.get(
  "/:idAbono/comprobante",
  autorizarPermiso("abonos.ver"),
  controller.descargarComprobante,
);
router.get("/:id", autorizarPermiso("abonos.ver"), controller.buscarPorId);
router.patch("/:id", autorizarPermiso("abonos.editar"), controller.actualizarAbono);
router.patch("/:id/confirmar", autorizarPermiso("abonos.confirmar"), controller.confirmarAbono);
router.patch("/:id/rechazar", autorizarPermiso("abonos.rechazar"), controller.rechazarAbono);
router.delete("/:id", autorizarPermiso("abonos.eliminar"), controller.eliminarAbono);

export default router;
