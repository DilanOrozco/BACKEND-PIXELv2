import type { Request, Response, NextFunction } from "express";
import { verificarToken } from "../../utils/jwt.util";
import { prisma } from "../../config/prisma";

export interface AuthRequest extends Request {
  user?: any;
}

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

    const decoded: any = verificarToken(token);
    const idUsuario = Number(decoded?.idUsuario);

    if (!Number.isInteger(idUsuario) || idUsuario <= 0) {
      return res.status(401).json({
        message: "Token invalido.",
      });
    }

    const usuario = await prisma.usuario.findUnique({
      where: { idUsuario },
      select: {
        idUsuario: true,
        correo: true,
        idRol: true,
        estado: true,
        rol: {
          select: {
            nombre: true,
            estado: true,
          },
        },
        cliente: {
          select: {
            idCliente: true,
            estado: true,
          },
        },
      },
    });

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
      message: "Token invalido o expirado.",
    });
  }
};
