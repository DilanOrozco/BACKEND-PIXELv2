import { prisma } from "../../config/prisma";

export class PasswordResetTokenRepository {
  async invalidarTokensActivos(idUsuario: number) {
    return await prisma.passwordResetToken.updateMany({
      where: {
        idUsuario,
        fechaUso: null,
        fechaExpiracion: {
          gt: new Date(),
        },
      },
      data: {
        fechaUso: new Date(),
      },
    });
  }

  async crearToken(data: {
    idUsuario: number;
    tokenHash: string;
    fechaExpiracion: Date;
  }) {
    return await prisma.passwordResetToken.create({
      data,
      select: {
        idPasswordResetToken: true,
        idUsuario: true,
        fechaExpiracion: true,
      },
    });
  }

  async buscarTokenValido(tokenHash: string) {
    return await prisma.passwordResetToken.findFirst({
      where: {
        tokenHash,
        fechaUso: null,
        fechaExpiracion: {
          gt: new Date(),
        },
      },
      include: {
        usuario: {
          include: {
            rol: true,
            cliente: true,
          },
        },
      },
    });
  }

  async marcarUsado(idPasswordResetToken: number) {
    return await prisma.passwordResetToken.update({
      where: { idPasswordResetToken },
      data: {
        fechaUso: new Date(),
      },
    });
  }
}
