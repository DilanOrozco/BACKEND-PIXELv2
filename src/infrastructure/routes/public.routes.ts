import { Router } from "express";
import { PublicController } from "../controllers/public.controller";

const router = Router();
const publicController = new PublicController();

router.get("/productos", publicController.listarProductos);
router.post("/cotizaciones/calcular", publicController.calcularCotizacion);
router.post("/cotizaciones", publicController.crearCotizacion);

export default router;
