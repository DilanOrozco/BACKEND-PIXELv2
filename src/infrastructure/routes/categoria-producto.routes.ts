import { Router } from "express";
import { CategoriaProductoController } from "../controllers/categoria-producto.controller";
import { verificarAuth } from "../middlewares/auth.middleware";
import { autorizarPermiso } from "../middlewares/permisos.middleware";

const router = Router();
const categoriaProductoController = new CategoriaProductoController();

router.use(verificarAuth);

router.get(
  "/",
  autorizarPermiso("categorias_producto.ver"),
  categoriaProductoController.listarCategorias,
);

router.post(
  "/",
  autorizarPermiso("categorias_producto.crear"),
  categoriaProductoController.crearCategoria,
);

router.get(
  "/:id",
  autorizarPermiso("categorias_producto.ver"),
  categoriaProductoController.buscarPorId,
);

router.patch(
  "/:id",
  autorizarPermiso("categorias_producto.editar"),
  categoriaProductoController.actualizarCategoria,
);

router.patch(
  "/:id/desactivar",
  autorizarPermiso("categorias_producto.desactivar"),
  categoriaProductoController.desactivarCategoria,
);

router.delete(
  "/:id/eliminar",
  autorizarPermiso("categorias_producto.eliminar"),
  categoriaProductoController.eliminarCategoria,
);

router.delete(
  "/:id",
  autorizarPermiso("categorias_producto.eliminar"),
  categoriaProductoController.eliminarCategoria,
);

export default router;
