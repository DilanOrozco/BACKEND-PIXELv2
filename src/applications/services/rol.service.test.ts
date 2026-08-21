import test from "node:test";
import assert from "node:assert/strict";
import { RolService } from "./rol.service";
import { RolRepository } from "../../infrastructure/repositories/rol.repository";

const rol = {
  idRol: 8,
  nombre: "Operaciones",
  descripcion: null,
  estado: true,
};

const impactoVacio = {
  usuariosCantidad: 0,
  usuarios: [],
  permisosCantidad: 0,
  permisos: [],
  tokensCantidad: 0,
  clientesCantidad: 0,
  clientes: [],
  cotizacionesCantidad: 0,
  cotizaciones: [],
  abonosCantidad: 0,
  abonos: [],
  disenosCantidad: 0,
  disenos: [],
  comprasCantidad: 0,
  compras: [],
  respuestasCantidad: 0,
  respuestas: [],
};

test("impacto de rol sin usuarios no exige confirmacion reforzada", async (t) => {
  t.mock.method(RolRepository.prototype, "buscarPorId", async () => rol);
  t.mock.method(
    RolRepository.prototype,
    "obtenerImpactoEliminacion",
    async () => impactoVacio,
  );

  const resultado = await new RolService().obtenerImpactoEliminacion(8);

  assert.equal(resultado.puedeEliminar, true);
  assert.equal(resultado.requiereConfirmacionReforzada, false);
  assert.equal(resultado.totalAfectados, 0);
  assert.deepEqual(resultado.afectados, []);
});

test("impacto de rol informa un usuario sin exponer datos sensibles", async (t) => {
  t.mock.method(RolRepository.prototype, "buscarPorId", async () => rol);
  t.mock.method(
    RolRepository.prototype,
    "obtenerImpactoEliminacion",
    async () => ({
      ...impactoVacio,
      usuariosCantidad: 1,
      usuarios: [{ idUsuario: 21, nombre: "Ana Lopez" }],
    }),
  );

  const resultado = await new RolService().obtenerImpactoEliminacion(8);

  assert.equal(resultado.requiereConfirmacionReforzada, true);
  assert.equal(resultado.totalAfectados, 1);
  assert.deepEqual(resultado.afectados[0]?.registros, [
    { id: 21, nombre: "Ana Lopez" },
  ]);
  assert.equal(JSON.stringify(resultado).includes("correo"), false);
});

test("impacto de rol limita la muestra y conserva el total real", async (t) => {
  t.mock.method(RolRepository.prototype, "buscarPorId", async () => rol);
  t.mock.method(
    RolRepository.prototype,
    "obtenerImpactoEliminacion",
    async () => ({
      ...impactoVacio,
      usuariosCantidad: 15,
      usuarios: Array.from({ length: 10 }, (_, index) => ({
        idUsuario: index + 1,
        nombre: `Usuario ${index + 1}`,
      })),
    }),
  );

  const resultado = await new RolService().obtenerImpactoEliminacion(8);

  assert.equal(resultado.totalAfectados, 15);
  assert.equal(resultado.afectados[0]?.registros.length, 10);
  assert.equal(resultado.afectados[0]?.registrosOmitidos, 5);
});

test("consultar impacto no elimina el rol ni sus usuarios", async (t) => {
  t.mock.method(RolRepository.prototype, "buscarPorId", async () => rol);
  t.mock.method(
    RolRepository.prototype,
    "obtenerImpactoEliminacion",
    async () => impactoVacio,
  );
  const eliminarMock = t.mock.method(
    RolRepository.prototype,
    "eliminarRol",
    async () => rol,
  );

  await new RolService().obtenerImpactoEliminacion(8);

  assert.equal(eliminarMock.mock.callCount(), 0);
});

test("DELETE de rol conserva su funcionamiento actual", async (t) => {
  t.mock.method(RolRepository.prototype, "buscarPorId", async () => rol);
  const eliminarMock = t.mock.method(
    RolRepository.prototype,
    "eliminarRol",
    async () => rol,
  );

  const resultado = await new RolService().eliminarRol(8);

  assert.equal(eliminarMock.mock.callCount(), 1);
  assert.equal(resultado.idRol, 8);
});
