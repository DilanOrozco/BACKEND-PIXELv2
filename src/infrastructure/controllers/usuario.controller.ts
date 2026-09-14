// backend/src/presentation/controllers/usuario.controller.ts
import type { Request, Response } from "express";
import { UsuarioService } from "../../applications/services/usuario.service";
import type { AuthRequest } from "../middlewares/auth.middleware";

const usuarioService = new UsuarioService();

export class UsuarioController {
  async crearUsuario(req: Request, res: Response) {
    try {
      const usuario = await usuarioService.crearUsuario(req.body);

      return res.status(201).json({
        message: "Usuario creado correctamente.",
        data: usuario,
      });
    } catch (error: any) {
      return res.status(400).json({
        message: error.message,
      });
    }
  }

  async listarUsuarios(req: Request, res: Response) {
    try {
      const usuarios = await usuarioService.listarUsuarios(
        req.query as Record<string, unknown>,
      );

      return res.status(200).json(usuarios);
    } catch (error: any) {
      return res.status(404).json({
        message: error.message,
      });
    }
  }

  async buscarUsuarioPorId(req: Request, res: Response) {
    try {
      const idUsuario = Number(req.params.id);

      const usuario = await usuarioService.buscarPorId(idUsuario);

      return res.status(200).json({
        data: usuario,
      });
    } catch (error: any) {
      return res.status(404).json({
        message: error.message,
      });
    }
  }

  async buscarUsuarios(req: Request, res: Response) {
    try {
      const { termino, idRol } = req.query;
      const parsedIdRol = idRol ? Number(idRol) : undefined;

      const usuarios = await usuarioService.buscarParcial(
        String(termino || ""),
        parsedIdRol,
        req.query as Record<string, unknown>,
      );

      return res.status(200).json(usuarios);
    } catch (error: any) {
      return res.status(404).json({
        message: error.message,
      });
    }
  }

  async actualizarUsuario(req: AuthRequest, res: Response) {
    try {
      const idUsuario = Number(req.params.id);

      const esPerfilPropioCliente =
        req.user?.rol === "Cliente" && Number(req.user.idUsuario) === idUsuario;
      const usuario = esPerfilPropioCliente
        ? await usuarioService.actualizarPerfilPropio(idUsuario, req.body)
        : await usuarioService.actualizarUsuario(idUsuario, req.body);

      return res.status(200).json({
        message: "Usuario actualizado correctamente.",
        data: usuario,
      });
    } catch (error: any) {
      return res.status(400).json({
        message: error.message,
      });
    }
  }

  async desactivarUsuario(req: Request, res: Response) {
    try {
      const idUsuario = Number(req.params.id);

      const usuario = await usuarioService.desactivarUsuario(idUsuario);

      return res.status(200).json({
        message: "Usuario desactivado correctamente.",
        data: usuario,
      });
    } catch (error: any) {
      return res.status(400).json({
        message: error.message,
      });
    }
  }

  async eliminarUsuario(req: Request, res: Response) {
    try {
      const idUsuario = Number(req.params.id);

      const usuario = await usuarioService.eliminarUsuario(idUsuario);

      return res.status(200).json({
        message: "Usuario eliminado correctamente.",
        data: usuario,
      });
    } catch (error: any) {
      return res.status(400).json({
        message: error.message,
      });
    }
  }
}
