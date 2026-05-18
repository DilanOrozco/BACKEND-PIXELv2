import type { Request, Response } from "express";
import { UsuarioService } from "../../applications/services/usuario.service";

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
      const usuarios = await usuarioService.listarUsuarios();

      return res.status(200).json({
        data: usuarios,
      });
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
      const { termino } = req.query;

      const usuarios = await usuarioService.buscarParcial(
        String(termino || ""),
      );

      return res.status(200).json({
        data: usuarios,
      });
    } catch (error: any) {
      return res.status(404).json({
        message: error.message,
      });
    }
  }

  async actualizarUsuario(req: Request, res: Response) {
    try {
      const idUsuario = Number(req.params.id);

      const usuario = await usuarioService.actualizarUsuario(
        idUsuario,
        req.body,
      );

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
      return res.status(404).json({
        message: error.message,
      });
    }
  }
}
