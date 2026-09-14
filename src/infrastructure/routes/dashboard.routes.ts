import { Router } from "express";
import { DashboardController } from "../controllers/dashboard.controller";
import { verificarAuth } from "../middlewares/auth.middleware";
import { autorizarPermiso } from "../middlewares/permisos.middleware";

const router = Router();
const dashboardController = new DashboardController();

router.get(
  "/admin",
  verificarAuth,
  autorizarPermiso("dashboard.admin"),
  dashboardController.obtenerDashboardAdmin,
);

router.get(
  "/admin/tendencias",
  verificarAuth,
  autorizarPermiso("dashboard.admin"),
  dashboardController.obtenerTendenciasAdmin,
);

router.get(
  "/cliente",
  verificarAuth,
  autorizarPermiso("dashboard.cliente"),
  dashboardController.obtenerDashboardCliente,
);

export default router;
