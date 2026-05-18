import {prisma} from "../../config/prisma";
import { CotizacionRepository } from "../../infrastructure/repositories/cotizacion.repository";
import { UsuarioRepository } from "../../infrastructure/repositories/usuario.repository";
import {
  validarCrearCotizacion,
  validarActualizarCotizacion,
} from "../validators/cotizacion.validator";
import { cotizacionSelect } from "../../utils/selects/cotizacion.select";

const cotizacionRepository = new CotizacionRepository();
const usuarioRepository = new UsuarioRepository();

export class CotizacionService {
  async crearCotizacionNormal(data: any, usuarioAuth: any) {
    const error = validarCrearCotizacion(data);

    if (error) {
      throw new Error(error);
    }

    const cliente = await usuarioRepository.buscarPorId(Number(data.idCliente));

    if (!cliente) {
      throw new Error("El cliente no existe.");
    }

    const creadoPorId = usuarioAuth.idUsuario;

    const detallesPreparados = data.detalles.map((detalle: any) => {
      const cantidad = Number(detalle.cantidad);
      const precioUnitario = Number(detalle.precioUnitario);
      const costoDiseno = Number(detalle.costoDiseno || 0);
      const subtotal = cantidad * precioUnitario + costoDiseno;

      return {
        idTecnica: Number(detalle.idTecnica),
        descripcion: detalle.descripcion.trim(),
        cantidad,
        precioUnitario,
        costoDiseno,
        subtotal,
        observaciones: detalle.observaciones?.trim(),
      };
    });

    const subtotal = detallesPreparados.reduce(
      (acc: number, item: any) => acc + item.subtotal,
      0,
    );

    const costosAdicionales = Number(data.costosAdicionales || 0);
    const costoDiseno = detallesPreparados.reduce(
      (acc: number, item: any) => acc + item.costoDiseno,
      0,
    );

    const total = subtotal + costosAdicionales;

    return await prisma.cotizacion.create({
      data: {
        idCliente: Number(data.idCliente),
        creadoPorId,
        tipoCotizacion: "NORMAL",
        estado: "PENDIENTE",
        subtotal,
        costoDiseno,
        costosAdicionales,
        total,
        observaciones: data.observaciones?.trim(),
        detalles: {
          create: detallesPreparados,
        },
      },
      select: cotizacionSelect,
    });
  }

  async crearCotizacionRapida(data: any, usuarioAuth: any) {
    const error = validarCrearCotizacion(data);

    if (error) {
      throw new Error(error);
    }

    const cliente = await usuarioRepository.buscarPorId(Number(data.idCliente));

    if (!cliente) {
      throw new Error("El cliente no existe.");
    }

    const creadoPorId = usuarioAuth.idUsuario;

    const detallesPreparados = data.detalles.map((detalle: any) => {
      const cantidad = Number(detalle.cantidad);
      const precioUnitario = Number(detalle.precioUnitario);
      const costoDiseno = Number(detalle.costoDiseno || 0);
      const subtotal = cantidad * precioUnitario + costoDiseno;

      return {
        idTecnica: Number(detalle.idTecnica),
        descripcion: detalle.descripcion.trim(),
        cantidad,
        precioUnitario,
        costoDiseno,
        subtotal,
        observaciones: detalle.observaciones?.trim(),
      };
    });

    const subtotal = detallesPreparados.reduce(
      (acc: number, item: any) => acc + item.subtotal,
      0,
    );

    const costosAdicionales = Number(data.costosAdicionales || 0);
    const costoDiseno = detallesPreparados.reduce(
      (acc: number, item: any) => acc + item.costoDiseno,
      0,
    );

    const total = subtotal + costosAdicionales;

    return await prisma.$transaction(async (tx : any) => {
      const cotizacion = await tx.cotizacion.create({
        data: {
          idCliente: Number(data.idCliente),
          creadoPorId,
          tipoCotizacion: "RAPIDA",
          estado: "APROBADA",
          subtotal,
          costoDiseno,
          costosAdicionales,
          total,
          observaciones: data.observaciones?.trim(),
          detalles: {
            create: detallesPreparados,
          },
        },
        select: cotizacionSelect,
      });

      /*
        Aquí se debe crear el pedido automáticamente cuando ya tengas
        el modelo Pedido y DetallePedido.

        Ejemplo futuro:

        const pedido = await tx.pedido.create({
          data: {
            idCotizacion: cotizacion.idCotizacion,
            idCliente: cotizacion.idCliente,
            total: cotizacion.total,
            totalPagado: 0,
            saldoPendiente: cotizacion.total,
            estadoPago: "SIN_PAGO",
            estadoPedido: "PENDIENTE_PAGO",
          }
        });

        Luego se copian los detalles de cotización al detalle del pedido.
      */

      return cotizacion;
    });
  }

  async listarCotizaciones(usuarioAuth: any) {
    let cotizaciones;

    if (usuarioAuth.rol === "Cliente") {
      cotizaciones = await cotizacionRepository.listarPorCliente(
        usuarioAuth.idUsuario,
      );
    } else {
      cotizaciones = await cotizacionRepository.listarCotizaciones();
    }

    if (cotizaciones.length === 0) {
      throw new Error("No se encontraron resultados.");
    }

    return cotizaciones;
  }

  async buscarPorId(idCotizacion: number, usuarioAuth: any) {
    if (isNaN(idCotizacion) || idCotizacion <= 0) {
      throw new Error("El ID de la cotización no es válido.");
    }

    const cotizacion = await cotizacionRepository.buscarPorId(idCotizacion);

    if (!cotizacion) {
      throw new Error("No se encontraron resultados.");
    }

    if (
      usuarioAuth.rol === "Cliente" &&
      cotizacion.idCliente !== usuarioAuth.idUsuario
    ) {
      throw new Error("No tienes permisos para ver esta cotización.");
    }

    return cotizacion;
  }

  async buscarParcial(termino: string, usuarioAuth: any) {
    if (!termino || termino.trim() === "") {
      throw new Error("Debe ingresar un término de búsqueda.");
    }

    const resultados = await cotizacionRepository.buscarParcial(termino.trim());

    const cotizaciones =
      usuarioAuth.rol === "Cliente"
        ? resultados.filter((item : any) => item.idCliente === usuarioAuth.idUsuario)
        : resultados;

    if (cotizaciones.length === 0) {
      throw new Error("No se encontraron resultados.");
    }

    return cotizaciones;
  }

  async actualizarCotizacion(idCotizacion: number, data: any) {
    if (isNaN(idCotizacion) || idCotizacion <= 0) {
      throw new Error("El ID de la cotización no es válido.");
    }

    const error = validarActualizarCotizacion(data);

    if (error) {
      throw new Error(error);
    }

    const cotizacion = await cotizacionRepository.buscarPorId(idCotizacion);

    if (!cotizacion) {
      throw new Error("No se encontraron resultados.");
    }

    if (cotizacion.estado !== "PENDIENTE") {
      throw new Error("Solo se pueden modificar cotizaciones pendientes.");
    }

    const dataActualizar: any = {};

    if (data.observaciones !== undefined) {
      dataActualizar.observaciones = data.observaciones.trim();
    }

    if (data.costosAdicionales !== undefined) {
      const costosAdicionales = Number(data.costosAdicionales);

      dataActualizar.costosAdicionales = costosAdicionales;
      dataActualizar.total = Number(cotizacion.subtotal) + costosAdicionales;
    }

    return await cotizacionRepository.actualizarCotizacion(
      idCotizacion,
      dataActualizar,
    );
  }

  async aprobarCotizacion(idCotizacion: number) {
    if (isNaN(idCotizacion) || idCotizacion <= 0) {
      throw new Error("El ID de la cotización no es válido.");
    }

    const cotizacion = await cotizacionRepository.buscarPorId(idCotizacion);

    if (!cotizacion) {
      throw new Error("No se encontraron resultados.");
    }

    if (cotizacion.estado !== "PENDIENTE") {
      throw new Error("Solo se pueden aprobar cotizaciones pendientes.");
    }

    return await cotizacionRepository.aprobarCotizacion(idCotizacion);
  }

  async rechazarCotizacion(idCotizacion: number) {
    if (isNaN(idCotizacion) || idCotizacion <= 0) {
      throw new Error("El ID de la cotización no es válido.");
    }

    const cotizacion = await cotizacionRepository.buscarPorId(idCotizacion);

    if (!cotizacion) {
      throw new Error("No se encontraron resultados.");
    }

    if (cotizacion.estado !== "PENDIENTE") {
      throw new Error("Solo se pueden rechazar cotizaciones pendientes.");
    }

    return await cotizacionRepository.rechazarCotizacion(idCotizacion);
  }
}
