import test from "node:test";
import assert from "node:assert/strict";
import { inflateSync } from "node:zlib";
import {
  crearPdfReporte,
  humanizarEnumPdf,
  nombreArchivoReporte,
} from "./report-pdf.util";
import type { ReporteData } from "../../applications/services/reporte.service";

const base = (reporte: ReporteData["reporte"]): ReporteData => ({
  reporte,
  generadoEn: "2026-09-23T15:00:00.000Z",
  zonaHoraria: "America/Bogota",
  generadoPor: { idUsuario: 1, nombre: "Admin Pixel" },
  periodo: { fechaInicio: "2026-09-01", fechaFin: "2026-09-30" },
  filtros: {},
  resumen: {},
  registros: [],
  totalRegistros: 0,
  paginacion: null,
});

const contarPaginas = (pdf: Buffer) =>
  pdf.toString("latin1").match(/\/Type\s*\/Page\b/g)?.length ?? 0;

const extraerTextoPaginas = (pdf: Buffer) => {
  const paginas: string[] = [];
  const inicioStream = Buffer.from("stream\n");
  const finStream = Buffer.from("\nendstream");
  let posicion = 0;

  while ((posicion = pdf.indexOf(inicioStream, posicion)) >= 0) {
    const inicio = posicion + inicioStream.length;
    const fin = pdf.indexOf(finStream, inicio);
    if (fin < 0) break;
    try {
      const contenido = inflateSync(pdf.subarray(inicio, fin)).toString("latin1");
      if (contenido.includes("BT") && contenido.includes("TJ")) {
        const texto = [...contenido.matchAll(/<([0-9a-f]+)>/gi)]
          .map((coincidencia) => Buffer.from(coincidencia[1], "hex").toString("latin1"))
          .join("");
        paginas.push(texto);
      }
    } catch {
      // Algunos streams PDF no usan FlateDecode y no corresponden al contenido de página.
    }
    posicion = fin + finStream.length;
  }

  return paginas;
};

const registrosPedidos = (cantidad: number) => Array.from({ length: cantidad }, (_, indice) => ({
  idPedido: indice + 1,
  fechaCreacion: new Date(2026, 8, (indice % 28) + 1),
  cliente: { nombre: `Cliente ${indice + 1}` },
  estadoPedido: indice % 2 === 0 ? "EN_PROCESO" : "PENDIENTE_SALDO_FINAL",
  fechaEntregaEstimada: new Date(2026, 9, (indice % 28) + 1),
  totalPedido: 100_000 + indice,
}));

test("cada reporte genera un PDF valido incluso sin resultados", async () => {
  for (const tipo of ["VENTAS", "PEDIDOS", "COTIZACIONES", "ABONOS"] as const) {
    const pdf = await crearPdfReporte(base(tipo));
    assert.ok(pdf.length > 500);
    assert.equal(pdf.subarray(0, 4).toString(), "%PDF");
  }
});

test("PDF renderiza tablas y formatos financieros de los cuatro reportes", async () => {
  const ejemplos: ReporteData[] = [
    { ...base("VENTAS"), resumen: { cantidadVentas: 1, totalVendido: 100000, ticketPromedio: 100000, cantidadClientes: 1 }, registros: [{ idVenta: 1, idPedido: 2, fecha: new Date(), cliente: { nombre: "Ana" }, estadoPago: "COMPLETO", total: 100000 }], totalRegistros: 1 },
    { ...base("PEDIDOS"), resumen: { totalPedidos: 1, pendientes: 0, enProceso: 1 }, registros: [{ idPedido: 2, fechaCreacion: new Date(), cliente: { nombre: "Ana" }, estadoPedido: "EN_PROCESO", fechaEntregaEstimada: null, totalPedido: 100000 }], totalRegistros: 1 },
    { ...base("COTIZACIONES"), resumen: { totalCotizaciones: 1, cantidadConvertidasPedido: 1, tasaConversion: 100 }, registros: [{ idCotizacion: 3, fechaCreacion: new Date(), cliente: { nombre: "Ana" }, estado: "CONVERTIDA_EN_PEDIDO", valorPropuestaVigente: 100000, idPedido: 2 }], totalRegistros: 1 },
    { ...base("ABONOS"), resumen: { cantidadAbonos: 1, totalConfirmado: 50000 }, registros: [{ idAbono: 4, idPedido: 2, cliente: { nombre: "Ana" }, fecha: new Date(), monto: 50000, estado: "CONFIRMADO", referencia: null }], totalRegistros: 1 },
  ];
  for (const reporte of ejemplos) {
    const pdf = await crearPdfReporte(reporte);
    assert.ok(pdf.length > 700);
  }
});

test("nombre PDF es determinista y sanitizado", () => {
  assert.equal(
    nombreArchivoReporte(base("VENTAS")),
    "reporte-ventas-2026-09-01-2026-09-30.pdf",
  );
  assert.equal(
    nombreArchivoReporte({ ...base("ABONOS"), periodo: { fechaInicio: null, fechaFin: null } }),
    "reporte-abonos-todos.pdf",
  );
});

test("reporte de una pagina conserva el footer dentro de la pagina", async () => {
  const pdf = await crearPdfReporte(base("COTIZACIONES"));
  const paginas = extraerTextoPaginas(pdf);

  assert.equal(contarPaginas(pdf), 1);
  assert.equal(paginas.length, 1);
  assert.match(paginas[0], /Sistema de Gestión PIXEL \| Página 1 de 1/);
  assert.match(paginas[0], /Total de registros: 0/);
});

test("reporte de tres paginas no duplica paginas al numerar footers", async () => {
  const registros = registrosPedidos(35);
  const pdf = await crearPdfReporte({
    ...base("PEDIDOS"),
    resumen: {
      totalPedidos: registros.length,
      pendientes: 0,
      enProceso: 18,
      pendientesSaldoFinal: 17,
      finalizados: 0,
      entregados: 0,
      anulados: 0,
    },
    registros,
    totalRegistros: registros.length,
  });
  const paginas = extraerTextoPaginas(pdf);

  assert.equal(contarPaginas(pdf), 3);
  assert.equal(paginas.length, 3);
  paginas.forEach((texto, indice) => {
    assert.match(texto, new RegExp(`Sistema de Gestión PIXEL \\| Página ${indice + 1} de 3`));
    assert.match(texto, /PedidoCreaciónClienteEstadoEntregaTotal/);
    assert.ok(texto.replace(/Sistema de Gestión PIXEL \| Página \d de 3/, "").length > 100);
  });
  assert.match(paginas[2], /Total de registros: 35/);
});

test("PDF humaniza enums, filtros y conserva acentos visibles", async () => {
  assert.equal(humanizarEnumPdf("EN_PROCESO"), "En proceso");
  assert.equal(humanizarEnumPdf("CONVERTIDA_EN_PEDIDO"), "Convertida en pedido");
  assert.equal(humanizarEnumPdf("PENDIENTE_SALDO_FINAL"), "Pendiente de saldo final");

  const registros = registrosPedidos(1);
  const pdf = await crearPdfReporte({
    ...base("PEDIDOS"),
    filtros: { estado: "EN_PROCESO" },
    resumen: { totalPedidos: 1, pendientes: 0, enProceso: 1 },
    registros,
    totalRegistros: 1,
  });
  const [texto] = extraerTextoPaginas(pdf);

  assert.match(texto, /Filtros: Estado: En proceso/);
  assert.match(texto, /Sistema de Gestión PIXEL/);
  assert.match(texto, /Período:/);
  assert.match(texto, /Creación/);
  assert.doesNotMatch(texto, /EN_PROCESO/);
});
