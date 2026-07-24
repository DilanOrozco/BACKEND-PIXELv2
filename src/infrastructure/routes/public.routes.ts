import { Router } from "express";
import { PublicController } from "../controllers/public.controller";
import { verificarAuthOpcional } from "../middlewares/auth.middleware";

const router = Router();
const publicController = new PublicController();

router.get("/productos", publicController.listarProductos);
router.get("/categorias-producto", publicController.listarCategoriasProducto);
router.get("/tecnicas", publicController.listarTecnicas);
router.post("/cotizaciones/calcular", publicController.calcularCotizacion);
router.post(
  "/cotizaciones",
  verificarAuthOpcional,
  publicController.crearCotizacion,
);

export default router;
