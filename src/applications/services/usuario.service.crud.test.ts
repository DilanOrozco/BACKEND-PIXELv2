import assert from "node:assert/strict";
import test from "node:test";
import { RolRepository } from "../../infrastructure/repositories/rol.repository";
import { UsuarioRepository } from "../../infrastructure/repositories/usuario.repository";
import { UsuarioService } from "./usuario.service";

const usuario = {
  idUsuario: 10,
  nombre: "Ana Cliente",
  documento: "123",
  telefono: "3001234567",
  direccion: "Calle 1",
  correo: "ana@pixel.test",
  estado: true,
  fechaCreacion: new Date("2026-01-01"),
  fechaActualizacion: new Date("2026-01-01"),
  rol: { idRol: 5, nombre: "Cliente", descripcion: null, estado: true },
  cliente: null,
};

const entradaUsuario = {
  nombre: " Ana ",
  documento: " 123 ",
  telefono: " 3001234567 ",
  direccion: " Calle 1 ",
  correo: "ANA@PIXEL.TEST",
  contrasena: "Password123",
  idRol: "2",
};

test("UsuarioService crea usuario normalizado y valida relaciones únicas", async (t) => {
  let rol: any = { idRol: 2, nombre: "Secretaria" };
  let correoExistente: any = null;
  let documentoExistente: any = null;
  t.mock.method(RolRepository.prototype, "buscarPorId", async () => rol);
  t.mock.method(UsuarioRepository.prototype, "buscarPorCorreo", async () => correoExistente);
  t.mock.method(UsuarioRepository.prototype, "buscarPorDocumento", async () => documentoExistente);
  const crear = t.mock.method(
    UsuarioRepository.prototype,
    "crearUsuario",
    async (data: any) => ({ idUsuario: 11, ...data }) as any,
  );
  const service = new UsuarioService();
  const resultado = await service.crearUsuario(entradaUsuario);
  const data = crear.mock.calls[0]?.arguments[0] as any;

  assert.equal(data.nombre, "Ana");
  assert.equal(data.documento, "123");
  assert.equal(data.correo, "ana@pixel.test");
  assert.equal(data.idRol, 2);
  assert.notEqual(data.contrasenaHash, "Password123");
  assert.equal(resultado.idUsuario, 11);

  rol = null;
  await assert.rejects(() => service.crearUsuario(entradaUsuario), /rol debe existir/i);
  rol = { idRol: 2 };
  correoExistente = usuario;
  await assert.rejects(() => service.crearUsuario(entradaUsuario), /correo debe ser único/i);
  correoExistente = null;
  documentoExistente = usuario;
  await assert.rejects(
    () => service.crearUsuario({ ...entradaUsuario, correo: "otra@pixel.test" }),
    /documento ya esta registrado/i,
  );
});

test("UsuarioService lista y busca con y sin paginación", async (t) => {
  const listar = t.mock.method(
    UsuarioRepository.prototype,
    "listarUsuarios",
    async () => [usuario] as any,
  );
  const listarPaginado = t.mock.method(
    UsuarioRepository.prototype,
    "listarUsuariosPaginado",
    async () => ({ data: [usuario], total: 1 }) as any,
  );
  const service = new UsuarioService();

  assert.deepEqual(await service.listarUsuarios({ idRol: "5" }), { data: [usuario] });
  assert.deepEqual(listar.mock.calls[0]?.arguments[0], { idRol: 5 });
  assert.equal((await service.listarUsuarios({ page: "1", limit: "5" })).meta.total, 1);
  assert.equal(listarPaginado.mock.callCount(), 1);

  assert.equal((await service.buscarParcial(" Ana ", 5)).meta.total, 1);
  assert.equal(
    (await service.buscarParcial("Ana", 5, { page: "1", limit: "5" })).meta.total,
    1,
  );
  await assert.rejects(() => service.buscarParcial(" "), /termino de busqueda/i);
});

test("UsuarioService consulta, actualiza, desactiva y elimina", async (t) => {
  let encontrado: any = usuario;
  t.mock.method(UsuarioRepository.prototype, "buscarPorId", async () => encontrado);
  t.mock.method(UsuarioRepository.prototype, "buscarPorCorreo", async () => null);
  t.mock.method(UsuarioRepository.prototype, "buscarPorDocumento", async () => null);
  t.mock.method(RolRepository.prototype, "buscarPorId", async () => ({ idRol: 2 }) as any);
  const actualizar = t.mock.method(
    UsuarioRepository.prototype,
    "actualizarUsuario",
    async (_id: number, data: any) => ({ ...usuario, ...data }) as any,
  );
  const desactivar = t.mock.method(
    UsuarioRepository.prototype,
    "desactivarUsuario",
    async () => ({ ...usuario, estado: false }) as any,
  );
  const eliminar = t.mock.method(
    UsuarioRepository.prototype,
    "eliminarUsuario",
    async () => usuario as any,
  );
  const service = new UsuarioService();

  assert.equal((await service.buscarPorId(10)).idUsuario, 10);
  await service.actualizarUsuario(10, {
    nombre: " Ana Editada ",
    documento: " 456 ",
    correo: "NUEVA@PIXEL.TEST",
    telefono: " ",
    direccion: null,
    contrasena: "Password456",
    estado: false,
    idRol: 2,
  });
  const data = actualizar.mock.calls[0]?.arguments[1] as any;
  assert.equal(data.nombre, "Ana Editada");
  assert.equal(data.documento, "456");
  assert.equal(data.correo, "nueva@pixel.test");
  assert.equal(data.telefono, null);
  assert.equal(data.idRol, 2);
  assert.ok(data.contrasenaHash);

  await service.desactivarUsuario(10);
  await service.eliminarUsuario(10);
  assert.equal(desactivar.mock.callCount(), 1);
  assert.equal(eliminar.mock.callCount(), 1);

  encontrado = null;
  await assert.rejects(() => service.buscarPorId(10), /no existe/i);
  await assert.rejects(() => service.actualizarUsuario(10, { nombre: "Ana" }), /no existe/i);
  await assert.rejects(() => service.desactivarUsuario(10), /no existe/i);
  await assert.rejects(() => service.eliminarUsuario(10), /no existe/i);
  await assert.rejects(() => service.buscarPorId(Number.NaN), /id del usuario/i);
});
