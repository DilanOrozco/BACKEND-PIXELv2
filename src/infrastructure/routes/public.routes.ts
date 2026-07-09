import { Router } from "express";
import { PublicController } from "../controllers/public.controller";

const router = Router();
const publicController = new PublicController();

router.get("/productos", publicController.listarProductos);
router.get("/categorias-producto", publicController.listarCategoriasProducto);
router.get("/tecnicas", publicController.listarTecnicas);
router.post("/cotizaciones/calcular", publicController.calcularCotizacion);
router.post("/cotizaciones", publicController.crearCotizacion);

export default router;
