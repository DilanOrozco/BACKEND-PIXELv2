import test from "node:test";
import assert from "node:assert/strict";
import {
  aNumero,
  esEnteroPositivo,
  esMontoValido,
  redondearMoneda,
} from "./number.util";
import {
  esTextoNoVacio,
  esTextoOpcional,
  limpiarTextoOpcional,
} from "./text.util";
import {
  esFechaOpcionalValida,
  formatearFechaLegible,
  prepararFechaOpcional,
} from "./date.util";
import {
  validarCamposPermitidos,
  validarIdPositivo,
} from "./validation.util";
import {
  buildPaginationMeta,
  parsePaginationQuery,
} from "./pagination.util";

test("helpers numericos normalizan valores usados por servicios", () => {
  assert.equal(aNumero(undefined), 0);
  assert.equal(aNumero("12.5"), 12.5);
  assert.equal(redondearMoneda(10.129), 10.13);
  assert.equal(esEnteroPositivo("3"), true);
  assert.equal(esEnteroPositivo(0), false);
  assert.equal(esMontoValido("0"), false);
  assert.equal(esMontoValido("1.5"), true);
});

test("helpers de texto preservan el contrato de texto opcional", () => {
  assert.equal(limpiarTextoOpcional("  hola  "), "hola");
  assert.equal(limpiarTextoOpcional("   "), null);
  assert.equal(limpiarTextoOpcional(undefined), null);
  assert.equal(esTextoOpcional(null), true);
  assert.equal(esTextoOpcional(1), false);
  assert.equal(esTextoNoVacio(" pixel "), true);
  assert.equal(esTextoNoVacio("  "), false);
});

test("helpers de fecha validan y preparan fechas opcionales", () => {
  assert.equal(esFechaOpcionalValida(undefined), true);
  assert.equal(esFechaOpcionalValida("fecha-invalida"), false);
  assert.equal(prepararFechaOpcional(""), null);
  assert.ok(prepararFechaOpcional("2026-01-01") instanceof Date);
  assert.equal(formatearFechaLegible("2026-01-01"), "1 de enero de 2026");
});

test("helpers de validacion reportan campos no permitidos e ids invalidos", () => {
  assert.equal(
    validarCamposPermitidos({ nombre: "Pixel" }, ["nombre"]),
    null,
  );
  assert.equal(
    validarCamposPermitidos({ rol: "Admin" }, ["nombre"]),
    "El campo rol no se puede modificar en este endpoint.",
  );
  assert.throws(
    () => validarIdPositivo(0, "ID invalido."),
    /ID invalido\./,
  );
});

test("helpers de paginacion parsean query params con limites seguros", () => {
  const pagination = parsePaginationQuery(
    {
      page: "2",
      limit: "500",
      search: " pixel ",
      sortBy: "nombre",
      order: "asc",
    },
    {
      defaultSortBy: "idUsuario",
      allowedSortBy: ["idUsuario", "nombre"],
      maxLimit: 10,
    },
  );

  assert.deepEqual(pagination, {
    page: 2,
    limit: 10,
    skip: 10,
    search: "pixel",
    sortBy: "nombre",
    order: "asc",
    isPaginated: true,
  });
});

test("helpers de paginacion generan meta estable", () => {
  assert.deepEqual(buildPaginationMeta({ page: 2, limit: 10 }, 25), {
    page: 2,
    limit: 10,
    total: 25,
    totalPages: 3,
    hasNextPage: true,
    hasPrevPage: true,
  });
});
