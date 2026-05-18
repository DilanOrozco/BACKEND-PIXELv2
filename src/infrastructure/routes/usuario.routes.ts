import { Router } from "express";
import { UsuarioController } from "../controllers/usuario.controller";

const router = Router();
const usuarioController = new UsuarioController();

router.post("/", usuarioController.crearUsuario);
router.get("/", usuarioController.listarUsuarios);
router.get("/buscar", usuarioController.buscarUsuarios);
router.get("/:id", usuarioController.buscarUsuarioPorId);
router.patch("/:id", usuarioController.actualizarUsuario);
router.delete("/:id", usuarioController.desactivarUsuario);

export default router;