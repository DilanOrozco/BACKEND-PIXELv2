import type { Request, Response } from "express";
import { AuthService } from "../../applications/services/auth.service";
import type { AuthRequest } from "../middlewares/auth.middleware";

const authService = new AuthService();

export class AuthController {
  async registrarCliente(req: Request, res: Response) {
    try {
      const usuario = await authService.registrarCliente(req.body);

      return res.status(201).json({
        message: "Cliente registrado correctamente.",
        data: usuario,
      });
    } catch (error: any) {
      return res.status(400).json({
        message: error.message,
      });
    }
  }

  async login(req: Request, res: Response) {
    try {
      const data = await authService.login(req.body);

      return res.status(200).json({
        message: "Inicio de sesión exitoso.",
        data,
      });
    } catch (error: any) {
      return res.status(401).json({
        message: error.message,
      });
    }
  }

  async forgotPassword(req: Request, res: Response) {
    try {
      const data = await authService.forgotPassword(req.body);

      return res.status(200).json(data);
    } catch (error: any) {
      return res.status(400).json({
        message: error.message,
      });
    }
  }

  async resetPassword(req: Request, res: Response) {
    try {
      const data = await authService.resetPassword(req.body);

      return res.status(200).json(data);
    } catch (error: any) {
      return res.status(400).json({
        message: error.message,
      });
    }
  }

  async misPermisos(req: AuthRequest, res: Response) {
    try {
      const data = await authService.obtenerPermisosUsuario(req.user);

      return res.status(200).json({
        data,
      });
    } catch (error: any) {
      return res.status(401).json({
        message: error.message,
      });
    }
  }
}
