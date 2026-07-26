import { Router } from "express";
import { DashboardController } from "../controllers/dashboard.controller";
import { DisenoController } from "../controllers/diseno.controller";
import { verificarAuth } from "../middlewares/auth.middleware";
import { autorizarPermiso } from "../middlewares/permisos.middleware";
import { AbonoController } from "../controllers/abono.controller";
import { uploadPaymentReceipt } from "../middlewares/upload.middleware";

const router = Router();
const dashboardController = new DashboardController();
const disenoController = new DisenoController();
const abonoController = new AbonoController();

router.use(verificarAuth);

router.get(
  "/dashboard",
  autorizarPermiso("dashboard.cliente"),
  dashboardController.obtenerDashboardCliente,
);

router.get(
  "/disenos",
  autorizarPermiso("disenos.cliente.ver"),
  disenoController.listarDisenosCliente,
);

router.get(
  "/disenos/:idDiseno",
  autorizarPermiso("disenos.cliente.ver"),
  disenoController.buscarPorId,
);

router.patch(
  "/disenos/:idDiseno/aprobar",
  autorizarPermiso("disenos.cliente.aprobar"),
  disenoController.aprobarDiseno,
);

router.post(
  "/pedidos/:idPedido/abonos/comprobante",
  autorizarPermiso("abonos.cliente.crear"),
  uploadPaymentReceipt,
  abonoController.subirComprobanteCliente,
);

router.get(
  "/pedidos/:idPedido/abonos",
  autorizarPermiso("abonos.cliente.ver"),
  abonoController.listarPorPedido,
);

router.get(
  "/abonos/:idAbono/comprobante",
  autorizarPermiso("abonos.cliente.ver"),
  abonoController.descargarComprobante,
);

router.patch(
  "/disenos/:idDiseno/rechazar",
  autorizarPermiso("disenos.cliente.rechazar"),
  disenoController.rechazarDiseno,
);

export default router;
