import test from "node:test";
import assert from "node:assert/strict";
import { PermisoService } from "./permiso.service";
import { PermisoRepository } from "../../infrastructure/repositories/permiso.repository";
import { RolRepository } from "../../infrastructure/repositories/rol.repository";

const rolCliente = {
  idRol: 5,
  nombre: "Cliente",
  descripcion: "Cliente externo",
  estado: true,
};
const rolOperario = {
  idRol: 8,
  nombre: "Operario",
  descripcion: "Rol operativo",
  estado: true,
};

test("PermisoService asegurarRolCliente no sincroniza permisos en flujo publico", async (t) => {
  const syncMock = t.mock.method(
    PermisoRepository.prototype,
    "sincronizarPermisosSistema",
    async () => {
      throw new Error("No debe sincronizar permisos");
    },
  );
  const buscarRolMock = t.mock.method(
    RolRepository.prototype,
    "buscarPorNombreExacto",
    async () => rolCliente,
  );
  const crearRolMock = t.mock.method(
    RolRepository.prototype,
    "crearRol",
    async () => rolCliente,
  );

  const rol = await new PermisoService().asegurarRolCliente();

  assert.equal(rol.idRol, 5);
  assert.equal(buscarRolMock.mock.calls.length, 1);
  assert.equal(syncMock.mock.calls.length, 0);
  assert.equal(crearRolMock.mock.calls.length, 0);
});

test("PermisoService asegurarRolCliente crea rol Cliente sin sincronizacion pesada si no existe", async (t) => {
  const syncMock = t.mock.method(
    PermisoRepository.prototype,
    "sincronizarPermisosSistema",
    async () => {
      throw new Error("No debe sincronizar permisos");
    },
  );
  t.mock.method(
    RolRepository.prototype,
    "buscarPorNombreExacto",
    async () => null,
  );
  const crearRolMock = t.mock.method(
    RolRepository.prototype,
    "crearRol",
    async (nombre: string, descripcion?: string) => ({
      ...rolCliente,
      nombre,
      descripcion,
    }),
  );

  const rol = await new PermisoService().asegurarRolCliente();

  assert.equal(rol.nombre, "Cliente");
  assert.equal(crearRolMock.mock.calls.length, 1);
  assert.equal(syncMock.mock.calls.length, 0);
});

test("PermisoService sincronizarPermisosSistema conserva sincronizacion admin", async (t) => {
  const syncMock = t.mock.method(
    PermisoRepository.prototype,
    "sincronizarPermisosSistema",
    async () => [{ codigo: "dashboard.cliente" }],
  );
  const asegurarRolMock = t.mock.method(
    RolRepository.prototype,
    "asegurarRolConPermisos",
    async () => rolCliente,
  );

  const permisos = await new PermisoService().sincronizarPermisosSistema();

  assert.equal(permisos.length, 1);
  assert.equal(syncMock.mock.calls.length, 1);
  assert.equal(asegurarRolMock.mock.calls.length, 1);
});

test("PermisoService asigna permisos a rol existente sin sincronizar catalogo", async (t) => {
  const syncMock = t.mock.method(
    PermisoRepository.prototype,
    "sincronizarPermisosSistema",
    async () => {
      throw new Error("No debe sincronizar permisos");
    },
  );
  const buscarRolMock = t.mock.method(
    RolRepository.prototype,
    "buscarPorId",
    async () => rolOperario,
  );
  const listarPermisosMock = t.mock.method(
    PermisoRepository.prototype,
    "listarPermisosActivosPorCodigos",
    async (codigos: string[]) =>
      codigos.map((codigo, index) => ({
        idPermiso: index + 1,
        codigo,
      })),
  );
  const asignarMock = t.mock.method(
    PermisoRepository.prototype,
    "asignarPermisosARol",
    async (idRol: number, codigos: string[]) => ({
      ...rolOperario,
      idRol,
      permisos: codigos.map((codigo) => ({ permiso: { codigo } })),
    }),
  );

  const rol = await new PermisoService().asignarPermisosARol(8, [
    "pedidos.ver",
    "pedidos.ver",
    "pedidos.editar",
  ]);

  assert.ok(rol);
  assert.equal(rol.idRol, 8);
  assert.equal(buscarRolMock.mock.calls.length, 1);
  assert.equal(listarPermisosMock.mock.calls.length, 1);
  assert.deepEqual(listarPermisosMock.mock.calls[0]?.arguments[0], [
    "pedidos.ver",
    "pedidos.editar",
  ]);
  assert.equal(asignarMock.mock.calls.length, 1);
  assert.deepEqual(asignarMock.mock.calls[0]?.arguments, [
    8,
    ["pedidos.ver", "pedidos.editar"],
  ]);
  assert.equal(syncMock.mock.calls.length, 0);
});

test("PermisoService asigna permisos a rol recien creado sin sincronizacion pesada", async (t) => {
  const syncMock = t.mock.method(
    PermisoRepository.prototype,
    "sincronizarPermisosSistema",
    async () => {
      throw new Error("No debe sincronizar permisos");
    },
  );
  t.mock.method(RolRepository.prototype, "buscarPorId", async () => ({
    ...rolOperario,
    idRol: 12,
  }));
  t.mock.method(
    PermisoRepository.prototype,
    "listarPermisosActivosPorCodigos",
    async () => [{ idPermiso: 3, codigo: "usuarios.ver" }],
  );
  const asignarMock = t.mock.method(
    PermisoRepository.prototype,
    "asignarPermisosARol",
    async (idRol: number, codigos: string[]) => ({
      ...rolOperario,
      idRol,
      permisos: codigos.map((codigo) => ({ permiso: { codigo } })),
    }),
  );

  const rol = await new PermisoService().asignarPermisosARol(12, [
    "usuarios.ver",
  ]);

  assert.ok(rol);
  assert.equal(rol.idRol, 12);
  assert.equal(asignarMock.mock.calls.length, 1);
  assert.equal(syncMock.mock.calls.length, 0);
});

test("PermisoService permite permisos vacios y deja el rol sin permisos", async (t) => {
  const syncMock = t.mock.method(
    PermisoRepository.prototype,
    "sincronizarPermisosSistema",
    async () => {
      throw new Error("No debe sincronizar permisos");
    },
  );
  t.mock.method(RolRepository.prototype, "buscarPorId", async () => rolOperario);
  const listarPermisosMock = t.mock.method(
    PermisoRepository.prototype,
    "listarPermisosActivosPorCodigos",
    async () => [],
  );
  const asignarMock = t.mock.method(
    PermisoRepository.prototype,
    "asignarPermisosARol",
    async (idRol: number, codigos: string[]) => ({
      ...rolOperario,
      idRol,
      permisos: codigos,
    }),
  );

  const rol = await new PermisoService().asignarPermisosARol(8, []);

  assert.ok(rol);
  assert.equal(rol.idRol, 8);
  assert.equal(listarPermisosMock.mock.calls.length, 1);
  assert.deepEqual(asignarMock.mock.calls[0]?.arguments, [8, []]);
  assert.equal(syncMock.mock.calls.length, 0);
});

test("PermisoService rechaza codigos inexistentes sin reemplazar permisos", async (t) => {
  const syncMock = t.mock.method(
    PermisoRepository.prototype,
    "sincronizarPermisosSistema",
    async () => {
      throw new Error("No debe sincronizar permisos");
    },
  );
  t.mock.method(RolRepository.prototype, "buscarPorId", async () => rolOperario);
  t.mock.method(
    PermisoRepository.prototype,
    "listarPermisosActivosPorCodigos",
    async () => [{ idPermiso: 1, codigo: "pedidos.ver" }],
  );
  const asignarMock = t.mock.method(
    PermisoRepository.prototype,
    "asignarPermisosARol",
    async () => rolOperario,
  );

  await assert.rejects(
    () =>
      new PermisoService().asignarPermisosARol(8, [
        "pedidos.ver",
        "permiso.inexistente",
      ]),
    /Permisos no existen o estan inactivos: permiso\.inexistente\./,
  );
  assert.equal(asignarMock.mock.calls.length, 0);
  assert.equal(syncMock.mock.calls.length, 0);
});
