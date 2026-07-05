import { Router } from "express";
import { ProductoController } from "../controllers/producto.controller";
import { verificarAuth } from "../middlewares/auth.middleware";
import { autorizarPermiso } from "../middlewares/permisos.middleware";

const router = Router();
const productoController = new ProductoController();

router.use(verificarAuth);

router.get(
  "/",
  autorizarPermiso("productos.ver"),
  productoController.listarProductos,
);

router.post(
  "/",
  autorizarPermiso("productos.crear"),
  productoController.crearProducto,
);

router.get(
  "/:id/rangos",
  autorizarPermiso("productos.precios"),
  productoController.listarRangos,
);

router.patch(
  "/:id/rangos",
  autorizarPermiso("productos.precios"),
  productoController.reemplazarRangos,
);

router.get(
  "/:id",
  autorizarPermiso("productos.ver"),
  productoController.buscarPorId,
);

router.patch(
  "/:id",
  autorizarPermiso("productos.editar"),
  productoController.actualizarProducto,
);

router.delete(
  "/:id/eliminar",
  autorizarPermiso("productos.eliminar"),
  productoController.eliminarProducto,
);

router.delete(
  "/:id",
  autorizarPermiso("productos.desactivar"),
  productoController.desactivarProducto,
);

export default router;
