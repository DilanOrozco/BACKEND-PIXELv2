import { Router } from "express";
import { UsuarioController } from "../controllers/usuario.controller";
import { verificarAuth } from "../middlewares/auth.middleware";
import {
  autorizarActualizacionUsuario,
  autorizarPermiso,
} from "../middlewares/permisos.middleware";

const router = Router();
const usuarioController = new UsuarioController();

router.use(verificarAuth);

router.post("/", autorizarPermiso("usuarios.crear"), usuarioController.crearUsuario);
router.get("/", autorizarPermiso("usuarios.ver"), usuarioController.listarUsuarios);
router.get("/buscar", autorizarPermiso("usuarios.ver"), usuarioController.buscarUsuarios);
router.get("/:id", autorizarPermiso("usuarios.ver"), usuarioController.buscarUsuarioPorId);
router.patch("/:id", autorizarActualizacionUsuario(), usuarioController.actualizarUsuario);
router.delete("/:id/eliminar", autorizarPermiso("usuarios.eliminar"), usuarioController.eliminarUsuario);
router.delete("/:id", autorizarPermiso("usuarios.desactivar"), usuarioController.desactivarUsuario);

export default router;
