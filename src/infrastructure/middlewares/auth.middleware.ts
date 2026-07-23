import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { verificarToken } from "../../utils/jwt.util";
import { UsuarioRepository } from "../repositories/usuario.repository";

export interface AuthRequest extends Request {
  user?: any;
}

const usuarioRepository = new UsuarioRepository();

export const verificarAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        message: "Token no proporcionado.",
      });
    }

    const token = authHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        message: "Token invalido.",
      });
    }

    let decoded: any;

    try {
      decoded = verificarToken(token);
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        return res.status(401).json({
          message: "Sesi\u00f3n expirada. Inicia sesi\u00f3n nuevamente.",
        });
      }

      if (error instanceof jwt.JsonWebTokenError) {
        return res.status(401).json({
          message: "Token invalido.",
        });
      }

      throw error;
    }

    const idUsuario = Number(decoded?.idUsuario);

    if (!Number.isInteger(idUsuario) || idUsuario <= 0) {
      return res.status(401).json({
        message: "Token invalido.",
      });
    }

    const usuario = await usuarioRepository.buscarUsuarioAuthPorId(idUsuario);

    if (!usuario || !usuario.estado || !usuario.rol?.estado) {
      return res.status(401).json({
        message: "Usuario inactivo o no autorizado.",
      });
    }

    req.user = {
      ...decoded,
      idUsuario: usuario.idUsuario,
      correo: usuario.correo,
      idRol: usuario.idRol,
      rol: usuario.rol.nombre,
      idCliente: usuario.cliente?.estado ? usuario.cliente.idCliente : null,
    };

    next();
  } catch {
    return res.status(401).json({
      message: "Token invalido.",
    });
  }
};
