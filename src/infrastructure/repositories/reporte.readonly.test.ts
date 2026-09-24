import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

test("modulo repository de reportes conserva read-only estricto", () => {
  const fuente = readFileSync(
    resolve(process.cwd(), "src/infrastructure/repositories/reporte.repository.ts"),
    "utf8",
  );
  for (const operacion of ["create", "createMany", "update", "updateMany", "delete", "deleteMany", "upsert", "$executeRaw"]) {
    assert.doesNotMatch(fuente, new RegExp(`\\.${operacion}\\s*\\(`));
  }
  assert.match(fuente, /findMany/);
  assert.match(fuente, /groupBy/);
  assert.match(fuente, /\$queryRaw/);
});

test("rutas reutilizan permisos reales y no publican Produccion sin semantica confiable", () => {
  const fuente = readFileSync(
    resolve(process.cwd(), "src/infrastructure/routes/reporte.routes.ts"),
    "utf8",
  );
  for (const permiso of ["ventas.ver", "pedidos.ver", "cotizaciones.ver", "abonos.ver"]) {
    assert.match(fuente, new RegExp(`autorizarPermiso\\(\\"${permiso.replace(".", "\\.")}\\"\\)`));
  }
  assert.doesNotMatch(fuente, /produccion/);
  assert.match(fuente, /router\.use\(verificarAuth\)/);
});

