import test from "node:test";
import assert from "node:assert/strict";
import { MAXIMO_REGISTROS_PDF, ReporteService } from "./reporte.service";

const cliente = { idCliente: 4, nombre: "Cliente Pixel" };
const fecha = new Date("2026-09-15T15:00:00.000Z");

const repositorioBase = () => ({
  resumenVentas: async () => ({ cantidadVentas: 0, totalVendido: 0, cantidadClientes: 0 }),
  listarVentas: async () => [],
  resumenPedidos: async () => [],
  listarPedidos: async () => [],
  resumenCotizaciones: async () => [],
  listarCotizaciones: async () => [],
  resumenAbonos: async () => [],
  listarAbonos: async () => [],
});

test("reporte ventas mantiene vendido separado de abonos y clientes DISTINCT", async () => {
  const repo = {
    ...repositorioBase(),
    resumenVentas: async () => ({ cantidadVentas: 2n, totalVendido: "300000", cantidadClientes: 1n }),
    listarVentas: async () => [
      { idVenta: 2, idPedido: 12, fechaPrimerPago: fecha, cliente, pedido: { estadoPago: "PARCIAL" }, estado: "PARCIAL", totalPedido: 200000 },
      { idVenta: 1, idPedido: 11, fechaPrimerPago: fecha, cliente, pedido: { estadoPago: "COMPLETO" }, estado: "COMPLETA", totalPedido: 100000 },
    ],
  };
  const resultado = await new ReporteService(repo as any).construirReporte(
    "VENTAS",
    {},
    { idUsuario: 1, correo: "admin@pixel.test" },
  );
  assert.deepEqual(resultado.resumen, {
    cantidadVentas: 2,
    totalVendido: 300000,
    ticketPromedio: 150000,
    cantidadClientes: 1,
  });
  assert.equal(resultado.registros.length, 2);
  assert.equal(resultado.generadoPor.nombre, "admin@pixel.test");
});

test("reporte pedidos calcula cada estado y porcentajes sobre el conjunto completo", async () => {
  const repo = {
    ...repositorioBase(),
    resumenPedidos: async () => [
      { estadoPedido: "PENDIENTE", _count: { _all: 1 } },
      { estadoPedido: "EN_PROCESO", _count: { _all: 1 } },
    ],
    listarPedidos: async () => [{
      idPedido: 8,
      idCliente: 4,
      fechaCreacion: fecha,
      estadoPedido: "EN_PROCESO",
      fechaEntregaEstimada: null,
      total: 500000,
      cliente,
    }],
  };
  const resultado = await new ReporteService(repo as any).construirReporte("PEDIDOS", {}, {});
  assert.equal(resultado.resumen.totalPedidos, 2);
  assert.equal(resultado.resumen.enProceso, 1);
  assert.equal((resultado.resumen.porcentajePorEstado as any).EN_PROCESO, 50);
  assert.equal(resultado.totalRegistros, 2);
});

test("reporte cotizaciones incluye convertidas y solo expone propuesta relevante", async () => {
  const repo = {
    ...repositorioBase(),
    resumenCotizaciones: async () => [
      { estado: "CONVERTIDA_EN_PEDIDO", _count: { _all: 1 } },
      { estado: "EN_REVISION", _count: { _all: 1 } },
    ],
    listarCotizaciones: async () => [{
      idCotizacion: 5,
      idCliente: 4,
      fechaCreacion: fecha,
      estado: "CONVERTIDA_EN_PEDIDO",
      cliente,
      versiones: [{ precioFinal: 850000 }],
      pedidos: [{ idPedido: 9 }],
    }],
  };
  const resultado = await new ReporteService(repo as any).construirReporte("COTIZACIONES", {}, {});
  assert.equal(resultado.resumen.totalCotizaciones, 2);
  assert.equal(resultado.resumen.cantidadConvertidasPedido, 1);
  assert.equal(resultado.resumen.tasaConversion, 50);
  assert.equal(resultado.registros[0]?.valorPropuestaVigente, 850000);
  assert.equal(resultado.registros[0]?.idPedido, 9);
});

test("reporte abonos nunca suma pendientes como ingreso confirmado", async () => {
  const repo = {
    ...repositorioBase(),
    resumenAbonos: async () => [
      { estado: "CONFIRMADO", _count: { _all: 1 }, _sum: { monto: 100000 } },
      { estado: "PENDIENTE", _count: { _all: 2 }, _sum: { monto: 900000 } },
      { estado: "RECHAZADO", _count: { _all: 1 }, _sum: { monto: 50000 } },
    ],
    listarAbonos: async () => [{
      idAbono: 3,
      idPedido: 8,
      monto: 100000,
      referencia: "PIXEL-3",
      estado: "CONFIRMADO",
      fechaCreacion: fecha,
      fechaConfirmacion: fecha,
      pedido: { cliente },
    }],
  };
  const resultado = await new ReporteService(repo as any).construirReporte("ABONOS", {}, {});
  assert.equal(resultado.resumen.cantidadAbonos, 4);
  assert.equal(resultado.resumen.totalConfirmado, 100000);
  assert.equal(resultado.resumen.totalPendiente, 900000);
  assert.notEqual(resultado.resumen.totalConfirmado, 1000000);
});

test("reportes vacios devuelven 200-compatible con KPIs en cero", async () => {
  for (const tipo of ["VENTAS", "PEDIDOS", "COTIZACIONES", "ABONOS"] as const) {
    const resultado = await new ReporteService(repositorioBase() as any)
      .construirReporte(tipo, {}, {});
    assert.equal(resultado.totalRegistros, 0);
    assert.deepEqual(resultado.registros, []);
  }
});

test("PDF bloquea volumen superior al limite antes de producir un documento enorme", async () => {
  const repo = {
    ...repositorioBase(),
    resumenVentas: async () => ({
      cantidadVentas: MAXIMO_REGISTROS_PDF + 1,
      totalVendido: 1,
      cantidadClientes: 1,
    }),
  };
  await assert.rejects(
    () => new ReporteService(repo as any).construirReporte("VENTAS", {}, {}, true),
    /limite seguro/,
  );
});

test("cada builder transmite rango y filtros tipados al repository", async () => {
  const recibidos: any[] = [];
  const repo = {
    resumenVentas: async (filtros: any) => { recibidos.push(["VENTAS", filtros]); return { cantidadVentas: 0, totalVendido: 0, cantidadClientes: 0 }; },
    listarVentas: async () => [],
    resumenPedidos: async (filtros: any) => { recibidos.push(["PEDIDOS", filtros]); return []; },
    listarPedidos: async () => [],
    resumenCotizaciones: async (filtros: any) => { recibidos.push(["COTIZACIONES", filtros]); return []; },
    listarCotizaciones: async () => [],
    resumenAbonos: async (filtros: any) => { recibidos.push(["ABONOS", filtros]); return []; },
    listarAbonos: async () => [],
  };
  const servicio = new ReporteService(repo as any);
  const periodo = { fechaInicio: "2026-09-01", fechaFin: "2026-09-30", idCliente: "4" };
  await servicio.construirReporte("VENTAS", { ...periodo, estadoPago: "COMPLETO" }, {});
  await servicio.construirReporte("PEDIDOS", { ...periodo, estado: "EN_PROCESO" }, {});
  await servicio.construirReporte("COTIZACIONES", { ...periodo, estado: "CONVERTIDA_EN_PEDIDO" }, {});
  await servicio.construirReporte("ABONOS", { ...periodo, estado: "CONFIRMADO", idPedido: "8" }, {});
  assert.equal(recibidos[0][1].estadoPago, "COMPLETO");
  assert.equal(recibidos[1][1].estadoPedido, "EN_PROCESO");
  assert.equal(recibidos[2][1].estadoCotizacion, "CONVERTIDA_EN_PEDIDO");
  assert.equal(recibidos[3][1].estadoAbono, "CONFIRMADO");
  assert.equal(recibidos[3][1].idPedido, 8);
  for (const [, filtros] of recibidos) {
    assert.equal(filtros.idCliente, 4);
    assert.equal(filtros.fechaInicioUtc.toISOString(), "2026-09-01T05:00:00.000Z");
    assert.equal(filtros.fechaFinExclusivaUtc.toISOString(), "2026-10-01T05:00:00.000Z");
  }
});
