import test from "node:test";
import assert from "node:assert/strict";
import {
  formatCurrencyCOP,
  formatEmailDate,
  formatEmailDateTime,
  humanizeDesignStatus,
  humanizeOrderStatus,
  humanizePaymentStatus,
} from "./email-formatters";

test("formatos de email muestran moneda COP y fechas humanas", () => {
  assert.equal(formatCurrencyCOP(851000), "$ 851.000");
  assert.equal(formatCurrencyCOP(0), "$ 0");
  assert.equal(formatEmailDate("2026-08-10"), "10 de agosto de 2026");
  assert.equal(
    formatEmailDateTime("2026-08-11T04:59:00.000Z"),
    "10 de agosto de 2026, 11:59 p. m.",
  );
});

test("fecha de calendario no cambia de dia por la zona horaria", () => {
  assert.equal(formatEmailDate("2026-01-01"), "1 de enero de 2026");
  assert.doesNotMatch(formatEmailDate("2026-01-01"), /31 de diciembre/);
});

test("estados internos se convierten a lenguaje humano", () => {
  assert.equal(humanizeOrderStatus("EN_PROCESO"), "En producción");
  assert.equal(humanizePaymentStatus("COMPLETO"), "Pago completo");
  assert.equal(humanizeDesignStatus("PENDIENTE_CREACION_PIXEL"), "Pendiente de preparación por PIXEL");
});
