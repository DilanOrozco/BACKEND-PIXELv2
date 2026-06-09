import { Router } from "express";
import { DashboardController } from "../controllers/dashboard.controller";
import { verificarAuth } from "../middlewares/auth.middleware";
import { autorizarRoles } from "../middlewares/roles.middleware";

const router = Router();
const dashboardController = new DashboardController();

router.get(
  "/admin",
  verificarAuth,
  autorizarRoles("Admin", "Secretaria"),
  dashboardController.obtenerDashboardAdmin,
);

router.get(
  "/cliente",
  verificarAuth,
  autorizarRoles("Cliente"),
  dashboardController.obtenerDashboardCliente,
);

export default router;
