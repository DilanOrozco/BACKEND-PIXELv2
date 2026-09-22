import assert from "node:assert/strict";
import test from "node:test";
import { UsuarioService } from "../../applications/services/usuario.service";
import { UsuarioController } from "./usuario.controller";

const respuesta = () => {
  const estado: any = {};
  const res: any = {
    status(codigo: number) { estado.status = codigo; return res; },
    json(body: any) { estado.body = body; return res; },
  };
  return { res, estado };
};

test("UsuarioController mantiene respuestas exitosas y perfil propio", async (t) => {
  const usuario = { idUsuario: 7 } as any;
  t.mock.method(UsuarioService.prototype, "crearUsuario", async () => usuario);
  t.mock.method(UsuarioService.prototype, "listarUsuarios", async () => ({ data: [usuario] }) as any);
  t.mock.method(UsuarioService.prototype, "buscarPorId", async () => usuario);
  t.mock.method(UsuarioService.prototype, "buscarParcial", async () => ({ data: [usuario] }) as any);
  const actualizar = t.mock.method(UsuarioService.prototype, "actualizarUsuario", async () => usuario);
  const perfil = t.mock.method(UsuarioService.prototype, "actualizarPerfilPropio", async () => usuario);
  t.mock.method(UsuarioService.prototype, "desactivarUsuario", async () => usuario);
  t.mock.method(UsuarioService.prototype, "eliminarUsuario", async () => usuario);
  const controller = new UsuarioController();
  const req: any = {
    body: { nombre: "Ana" },
    query: { termino: "Ana", idRol: "5" },
    params: { id: "7" },
    user: { idUsuario: 7, rol: "Cliente" },
  };

  for (const [metodo, codigo] of [
    ["crearUsuario", 201], ["listarUsuarios", 200], ["buscarUsuarioPorId", 200],
    ["buscarUsuarios", 200], ["actualizarUsuario", 200], ["desactivarUsuario", 200],
    ["eliminarUsuario", 200],
  ] as const) {
    const { res, estado } = respuesta();
    await (controller[metodo] as any)(req, res);
    assert.equal(estado.status, codigo);
  }
  assert.equal(perfil.mock.callCount(), 1);
  assert.equal(actualizar.mock.callCount(), 0);

  req.user = { idUsuario: 1, rol: "Admin" };
  const { res } = respuesta();
  await controller.actualizarUsuario(req, res);
  assert.equal(actualizar.mock.callCount(), 1);
});

test("UsuarioController conserva códigos de error", async (t) => {
  const fallo = async () => { throw new Error("usuario inválido"); };
  for (const metodo of [
    "crearUsuario", "listarUsuarios", "buscarPorId", "buscarParcial", "actualizarUsuario",
    "actualizarPerfilPropio", "desactivarUsuario", "eliminarUsuario",
  ] as const) {
    t.mock.method(UsuarioService.prototype, metodo, fallo as any);
  }
  const controller = new UsuarioController();
  const req: any = { body: {}, query: {}, params: { id: "x" }, user: { idUsuario: 1, rol: "Admin" } };

  for (const [metodo, codigo] of [
    ["crearUsuario", 400], ["listarUsuarios", 404], ["buscarUsuarioPorId", 404],
    ["buscarUsuarios", 404], ["actualizarUsuario", 400], ["desactivarUsuario", 400],
    ["eliminarUsuario", 400],
  ] as const) {
    const { res, estado } = respuesta();
    await (controller[metodo] as any)(req, res);
    assert.equal(estado.status, codigo);
    assert.equal(estado.body.message, "usuario inválido");
  }
});
