import { Router } from "express";
import { AuthController } from "../controllers/auth.controller";
import { verificarAuth } from "../middlewares/auth.middleware";

const router = Router();
const authController = new AuthController();

router.post("/register", authController.registrarCliente);
router.post("/login", authController.login);
router.get("/me/permisos", verificarAuth, authController.misPermisos);

export default router;
