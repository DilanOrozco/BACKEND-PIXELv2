import assert from "node:assert/strict";
import test from "node:test";
import {
  validarActualizarProveedor,
  validarCrearProveedor,
  validarFiltrosProveedor,
} from "./proveedor.validator";

test("validarCrearProveedor cubre nombre, contacto y campos permitidos", () => {
  assert.equal(
    validarCrearProveedor({
      nombre: "Proveedor",
      telefono: null,
      correo: "ventas@proveedor.test",
      direccion: "Calle 1",
    }),
    null,
  );

  for (const [entrada, esperado] of [
    [{ nombre: "Proveedor", estado: true }, /campo estado/i],
    [{ nombre: " " }, /nombre.*obligatorio/i],
    [{ nombre: "Proveedor", telefono: 123 }, /telefono.*texto/i],
    [{ nombre: "Proveedor", correo: "correo-invalido" }, /correo.*valido/i],
    [{ nombre: "Proveedor", direccion: 123 }, /direccion.*texto/i],
  ] as Array<[Record<string, unknown>, RegExp]>) {
    assert.match(validarCrearProveedor(entrada) ?? "", esperado);
  }
});

test("validarActualizarProveedor exige cambios válidos", () => {
  assert.equal(validarActualizarProveedor({ estado: false }), null);
  assert.match(validarActualizarProveedor({}) ?? "", /al menos un campo/i);
  assert.match(validarActualizarProveedor({ nombre: "x" }) ?? "", /nombre.*2 y 100/i);
  assert.match(validarActualizarProveedor({ estado: "false" }) ?? "", /estado.*booleano/i);
  assert.match(validarActualizarProveedor({ extra: true }) ?? "", /campo extra/i);
});

test("validarFiltrosProveedor acepta booleanos y strings explícitos", () => {
  for (const estado of [undefined, true, false, "true", "false"]) {
    assert.equal(validarFiltrosProveedor({ estado }), null);
  }

  assert.match(validarFiltrosProveedor({ estado: "1" }) ?? "", /true o false/i);
});
