import { Router } from "express";
import { CompraController } from "../controllers/compra.controller";
import { verificarAuth } from "../middlewares/auth.middleware";
import { autorizarPermiso } from "../middlewares/permisos.middleware";

const router = Router();
const compraController = new CompraController();

router.use(verificarAuth);

router.post("/", autorizarPermiso("compras.crear"), compraController.crearCompra);
router.get("/resumen", autorizarPermiso("compras.resumen"), compraController.obtenerResumen);
router.get("/", autorizarPermiso("compras.ver"), compraController.listarCompras);
router.get("/:id", autorizarPermiso("compras.ver"), compraController.buscarPorId);
router.patch("/:id/confirmar", autorizarPermiso("compras.confirmar"), compraController.confirmarCompra);
router.patch("/:id/anular", autorizarPermiso("compras.anular"), compraController.anularCompra);
router.patch("/:id", autorizarPermiso("compras.editar"), compraController.actualizarCompra);
router.delete("/:id", autorizarPermiso("compras.eliminar"), compraController.eliminarCompra);

export default router;
