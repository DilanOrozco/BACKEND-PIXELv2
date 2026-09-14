import test from "node:test";
import assert from "node:assert/strict";
import { autorizarRoles } from "./roles.middleware";

const crearRespuesta = () => {
  const respuesta: any = {
    statusCode: 200,
    payload: undefined,
    status(codigo: number) {
      this.statusCode = codigo;
      return this;
    },
    json(payload: unknown) {
      this.payload = payload;
      return this;
    },
  };

  return respuesta;
};

test("autorizarRoles permite Admin como bypass compatible con permisos", () => {
  const req: any = { user: { rol: "Admin" } };
  const res = crearRespuesta();
  let llamado = false;

  autorizarRoles("Cliente")(req, res, () => {
    llamado = true;
  });

  assert.equal(llamado, true);
  assert.equal(res.statusCode, 200);
});

test("autorizarRoles bloquea roles no permitidos", () => {
  const req: any = { user: { rol: "Secretaria" } };
  const res = crearRespuesta();
  let llamado = false;

  autorizarRoles("Cliente")(req, res, () => {
    llamado = true;
  });

  assert.equal(llamado, false);
  assert.equal(res.statusCode, 403);
  assert.deepEqual(res.payload, {
    message: "No tienes permisos para realizar esta accion.",
  });
});

test("autorizarRoles requiere usuario autenticado", () => {
  const req: any = {};
  const res = crearRespuesta();
  let llamado = false;

  autorizarRoles("Cliente")(req, res, () => {
    llamado = true;
  });

  assert.equal(llamado, false);
  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.payload, {
    message: "Usuario no autenticado.",
  });
});
