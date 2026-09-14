import test from "node:test";
import assert from "node:assert/strict";
import { CotizacionService } from "./cotizacion.service";
import { PedidoService } from "./pedido.service";
import { VentaService } from "./venta.service";
import { CotizacionWorkflowService } from "./cotizacion-workflow.service";
import { CotizacionRepository } from "../../infrastructure/repositories/cotizacion.repository";
import { PedidoRepository } from "../../infrastructure/repositories/pedido.repository";
import { VentaRepository } from "../../infrastructure/repositories/venta.repository";

const admin = { idUsuario: 1, rol: "Admin" };

test("listado administrativo de cotizaciones excluye convertidas antes de paginar", async (t) => {
  const listarMock = t.mock.method(
    CotizacionRepository.prototype,
    "listarCotizacionesPaginado",
    async () => ({ data: [], total: 0 }),
  );

  const respuesta = await new CotizacionService().listarCotizaciones(admin, {
    page: "1",
    limit: "10",
  });

  assert.deepEqual(listarMock.mock.calls[0]?.arguments[0], {
    excluirConvertidas: true,
  });
  assert.equal((respuesta as any).meta.total, 0);
  assert.equal((respuesta as any).meta.totalPages, 0);
});

test("cotizaciones convertidas pueden consultarse mediante filtro explicito", async (t) => {
  const listarMock = t.mock.method(
    CotizacionRepository.prototype,
    "listarCotizacionesPaginado",
    async () => ({ data: [], total: 0 }),
  );

  await new CotizacionService().listarCotizaciones(admin, {
    page: "1",
    estado: "CONVERTIDA_EN_PEDIDO",
  });

  assert.deepEqual(listarMock.mock.calls[0]?.arguments[0], {
    estado: "CONVERTIDA_EN_PEDIDO",
  });
});

test("detalle administrativo expone propuesta actual sin exigir numero de version", () => {
  const propuesta = {
    idVersion: 9,
    numeroVersion: 3,
    esVigente: true,
    precioFinal: 850000,
    descuentoManual: 0,
    costosAdicionales: 0,
    subtotalDesglose: 850000,
    ajusteManual: 0,
    conceptosAdicionales: [],
    disenosOficiales: [],
    desgloseVisible: { total: 850000 },
    observacionesCliente: null,
    mensajeCliente: null,
    validaHasta: new Date("2026-09-01T23:59:59.000Z"),
    enviadaAt: new Date("2026-08-23T12:00:00.000Z"),
    estado: "ENVIADA",
    respuesta: null,
  };
  const resultado = (new CotizacionService() as any).formatearCotizacion({
    idCotizacion: 12,
    subtotal: 850000,
    descuentoTotal: 0,
    detalles: [],
    versiones: [propuesta],
    requiereRevisionPrecio: false,
  });

  assert.equal(resultado.propuestaActual.idVersion, 9);
  assert.equal(resultado.propuestaActual.precioFinal, 850000);
  assert.equal("numeroVersion" in resultado.propuestaActual, false);
});

test("serializacion cliente no recibe el alias administrativo propuestaActual", async (t) => {
  t.mock.method(
    CotizacionRepository.prototype,
    "listarCotizacionesPaginado",
    async () => ({
      data: [
        {
          idCotizacion: 12,
          idCliente: 5,
          subtotal: 0,
          descuentoTotal: 0,
          detalles: [],
          versiones: [],
          requiereRevisionPrecio: false,
        },
      ],
      total: 1,
    }),
  );

  const respuesta = await new CotizacionService().listarCotizaciones(
    { idUsuario: 8, idCliente: 5, rol: "Cliente" },
    { page: "1", limit: "10" },
  );

  assert.equal("propuestaActual" in respuesta.data[0], false);
});

test("listado administrativo de pedidos excluye entregados antes de paginar", async (t) => {
  const listarMock = t.mock.method(
    PedidoRepository.prototype,
    "listarPedidosPaginado",
    async () => ({ data: [], total: 0 }),
  );

  const respuesta = await new PedidoService().listarPedidos(admin, {
    page: "1",
    limit: "10",
  });

  assert.deepEqual(listarMock.mock.calls[0]?.arguments[0], {
    excluirEntregados: true,
  });
  assert.equal((respuesta as any).meta.total, 0);
});

test("pedidos entregados pueden consultarse mediante filtro explicito", async (t) => {
  const listarMock = t.mock.method(
    PedidoRepository.prototype,
    "listarPedidosPaginado",
    async () => ({ data: [], total: 0 }),
  );

  await new PedidoService().listarPedidos(admin, {
    page: "1",
    estadoPedido: "ENTREGADO",
  });

  assert.deepEqual(listarMock.mock.calls[0]?.arguments[0], {
    estadoPedido: "ENTREGADO",
  });
});

test("ventas conserva pedidos entregados, idPedido y filtros opcionales por fecha", async (t) => {
  const listarMock = t.mock.method(
    VentaRepository.prototype,
    "listarVentas",
    async () => [
      {
        idPedido: 36,
        idCliente: 5,
        estadoPago: "COMPLETO",
        total: 850000,
        totalPagado: 850000,
        saldoPendiente: 0,
        fechaCreacion: new Date("2026-08-01T12:00:00.000Z"),
        fechaFinalizado: new Date("2026-08-20T12:00:00.000Z"),
        fechaEntregado: new Date("2026-08-22T12:00:00.000Z"),
        cliente: { nombre: "Cliente", correo: null, telefono: null },
        venta: {
          idVenta: 15,
          estado: "PAGADA",
          fechaPrimerPago: new Date("2026-08-10T12:00:00.000Z"),
        },
        detalles: [],
      },
    ],
  );

  const ventas = await new VentaService().listarVentas({
    fechaInicio: "2026-08-01",
  });
  const filtros = listarMock.mock.calls[0]?.arguments[0] as any;

  assert.equal(ventas[0]?.idPedido, 36);
  assert.equal(ventas[0]?.fechaEntregado instanceof Date, true);
  assert.equal(filtros.fechaInicio.toISOString(), "2026-08-01T00:00:00.000Z");
  assert.equal(filtros.fechaFin, undefined);
});

test("fallo de propuesta se detiene antes de transaccion y no revierte la cotizacion creada", async () => {
  let consultas = 0;
  let transacciones = 0;
  const service = new CotizacionWorkflowService(
    {
      cotizacion: {
        findUnique: async () => {
          consultas += 1;
          return null;
        },
      },
    },
    async () => {
      transacciones += 1;
      throw new Error("No debe ejecutarse.");
    },
  );

  await assert.rejects(
    () => service.enviarPropuesta(50, { precioFinal: 0 }, admin),
    /precio final propuesto debe ser mayor a 0/i,
  );
  assert.equal(consultas, 0);
  assert.equal(transacciones, 0);
});
