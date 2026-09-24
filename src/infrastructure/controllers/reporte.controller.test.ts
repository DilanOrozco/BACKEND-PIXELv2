import test from "node:test";
import assert from "node:assert/strict";
import { ReporteController } from "./reporte.controller";
import { ReporteService } from "../../applications/services/reporte.service";
import { ReporteValidationError } from "../../applications/validators/reporte.validator";

const reporteVacio = {
  reporte: "VENTAS" as const,
  generadoEn: "2026-09-23T15:00:00.000Z",
  zonaHoraria: "America/Bogota" as const,
  generadoPor: { idUsuario: 1, nombre: "admin@pixel.test" },
  periodo: { fechaInicio: null, fechaFin: null },
  filtros: {},
  resumen: { cantidadVentas: 0 },
  registros: [],
  totalRegistros: 0,
  paginacion: null,
};

const respuesta = () => ({
  statusCode: 0,
  payload: undefined as unknown,
  headers: {} as Record<string, string>,
  status(codigo: number) { this.statusCode = codigo; return this; },
  json(payload: unknown) { this.payload = payload; return this; },
  send(payload: unknown) { this.payload = payload; return this; },
  setHeader(nombre: string, valor: string) { this.headers[nombre] = valor; },
});

test("controller JSON responde contrato data y transmite identidad autenticada", async (t) => {
  const construir = t.mock.method(
    ReporteService.prototype,
    "construirReporte",
    async () => reporteVacio,
  );
  const res = respuesta();
  await new ReporteController().ventas(
    { query: {}, user: { idUsuario: 1, correo: "admin@pixel.test" } } as any,
    res as any,
  );
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.payload, { data: reporteVacio });
  assert.deepEqual(construir.mock.calls[0]?.arguments.slice(0, 3), [
    "VENTAS",
    {},
    { idUsuario: 1, nombre: undefined, correo: "admin@pixel.test" },
  ]);
});

test("controller PDF responde headers de descarga y buffer no vacio", async (t) => {
  t.mock.method(ReporteService.prototype, "construirReporte", async () => reporteVacio);
  const res = respuesta();
  await new ReporteController().ventasPdf(
    { query: {}, user: { idUsuario: 1, correo: "admin@pixel.test" } } as any,
    res as any,
  );
  assert.equal(res.statusCode, 200);
  assert.equal(res.headers["Content-Type"], "application/pdf");
  assert.match(res.headers["Content-Disposition"] ?? "", /attachment; filename="reporte-ventas-todos\.pdf"/);
  assert.ok(Buffer.isBuffer(res.payload));
  assert.equal((res.payload as Buffer).subarray(0, 4).toString(), "%PDF");
});

test("controller usa error estandar 400 para filtros invalidos", async (t) => {
  t.mock.method(ReporteService.prototype, "construirReporte", async () => {
    throw new ReporteValidationError("Fecha invalida.");
  });
  const res = respuesta();
  await new ReporteController().pedidos({ query: {}, user: {} } as any, res as any);
  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.payload, { message: "Fecha invalida." });
});

