import test from "node:test";
import assert from "node:assert/strict";
import { UsuarioService } from "./usuario.service";
import { UsuarioRepository } from "../../infrastructure/repositories/usuario.repository";

const usuarioCliente = {
  idUsuario: 10,
  nombre: "Ana Cliente",
  documento: "123",
  telefono: "3001234567",
  direccion: "Calle 1",
  correo: "ana@pixel.test",
  estado: true,
  fechaCreacion: new Date("2026-01-01"),
  fechaActualizacion: new Date("2026-01-01"),
  rol: {
    idRol: 5,
    nombre: "Cliente",
    descripcion: null,
    estado: true,
  },
  cliente: {
    idCliente: 20,
    nombre: "Ana Cliente",
    correo: "ana@pixel.test",
    telefono: "3001234567",
    estado: true,
  },
};

test("UsuarioService actualiza perfil propio y sincroniza datos permitidos", async (t) => {
  t.mock.method(
    UsuarioRepository.prototype,
    "buscarPorId",
    async () => usuarioCliente,
  );
  t.mock.method(UsuarioRepository.prototype, "buscarPorCorreo", async () => null);
  const actualizarPerfilMock = t.mock.method(
    UsuarioRepository.prototype,
    "actualizarPerfilPropio",
    async (_idUsuario: number, dataUsuario: any) => ({
      ...usuarioCliente,
      ...dataUsuario,
    }),
  );

  const respuesta = await new UsuarioService().actualizarPerfilPropio(10, {
    nombre: " Ana Actualizada ",
    correo: "ANA.NUEVA@PIXEL.TEST",
    telefono: " 3009990000 ",
    estado: false,
    idRol: 1,
    contrasena: "NuevaPassword123",
  });
  const [idUsuario, dataUsuario, dataCliente] =
    actualizarPerfilMock.mock.calls[0]?.arguments ?? [];

  assert.ok(respuesta);
  assert.equal(idUsuario, 10);
  assert.deepEqual(dataUsuario, {
    nombre: "Ana Actualizada",
    telefono: "3009990000",
    correo: "ana.nueva@pixel.test",
  });
  assert.deepEqual(dataCliente, dataUsuario);
  assert.equal(respuesta.estado, true);
  assert.equal(respuesta.rol.idRol, 5);
});

test("UsuarioService bloquea correo duplicado al editar perfil propio", async (t) => {
  t.mock.method(
    UsuarioRepository.prototype,
    "buscarPorId",
    async () => usuarioCliente,
  );
  t.mock.method(UsuarioRepository.prototype, "buscarPorCorreo", async () => ({
    ...usuarioCliente,
    idUsuario: 99,
  }));

  await assert.rejects(
    () =>
      new UsuarioService().actualizarPerfilPropio(10, {
        correo: "otro@pixel.test",
      }),
    /correo debe ser Ãºnico/,
  );
});
