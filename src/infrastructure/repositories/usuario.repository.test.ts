import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("UsuarioRepository buscarPorCorreoConRol usa findFirst seguro por correo", () => {
  const source = readFileSync(
    new URL("./usuario.repository.ts", import.meta.url),
    "utf8",
  );
  const inicio = source.indexOf("async buscarPorCorreoConRol(correo: string)");
  const fin = source.indexOf("async buscarPorCorreoConRolYCliente", inicio);
  const metodo = source.slice(inicio, fin);

  assert.notEqual(inicio, -1);
  assert.notEqual(fin, -1);
  assert.match(metodo, /prisma\.usuario\.findFirst/);
  assert.doesNotMatch(metodo, /prisma\.usuario\.findUnique/);
  assert.match(metodo, /where:\s*\{\s*correo\s*\}/);
  assert.match(metodo, /select:\s*usuarioAuthSelect/);
  assert.match(metodo, /orderBy:\s*\{\s*idUsuario:\s*"asc"\s*\}/);
});
