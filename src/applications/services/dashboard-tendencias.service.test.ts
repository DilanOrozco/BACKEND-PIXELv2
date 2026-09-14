import test from "node:test";
import assert from "node:assert/strict";
import {
  construirConsultaTendenciasAdmin,
  DashboardRepository,
  type TendenciaAdminRaw,
} from "../../infrastructure/repositories/dashboard.repository";
import dashboardRoutes from "../../infrastructure/routes/dashboard.routes";
import { PermisoService } from "./permiso.service";
import {
  DashboardService,
  DashboardValidationError,
} from "./dashboard.service";

const fila = (
  fecha: string,
  ingresos = 0,
  ventas = 0,
  pedidos = 0,
  cotizaciones = 0,
): TendenciaAdminRaw => ({
  fecha,
  ingresos,
  ventas,
  pedidos,
  cotizaciones,
});

const simularResultados = (
  t: test.TestContext,
  resultados: TendenciaAdminRaw[],
) =>
  t.mock.method(
    DashboardRepository.prototype,
    "obtenerTendenciasPorRango",
    async () => resultados,
  );

test("tendencias diarias conserva datos reales y completa dias sin movimiento", async (t) => {
  simularResultados(t, [
    fila("2026-08-01", 200000, 2, 3, 4),
    fila("2026-08-03", 350000, 1, 2, 3),
  ]);

  const resultado = await new DashboardService().obtenerTendenciasAdmin({
    fechaInicio: "2026-08-01",
    fechaFin: "2026-08-03",
    granularidad: "DIA",
  });

  assert.deepEqual(resultado.series, [
    fila("2026-08-01", 200000, 2, 3, 4),
    fila("2026-08-02"),
    fila("2026-08-03", 350000, 1, 2, 3),
  ]);
  assert.deepEqual(resultado.resumen, {
    ingresos: 550000,
    ventas: 3,
    pedidos: 5,
    cotizaciones: 7,
  });
});

test("varios abonos confirmados se reflejan en sus fechas respectivas", async (t) => {
  simularResultados(t, [
    fila("2026-08-10", 500000),
    fila("2026-08-15", 500000),
  ]);

  const resultado = await new DashboardService().obtenerTendenciasAdmin({
    fechaInicio: "2026-08-10",
    fechaFin: "2026-08-15",
  });

  assert.equal(resultado.series[0]?.ingresos, 500000);
  assert.equal(resultado.series[5]?.ingresos, 500000);
  assert.equal(resultado.resumen.ingresos, 1000000);
});

test("la serie semanal usa lunes y completa semanas vacias", async (t) => {
  simularResultados(t, [fila("2026-08-03", 100), fila("2026-08-17", 300)]);

  const resultado = await new DashboardService().obtenerTendenciasAdmin({
    fechaInicio: "2026-08-05",
    fechaFin: "2026-08-25",
    granularidad: "SEMANA",
  });

  assert.deepEqual(
    resultado.series.map((punto) => [punto.fecha, punto.ingresos]),
    [
      ["2026-08-03", 100],
      ["2026-08-10", 0],
      ["2026-08-17", 300],
      ["2026-08-24", 0],
    ],
  );
});

test("la serie mensual completa cambios de mes y de anio", async (t) => {
  simularResultados(t, [
    fila("2025-11-01", 10),
    fila("2026-01-01", 20),
  ]);

  const resultado = await new DashboardService().obtenerTendenciasAdmin({
    fechaInicio: "2025-11-20",
    fechaFin: "2026-02-10",
    granularidad: "MES",
  });

  assert.deepEqual(
    resultado.series.map((punto) => punto.fecha),
    ["2025-11-01", "2025-12-01", "2026-01-01", "2026-02-01"],
  );
  assert.equal(resultado.series[1]?.ingresos, 0);
});

test("la serie anual agrupa por inicio de cada anio", async (t) => {
  simularResultados(t, [fila("2025-01-01", 800, 2, 4, 6)]);

  const resultado = await new DashboardService().obtenerTendenciasAdmin({
    fechaInicio: "2024-06-01",
    fechaFin: "2026-03-01",
    granularidad: "ANIO",
  });

  assert.deepEqual(
    resultado.series.map((punto) => punto.fecha),
    ["2024-01-01", "2025-01-01", "2026-01-01"],
  );
  assert.equal(resultado.resumen.ingresos, 800);
});

test("dataset vacio devuelve todos los periodos en cero", async (t) => {
  simularResultados(t, []);

  const resultado = await new DashboardService().obtenerTendenciasAdmin({
    fechaInicio: "2026-08-01",
    fechaFin: "2026-08-02",
  });

  assert.deepEqual(resultado.series, [
    fila("2026-08-01"),
    fila("2026-08-02"),
  ]);
  assert.deepEqual(resultado.resumen, {
    ingresos: 0,
    ventas: 0,
    pedidos: 0,
    cotizaciones: 0,
  });
});

test("las fechas Colombia no se desplazan al dia anterior", async (t) => {
  const mock = simularResultados(t, [fila("2026-08-28", 125000)]);

  const resultado = await new DashboardService().obtenerTendenciasAdmin({
    fechaInicio: "2026-08-28",
    fechaFin: "2026-08-28",
  });

  assert.equal(resultado.series[0]?.fecha, "2026-08-28");
  assert.equal(resultado.series[0]?.ingresos, 125000);
  assert.deepEqual(mock.mock.calls[0]?.arguments, [
    "2026-08-28",
    "2026-08-29",
    "DIA",
  ]);
  assert.equal(resultado.periodo.zonaHoraria, "America/Bogota");
});

test("sin fechas usa los ultimos 30 dias y granularidad diaria", async (t) => {
  simularResultados(t, []);

  const resultado = await new DashboardService().obtenerTendenciasAdmin({});

  assert.equal(resultado.series.length, 30);
  assert.equal(resultado.periodo.granularidad, "DIA");
  assert.equal(resultado.series.at(-1)?.fecha, resultado.periodo.fechaFin);
});

test("rechaza fechas inexistentes", async () => {
  await assert.rejects(
    () =>
      new DashboardService().obtenerTendenciasAdmin({
        fechaInicio: "2026-02-30",
        fechaFin: "2026-03-01",
      }),
    DashboardValidationError,
  );
});

test("rechaza rango invertido", async () => {
  await assert.rejects(
    () =>
      new DashboardService().obtenerTendenciasAdmin({
        fechaInicio: "2026-08-31",
        fechaFin: "2026-08-01",
      }),
    /El rango de fechas no es v.lido/,
  );
});

test("requiere ambas fechas cuando se especifica un rango", async () => {
  await assert.rejects(
    () =>
      new DashboardService().obtenerTendenciasAdmin({
        fechaInicio: "2026-08-01",
      }),
    /fechaInicio y fechaFin juntas/,
  );
});

test("rechaza granularidad desconocida", async () => {
  await assert.rejects(
    () =>
      new DashboardService().obtenerTendenciasAdmin({
        fechaInicio: "2026-08-01",
        fechaFin: "2026-08-31",
        granularidad: "HORA",
      }),
    /DIA, SEMANA, MES o ANIO/,
  );
});

test("rechaza mas de 366 puntos antes de consultar base de datos", async (t) => {
  const mock = simularResultados(t, []);

  await assert.rejects(
    () =>
      new DashboardService().obtenerTendenciasAdmin({
        fechaInicio: "2025-01-01",
        fechaFin: "2026-01-02",
        granularidad: "DIA",
      }),
    /366 periodos/,
  );
  assert.equal(mock.mock.callCount(), 0);
});

test("consulta financiera usa solo abonos confirmados y no duplica con Venta", () => {
  const consulta = construirConsultaTendenciasAdmin(
    "2026-08-01",
    "2026-09-01",
    "DIA",
  );
  const sql = consulta.sql;

  assert.match(sql, /a\."estado" = 'CONFIRMADO'/);
  assert.match(sql, /SUM\(a\."monto"\)/);
  assert.match(sql, /v\."estado" <> 'ANULADA'/);
  assert.doesNotMatch(sql, /SUM\(v\."total_pagado"\)/);
  assert.match(sql, /COUNT\(\*\)::bigint AS ventas/);
});

test("consulta aplica America Bogota a limites y agrupaciones", () => {
  const consulta = construirConsultaTendenciasAdmin(
    "2026-08-01",
    "2026-08-02",
    "DIA",
  );
  const sql = consulta.sql;

  assert.match(sql, /AT TIME ZONE 'America\/Bogota'/);
  assert.match(sql, /AT TIME ZONE 'UTC'/);
});

test("ruta de tendencias queda protegida por auth, permiso y controlador", () => {
  const capa = (dashboardRoutes as any).stack.find(
    (item: any) => item.route?.path === "/admin/tendencias",
  );

  assert.ok(capa);
  assert.equal(capa.route.methods.get, true);
  assert.equal(capa.route.stack.length, 3);
});

test("ruta de tendencias responde 403 sin dashboard.admin", async (t) => {
  const verificarPermiso = t.mock.method(
    PermisoService.prototype,
    "rolTienePermiso",
    async () => false,
  );
  const capa = (dashboardRoutes as any).stack.find(
    (item: any) => item.route?.path === "/admin/tendencias",
  );
  const middlewarePermiso = capa.route.stack[1].handle;
  let status = 0;
  let body: any;
  let continuo = false;
  const response = {
    status(codigo: number) {
      status = codigo;
      return this;
    },
    json(valor: unknown) {
      body = valor;
      return this;
    },
  };

  await middlewarePermiso(
    { user: { idUsuario: 9, idRol: 4, rol: "Secretaria" } },
    response,
    () => {
      continuo = true;
    },
  );

  assert.equal(status, 403);
  assert.equal(continuo, false);
  assert.match(body.message, /No tienes permisos/);
  assert.deepEqual(verificarPermiso.mock.calls[0]?.arguments, [
    4,
    "dashboard.admin",
  ]);
});
