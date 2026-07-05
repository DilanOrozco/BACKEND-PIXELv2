import { prisma } from "../../config/prisma";
import { clienteSelect } from "../../utils/selects/cliente.select";

export interface ClienteData {
  nombre: string;
  documento?: string | null;
  correo?: string | null;
  telefono?: string | null;
  direccion?: string | null;
}

export class ClienteRepository {
  async buscarPorId(idCliente: number) {
    return await prisma.cliente.findUnique({
      where: { idCliente },
      select: clienteSelect,
    });
  }

  async buscarPorCorreoOTelefono(correo?: string | null, telefono?: string | null) {
    if (!correo && !telefono) {
      return null;
    }

    return await prisma.cliente.findFirst({
      where: {
        OR: [
          ...(correo ? [{ correo }] : []),
          ...(telefono ? [{ telefono }] : []),
        ],
      },
      select: clienteSelect,
      orderBy: {
        idCliente: "asc",
      },
    });
  }

  async crearCliente(data: ClienteData) {
    return await prisma.cliente.create({
      data: {
        ...data,
        estado: true,
      },
      select: clienteSelect,
    });
  }

  async actualizarCliente(idCliente: number, data: Partial<ClienteData>) {
    return await prisma.cliente.update({
      where: { idCliente },
      data,
      select: clienteSelect,
    });
  }
}
