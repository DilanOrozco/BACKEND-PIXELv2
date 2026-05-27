import { Router } from "express";
import { RolController } from "../controllers/rol.controller";

const router = Router();
const rolController = new RolController();

router.post("/", rolController.crearRol);
router.get("/", rolController.listarRoles);
router.get("/buscar", rolController.buscarPorNombre);
router.patch("/:id", rolController.actualizarRol);
router.delete("/:id/eliminar", rolController.eliminarRol);
router.delete("/:id", rolController.desactivarRol);

export default router;
