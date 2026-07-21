import test from "node:test";
import assert from "node:assert/strict";
import { autorizarPermiso } from "./permisos.middleware";
import { PermisoService } from "../../applications/services/permiso.service";
import { PERMISOS_VALIDOS } from "../../utils/permisos";

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

test("catalogo incluye permisos de categorias_producto", () => {
  assert.equal(PERMISOS_VALIDOS.has("categorias_producto.ver"), true);
  assert.equal(PERMISOS_VALIDOS.has("categorias_producto.crear"), true);
  assert.equal(PERMISOS_VALIDOS.has("categorias_producto.editar"), true);
  assert.equal(PERMISOS_VALIDOS.has("categorias_producto.desactivar"), true);
  assert.equal(PERMISOS_VALIDOS.has("categorias_producto.eliminar"), true);
  assert.equal(PERMISOS_VALIDOS.has("disenos.cliente.aprobar"), true);
  assert.equal(PERMISOS_VALIDOS.has("disenos.cliente.rechazar"), true);
  assert.equal(PERMISOS_VALIDOS.has("disenos.aprobar_cliente"), true);
  assert.equal(PERMISOS_VALIDOS.has("disenos.rechazar_cliente"), true);
});

test("autorizarPermiso permite Admin por bypass sin consultar permisos", async (t) => {
  const rolTienePermisoMock = t.mock.method(
    PermisoService.prototype,
    "rolTienePermiso",
    async () => false,
  );
  const req: any = { user: { idRol: 1, rol: "Admin" } };
  const res = crearRespuesta();
  let llamado = false;

  await autorizarPermiso("categorias_producto.ver")(req, res, () => {
    llamado = true;
  });

  assert.equal(llamado, true);
  assert.equal(rolTienePermisoMock.mock.calls.length, 0);
});

test("autorizarPermiso exige permiso real para roles no Admin", async (t) => {
  const rolTienePermisoMock = t.mock.method(
    PermisoService.prototype,
    "rolTienePermiso",
    async () => true,
  );
  const req: any = { user: { idRol: 2, rol: "Vendedor" } };
  const res = crearRespuesta();
  let llamado = false;

  await autorizarPermiso("categorias_producto.crear")(req, res, () => {
    llamado = true;
  });

  assert.equal(llamado, true);
  assert.deepEqual(rolTienePermisoMock.mock.calls[0]?.arguments, [
    2,
    "categorias_producto.crear",
  ]);
});

test("autorizarPermiso bloquea rol sin permiso", async (t) => {
  t.mock.method(PermisoService.prototype, "rolTienePermiso", async () => false);
  const req: any = { user: { idRol: 2, rol: "Vendedor" } };
  const res = crearRespuesta();
  let llamado = false;

  await autorizarPermiso("categorias_producto.eliminar")(req, res, () => {
    llamado = true;
  });

  assert.equal(llamado, false);
  assert.equal(res.statusCode, 403);
  assert.deepEqual(res.payload, {
    message: "No tienes permisos para realizar esta accion.",
  });
});
