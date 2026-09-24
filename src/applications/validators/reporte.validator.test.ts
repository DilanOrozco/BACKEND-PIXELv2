import test from "node:test";
import assert from "node:assert/strict";
import {
  prepararFiltrosReporte,
  ReporteValidationError,
} from "./reporte.validator";

test("reportes convierten el periodo inclusivo de Colombia a limites UTC", () => {
  const filtros = prepararFiltrosReporte("VENTAS", {
    fechaInicio: "2026-09-01",
    fechaFin: "2026-09-30",
    idCliente: "7",
    estadoPago: "completo",
    page: "2",
    limit: "25",
  });
  assert.equal(filtros.fechaInicioUtc?.toISOString(), "2026-09-01T05:00:00.000Z");
  assert.equal(filtros.fechaFinExclusivaUtc?.toISOString(), "2026-10-01T05:00:00.000Z");
  assert.equal(filtros.estadoPago, "COMPLETO");
  assert.equal(filtros.skip, 25);
});

test("reportes exigen ambas fechas y formato calendario exacto", () => {
  for (const query of [
    { fechaInicio: "2026-09-01" },
    { fechaFin: "2026-09-30" },
    { fechaInicio: "2026-02-30", fechaFin: "2026-03-01" },
    { fechaInicio: "2026-10-01", fechaFin: "2026-09-01" },
  ]) {
    assert.throws(
      () => prepararFiltrosReporte("PEDIDOS", query),
      ReporteValidationError,
    );
  }
});

test("reportes rechazan ids, estados, limites y filtros desconocidos", () => {
  assert.throws(() => prepararFiltrosReporte("ABONOS", { idPedido: "0" }), /entero positivo/);
  assert.throws(() => prepararFiltrosReporte("PEDIDOS", { estado: "INVENTADO" }), /no es valido/);
  assert.throws(() => prepararFiltrosReporte("VENTAS", { limit: "101" }), /no puede superar/);
  assert.throws(() => prepararFiltrosReporte("COTIZACIONES", { secreto: "x" }), /no esta permitido/);
});

test("PDF acepta los mismos filtros funcionales pero no paginacion", () => {
  const filtros = prepararFiltrosReporte(
    "ABONOS",
    { idPedido: "8", idCliente: "3", estado: "confirmado" },
    true,
  );
  assert.equal(filtros.idPedido, 8);
  assert.equal(filtros.estadoAbono, "CONFIRMADO");
  assert.throws(
    () => prepararFiltrosReporte("ABONOS", { page: "1" }, true),
    /no esta permitido/,
  );
});
