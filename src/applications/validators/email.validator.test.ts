import assert from "node:assert/strict";
import test from "node:test";
import { esCorreoValido } from "./email.validator";

test("esCorreoValido conserva los formatos aceptados por los validadores", () => {
  for (const correo of [
    "cliente@pixel.com",
    "nombre.apellido+tag@sub.dominio.co",
    "a@b.c",
    "cliente@sub..dominio",
  ]) {
    assert.equal(esCorreoValido(correo), true, correo);
  }
});

test("esCorreoValido rechaza estructura incompleta, espacios y arrobas múltiples", () => {
  for (const correo of [
    "",
    "cliente",
    "@dominio.com",
    "cliente@.com",
    "cliente@dominio.",
    "cliente@@dominio.com",
    "cliente @dominio.com",
    "cliente@dominio.com\n",
  ]) {
    assert.equal(esCorreoValido(correo), false, correo);
  }
});
