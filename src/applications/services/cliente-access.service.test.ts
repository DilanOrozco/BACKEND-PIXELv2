import test from "node:test";
import assert from "node:assert/strict";
import { ClienteAccessService } from "./cliente-access.service";
import { PermisoService } from "./permiso.service";
import { UsuarioRepository } from "../../infrastructure/repositories/usuario.repository";
import { ClienteRepository } from "../../infrastructure/repositories/cliente.repository";
import { PasswordResetTokenRepository } from "../../infrastructure/repositories/password-reset-token.repository";

const cliente = {
  idCliente: 10,
  idUsuario: null,
  nombre: "Ana Cliente",
  correo: "ANA@PIXEL.TEST",
  telefono: "3001234567",
  estado: true,
};

const rolCliente = {
  idRol: 5,
  nombre: "Cliente",
  descripcion: "Cliente externo",
  estado: true,
};

test("ClienteAccessService crea Usuario Cliente, vincula Cliente y genera token", async (t) => {
  const frontendAnterior = process.env.FRONTEND_URL;
  process.env.FRONTEND_URL = "https://pixel.test";

  const rolMock = t.mock.method(
    PermisoService.prototype,
    "asegurarRolCliente",
    async () => rolCliente,
  );
  t.mock.method(
    UsuarioRepository.prototype,
    "buscarPorCorreoConRolYCliente",
    async () => null,
  );
  const crearUsuarioMock = t.mock.method(
    UsuarioRepository.prototype,
    "crearUsuario",
    async (data: any) => ({
      idUsuario: 77,
      ...data,
      rol: rolCliente,
      estado: true,
    }),
  );
  const vincularMock = t.mock.method(
    ClienteRepository.prototype,
    "vincularUsuario",
    async () => ({ ...cliente, idUsuario: 77 }),
  );
  const invalidarMock = t.mock.method(
    PasswordResetTokenRepository.prototype,
    "invalidarTokensActivos",
    async () => ({ count: 0 }),
  );
  const crearTokenMock = t.mock.method(
    PasswordResetTokenRepository.prototype,
    "crearToken",
    async (data: any) => data,
  );

  const respuesta = await new ClienteAccessService().asegurarAccesoCliente(cliente);
  const usuarioData = crearUsuarioMock.mock.calls[0]?.arguments[0];
  const tokenData = crearTokenMock.mock.calls[0]?.arguments[0];

  assert.equal(respuesta?.usuarioCreado, true);
  assert.equal(respuesta?.usuarioExistente, false);
  assert.equal(respuesta?.idUsuario, 77);
  assert.match(
    respuesta?.linkCrearPassword ?? "",
    /^https:\/\/pixel\.test\/crear-password-cliente\/[a-f0-9]{64}$/,
  );
  assert.equal(rolMock.mock.calls.length, 1);
  assert.equal(usuarioData.correo, "ana@pixel.test");
  assert.equal(usuarioData.idRol, 5);
  assert.equal(vincularMock.mock.calls[0]?.arguments[0], 10);
  assert.equal(vincularMock.mock.calls[0]?.arguments[1], 77);
  assert.equal(invalidarMock.mock.calls[0]?.arguments[0], 77);
  assert.equal(tokenData.idUsuario, 77);
  assert.equal(tokenData.tokenHash.length, 64);
  assert.ok(tokenData.fechaExpiracion instanceof Date);

  if (frontendAnterior === undefined) {
    delete process.env.FRONTEND_URL;
  } else {
    process.env.FRONTEND_URL = frontendAnterior;
  }
});

test("ClienteAccessService reutiliza Usuario Cliente existente y no duplica", async (t) => {
  t.mock.method(
    PermisoService.prototype,
    "asegurarRolCliente",
    async () => rolCliente,
  );
  t.mock.method(
    UsuarioRepository.prototype,
    "buscarPorCorreoConRolYCliente",
    async () => ({
      idUsuario: 77,
      correo: "ana@pixel.test",
      estado: true,
      rol: rolCliente,
      cliente: null,
    }),
  );
  const crearUsuarioMock = t.mock.method(
    UsuarioRepository.prototype,
    "crearUsuario",
    async () => ({}),
  );
  const vincularMock = t.mock.method(
    ClienteRepository.prototype,
    "vincularUsuario",
    async () => ({ ...cliente, idUsuario: 77 }),
  );

  const respuesta = await new ClienteAccessService().asegurarAccesoCliente(cliente);

  assert.equal(respuesta?.usuarioCreado, false);
  assert.equal(respuesta?.usuarioExistente, true);
  assert.equal(crearUsuarioMock.mock.calls.length, 0);
  assert.equal(vincularMock.mock.calls[0]?.arguments[1], 77);
});

test("ClienteAccessService bloquea correos de usuarios internos", async (t) => {
  t.mock.method(
    PermisoService.prototype,
    "asegurarRolCliente",
    async () => rolCliente,
  );
  t.mock.method(
    UsuarioRepository.prototype,
    "buscarPorCorreoConRolYCliente",
    async () => ({
      idUsuario: 1,
      correo: "admin@pixel.test",
      estado: true,
      rol: { idRol: 1, nombre: "Admin", estado: true },
      cliente: null,
    }),
  );

  await assert.rejects(
    () =>
      new ClienteAccessService().asegurarAccesoCliente({
        ...cliente,
        correo: "admin@pixel.test",
      }),
    /usuario interno/,
  );
});
