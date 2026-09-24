import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import reporteRoutes from "./reporte.routes";
import { generarToken } from "../../utils/jwt.util";
import { UsuarioRepository } from "../repositories/usuario.repository";
import { PermisoService } from "../../applications/services/permiso.service";

const consultar = async (authorization?: string) => {
  const app = express();
  app.use("/api/reportes", reporteRoutes);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const direccion = server.address();
  if (!direccion || typeof direccion === "string") throw new Error("Puerto no disponible.");
  try {
    return await fetch(`http://127.0.0.1:${direccion.port}/api/reportes/ventas`, {
      headers: authorization ? { authorization } : {},
    });
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => error ? reject(error) : resolve()),
    );
  }
};

test("reportes exige JWT", async () => {
  const response = await consultar();
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { message: "Token no proporcionado." });
});

test("reportes responde 403 cuando el rol no posee el permiso del modulo", async (t) => {
  const secretoAnterior = process.env.JWT_SECRET;
  process.env.JWT_SECRET = "reporte-route-test-secret";
  try {
    t.mock.method(UsuarioRepository.prototype, "buscarUsuarioAuthPorId", async () => ({
      idUsuario: 7,
      correo: "vendedor@pixel.test",
      idRol: 2,
      estado: true,
      rol: { nombre: "Vendedor", estado: true },
      cliente: null,
    }));
    t.mock.method(PermisoService.prototype, "rolTienePermiso", async () => false);
    const token = generarToken({ idUsuario: 7 });
    const response = await consultar(`Bearer ${token}`);
    assert.equal(response.status, 403);
    assert.deepEqual(await response.json(), {
      message: "No tienes permisos para realizar esta accion.",
    });
  } finally {
    if (secretoAnterior === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = secretoAnterior;
  }
});

