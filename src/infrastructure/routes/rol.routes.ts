import { Router } from "express";
import { RolController } from "../controllers/rol.controller";
import { verificarAuth } from "../middlewares/auth.middleware";
import { autorizarPermiso } from "../middlewares/permisos.middleware";

const router = Router();
const rolController = new RolController();

router.use(verificarAuth);

router.post("/", autorizarPermiso("roles.crear"), rolController.crearRol);
router.get("/", autorizarPermiso("roles.ver"), rolController.listarRoles);
router.get("/buscar", autorizarPermiso("roles.ver"), rolController.buscarPorNombre);
router.patch("/:id", autorizarPermiso("roles.editar"), rolController.actualizarRol);
router.delete("/:id/eliminar", autorizarPermiso("roles.eliminar"), rolController.eliminarRol);
router.delete("/:id", autorizarPermiso("roles.desactivar"), rolController.desactivarRol);

export default router;
