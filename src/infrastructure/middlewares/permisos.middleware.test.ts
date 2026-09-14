import test from "node:test";
import assert from "node:assert/strict";
import {
  autorizarAlgunPermiso,
  autorizarActualizacionUsuario,
  autorizarPermiso,
} from "./permisos.middleware";
import { PermisoService } from "../../applications/services/permiso.service";
import {
  CODIGO_PERMISO_COLA_PRODUCCION,
  PERMISOS_SISTEMA,
  PERMISOS_VALIDOS,
} from "../../utils/permisos";

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

test("catalogo incluye permisos del nuevo flujo de cotizaciones y tarifas", () => {
  for (const codigo of [
    "cotizaciones.propuesta.enviar",
    "cotizaciones.respuesta_cliente.registrar",
    "cotizaciones.versiones.ver",
    "cotizaciones.cliente.responder",
    "tarifas.tecnicas.ver",
    "tarifas.tecnicas.crear",
    "tarifas.tecnicas.editar",
    "tarifas.tecnicas.eliminar",
    "productos.descuentos.gestionar",
  ]) {
    assert.equal(PERMISOS_VALIDOS.has(codigo), true);
  }
});

test("catalogo contiene una sola entrada especifica para Cola de Produccion", () => {
  const permisosCola = PERMISOS_SISTEMA.filter(
    (permiso) => permiso.codigo === CODIGO_PERMISO_COLA_PRODUCCION,
  );
  const codigos = PERMISOS_SISTEMA.map((permiso) => permiso.codigo);

  assert.equal(permisosCola.length, 1);
  assert.deepEqual(permisosCola[0], {
    codigo: "disenos.produccion",
    modulo: "produccion",
    accion: "cola_ver",
    descripcion: "Consultar cola de producción",
  });
  assert.equal(new Set(codigos).size, codigos.length);
  assert.equal(PERMISOS_VALIDOS.has(CODIGO_PERMISO_COLA_PRODUCCION), true);
});

test("usuario con permiso puede consultar Cola de Produccion", async (t) => {
  const rolTienePermisoMock = t.mock.method(
    PermisoService.prototype,
    "rolTienePermiso",
    async (_idRol: number, codigo: string) =>
      codigo === CODIGO_PERMISO_COLA_PRODUCCION,
  );
  const req: any = { user: { idRol: 7, rol: "Disenador" } };
  const res = crearRespuesta();
  let llamado = false;

  await autorizarPermiso(CODIGO_PERMISO_COLA_PRODUCCION)(req, res, () => {
    llamado = true;
  });

  assert.equal(llamado, true);
  assert.deepEqual(rolTienePermisoMock.mock.calls[0]?.arguments, [
    7,
    CODIGO_PERMISO_COLA_PRODUCCION,
  ]);
});

test("usuario sin permiso recibe 403 al consultar Cola de Produccion", async (t) => {
  t.mock.method(PermisoService.prototype, "rolTienePermiso", async () => false);
  const req: any = { user: { idRol: 7, rol: "Disenador" } };
  const res = crearRespuesta();
  let llamado = false;

  await autorizarPermiso(CODIGO_PERMISO_COLA_PRODUCCION)(req, res, () => {
    llamado = true;
  });

  assert.equal(llamado, false);
  assert.equal(res.statusCode, 403);
});

test("Admin conserva bypass para consultar Cola de Produccion", async (t) => {
  const rolTienePermisoMock = t.mock.method(
    PermisoService.prototype,
    "rolTienePermiso",
    async () => false,
  );
  const req: any = { user: { idRol: 1, rol: "Admin" } };
  const res = crearRespuesta();
  let llamado = false;

  await autorizarPermiso(CODIGO_PERMISO_COLA_PRODUCCION)(req, res, () => {
    llamado = true;
  });

  assert.equal(llamado, true);
  assert.equal(rolTienePermisoMock.mock.callCount(), 0);
});

test("permisos de Disenos y acciones de Produccion permanecen independientes", () => {
  for (const codigo of [
    "disenos.ver",
    "disenos.crear",
    "disenos.editar",
    "disenos.aprobar",
    "disenos.eliminar",
    "pedidos.pasar_proceso",
    "pedidos.finalizar",
  ]) {
    assert.equal(PERMISOS_VALIDOS.has(codigo), true);
  }
  assert.notEqual(CODIGO_PERMISO_COLA_PRODUCCION, "pedidos.pasar_proceso");
  assert.notEqual(CODIGO_PERMISO_COLA_PRODUCCION, "pedidos.finalizar");
});

test("consulta de pedidos pendientes usa exactamente disenos.crear", async (t) => {
  const rolTienePermisoMock = t.mock.method(
    PermisoService.prototype,
    "rolTienePermiso",
    async (_idRol: number, codigo: string) => codigo === "disenos.crear",
  );
  const req: any = { user: { idRol: 7, rol: "Disenador" } };
  const res = crearRespuesta();
  let llamado = false;

  await autorizarPermiso("disenos.crear")(req, res, () => {
    llamado = true;
  });

  assert.equal(llamado, true);
  assert.deepEqual(rolTienePermisoMock.mock.calls[0]?.arguments, [
    7,
    "disenos.crear",
  ]);
});

test("consulta de pedidos pendientes rechaza con 403 sin disenos.crear", async (t) => {
  t.mock.method(PermisoService.prototype, "rolTienePermiso", async () => false);
  const req: any = { user: { idRol: 7, rol: "Disenador" } };
  const res = crearRespuesta();

  await autorizarPermiso("disenos.crear")(req, res, () => {
    throw new Error("No debe autorizar.");
  });

  assert.equal(res.statusCode, 403);
});

test("Admin accede a pedidos pendientes sin consultar RolPermiso", async (t) => {
  const rolTienePermisoMock = t.mock.method(
    PermisoService.prototype,
    "rolTienePermiso",
    async () => false,
  );
  const req: any = { user: { idRol: 1, rol: "Admin" } };
  const res = crearRespuesta();
  let llamado = false;

  await autorizarPermiso("disenos.crear")(req, res, () => {
    llamado = true;
  });

  assert.equal(llamado, true);
  assert.equal(rolTienePermisoMock.mock.callCount(), 0);
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

test("autorizarAlgunPermiso permite al Cliente consultar con su permiso especifico", async (t) => {
  const rolTienePermisoMock = t.mock.method(
    PermisoService.prototype,
    "rolTienePermiso",
    async (_idRol: number, codigo: string) =>
      codigo === "cotizaciones.cliente.ver",
  );
  const req: any = { user: { idRol: 5, rol: "Cliente" } };
  const res = crearRespuesta();
  let llamado = false;

  await autorizarAlgunPermiso(
    "cotizaciones.ver",
    "cotizaciones.cliente.ver",
  )(req, res, () => {
    llamado = true;
  });

  assert.equal(llamado, true);
  assert.equal(rolTienePermisoMock.mock.calls.length, 2);
});

test("autorizarActualizacionUsuario permite Cliente editar su propio perfil con perfil.editar", async (t) => {
  const rolTienePermisoMock = t.mock.method(
    PermisoService.prototype,
    "rolTienePermiso",
    async () => true,
  );
  const req: any = {
    params: { id: "10" },
    user: { idUsuario: 10, idRol: 5, rol: "Cliente" },
  };
  const res = crearRespuesta();
  let llamado = false;

  await autorizarActualizacionUsuario()(req, res, () => {
    llamado = true;
  });

  assert.equal(llamado, true);
  assert.deepEqual(rolTienePermisoMock.mock.calls[0]?.arguments, [
    5,
    "perfil.editar",
  ]);
});

test("autorizarActualizacionUsuario bloquea Cliente sin perfil.editar", async (t) => {
  t.mock.method(PermisoService.prototype, "rolTienePermiso", async () => false);
  const req: any = {
    params: { id: "10" },
    user: { idUsuario: 10, idRol: 5, rol: "Cliente" },
  };
  const res = crearRespuesta();
  let llamado = false;

  await autorizarActualizacionUsuario()(req, res, () => {
    llamado = true;
  });

  assert.equal(llamado, false);
  assert.equal(res.statusCode, 403);
  assert.deepEqual(res.payload, {
    message: "No tienes permisos para editar tu perfil.",
  });
});

test("autorizarActualizacionUsuario bloquea Cliente editando otro usuario", async (t) => {
  const rolTienePermisoMock = t.mock.method(
    PermisoService.prototype,
    "rolTienePermiso",
    async () => true,
  );
  const req: any = {
    params: { id: "99" },
    user: { idUsuario: 10, idRol: 5, rol: "Cliente" },
  };
  const res = crearRespuesta();
  let llamado = false;

  await autorizarActualizacionUsuario()(req, res, () => {
    llamado = true;
  });

  assert.equal(llamado, false);
  assert.equal(rolTienePermisoMock.mock.calls.length, 0);
  assert.equal(res.statusCode, 403);
  assert.deepEqual(res.payload, {
    message: "No tienes permisos para editar otros usuarios.",
  });
});

test("autorizarActualizacionUsuario mantiene usuarios.editar para empleados", async (t) => {
  const rolTienePermisoMock = t.mock.method(
    PermisoService.prototype,
    "rolTienePermiso",
    async () => true,
  );
  const req: any = {
    params: { id: "99" },
    user: { idUsuario: 20, idRol: 2, rol: "Vendedor" },
  };
  const res = crearRespuesta();
  let llamado = false;

  await autorizarActualizacionUsuario()(req, res, () => {
    llamado = true;
  });

  assert.equal(llamado, true);
  assert.deepEqual(rolTienePermisoMock.mock.calls[0]?.arguments, [
    2,
    "usuarios.editar",
  ]);
});
