let server;
let base = process.env.API_BASE_URL;

if (process.env.START_LOCAL_APP === "1") {
  const { default: app } = await import("../src/interface/server.ts");

  server = await new Promise((resolve) => {
    const listener = app.listen(0, () => resolve(listener));
  });

  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 3000;
  base = `http://127.0.0.1:${port}/api`;
}

base ??= "http://localhost:3000/api";
const suffix = `${Date.now()}`;
const results = [];
const ids = {};
const tokens = {};

const roundMs = (value) => Math.round(value * 10) / 10;

const noteFrom = (json) => {
  if (!json) {
    return "";
  }

  if (json.message) {
    return String(json.message).slice(0, 1000);
  }

  if (Array.isArray(json.data)) {
    return `items=${json.data.length}`;
  }

  if (json.data && typeof json.data === "object") {
    return Object.keys(json.data).slice(0, 8).join(",");
  }

  return "";
};

const idOf = (item, keys) => {
  for (const key of keys) {
    if (item?.[key] !== undefined) {
      return item[key];
    }
  }

  return undefined;
};

const firstId = (items, keys) => idOf(Array.isArray(items) ? items[0] : undefined, keys);

const api = async (
  name,
  method,
  path,
  { token, body, expect = [200, 201], query } = {},
) => {
  const url = new URL(base + path);

  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    }
  }

  const headers = { "Content-Type": "application/json" };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const init = { method, headers };

  if (body !== undefined) {
    init.body = JSON.stringify(body);
  }

  const startedAt = performance.now();
  let status = 0;
  let json = null;

  try {
    const response = await fetch(url, init);
    status = response.status;
    const text = await response.text();

    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = { raw: text };
    }
  } catch (error) {
    json = { message: error instanceof Error ? error.message : String(error) };
  }

  const durationMs = roundMs(performance.now() - startedAt);
  const ok = expect.includes(status);

  results.push({
    name,
    method,
    path: `${url.pathname}${url.search}`,
    status,
    durationMs,
    ok,
    note: noteFrom(json),
  });

  return {
    status,
    json,
    data: json?.data,
    durationMs,
    ok,
  };
};

const main = async () => {
  let response = await api("Auth login admin", "POST", "/auth/login", {
    body: { correo: "admin@pixel.com", contrasena: "admin123" },
  });
  tokens.admin = response.data?.token;
  ids.adminUser = response.data?.usuario?.idUsuario;

  response = await api("Auth login secretaria", "POST", "/auth/login", {
    body: { correo: "ana.gomez@gmail.com", contrasena: "secret123" },
  });
  tokens.secretaria = response.data?.token;

  response = await api("Auth login cliente existente", "POST", "/auth/login", {
    body: { correo: "juan.cliente@gmail.com", contrasena: "123456" },
  });
  tokens.cliente = response.data?.token;
  ids.cliente = response.data?.usuario?.idUsuario;

  response = await api("Auth login disenador", "POST", "/auth/login", {
    body: { correo: "luis.martinez@gmail.com", contrasena: "diseno123" },
  });
  tokens.disenador = response.data?.token;
  ids.disenador = response.data?.usuario?.idUsuario;

  response = await api("Auth register cliente temporal", "POST", "/auth/register", {
    body: {
      nombre: `QA Register ${suffix}`,
      telefono: "3000000000",
      correo: `qa.register.${suffix}@pixel.test`,
      contrasena: "qa123456",
    },
  });
  ids.registeredUser = idOf(response.data, ["idUsuario", "id"]);

  const roleName = `QA_ROL_${suffix}`;
  response = await api("Roles crear", "POST", "/roles", {
    body: { nombre: roleName, descripcion: "Rol temporal QA" },
  });
  ids.role = idOf(response.data, ["idRol", "id"]);

  response = await api("Roles listar", "GET", "/roles");
  const roles = response.data ?? [];
  ids.clienteRole =
    roles.find((item) => String(item.nombre).toLowerCase().includes("cliente"))?.idRol ??
    firstId(roles, ["idRol", "id"]);

  await api("Roles buscar", "GET", "/roles/buscar", {
    query: { nombre: roleName },
  });
  await api("Roles actualizar", "PATCH", `/roles/${ids.role}`, {
    body: { descripcion: "Rol temporal QA actualizado" },
  });
  await api("Roles desactivar", "DELETE", `/roles/${ids.role}`);
  await api("Roles eliminar fisico", "DELETE", `/roles/${ids.role}/eliminar`);

  response = await api("Usuarios crear", "POST", "/usuarios", {
    body: {
      idRol: ids.clienteRole,
      nombre: `QA Usuario ${suffix}`,
      documento: `QA${suffix}`.slice(0, 30),
      telefono: "3001111111",
      direccion: "Calle QA 123",
      correo: `qa.usuario.${suffix}@pixel.test`,
      contrasena: "qa123456",
    },
  });
  ids.user = idOf(response.data, ["idUsuario", "id"]);

  await api("Usuarios listar", "GET", "/usuarios");
  await api("Usuarios buscar", "GET", "/usuarios/buscar", {
    query: { termino: "QA Usuario" },
  });
  await api("Usuarios buscar por id", "GET", `/usuarios/${ids.user}`);
  await api("Usuarios actualizar", "PATCH", `/usuarios/${ids.user}`, {
    body: { telefono: "3002222222", direccion: "Calle QA actualizada" },
  });
  await api("Usuarios desactivar", "DELETE", `/usuarios/${ids.user}`);
  await api("Usuarios eliminar fisico", "DELETE", `/usuarios/${ids.user}/eliminar`);

  if (ids.registeredUser) {
    await api(
      "Usuarios eliminar cliente register temporal",
      "DELETE",
      `/usuarios/${ids.registeredUser}/eliminar`,
      { expect: [200, 400] },
    );
  }

  response = await api("Tecnicas crear flujo", "POST", "/tecnicas", {
    token: tokens.admin,
    body: {
      nombre: `QA Tecnica ${suffix}`,
      descripcion: "Tecnica temporal para pruebas QA",
    },
  });
  ids.tecnica = idOf(response.data, ["idTecnica", "id"]);

  await api("Tecnicas listar", "GET", "/tecnicas", { token: tokens.admin });
  await api("Tecnicas buscar", "GET", "/tecnicas/buscar", {
    token: tokens.admin,
    query: { termino: "QA Tecnica" },
  });
  await api("Tecnicas buscar por id", "GET", `/tecnicas/${ids.tecnica}`, {
    token: tokens.admin,
  });
  await api("Tecnicas actualizar", "PATCH", `/tecnicas/${ids.tecnica}`, {
    token: tokens.admin,
    body: { descripcion: "Tecnica temporal QA actualizada" },
  });

  response = await api("Tecnicas crear delete", "POST", "/tecnicas", {
    token: tokens.admin,
    body: {
      nombre: `QA Tecnica Delete ${suffix}`,
      descripcion: "Tecnica temporal para borrar",
    },
  });
  ids.tecnicaDelete = idOf(response.data, ["idTecnica", "id"]);
  await api("Tecnicas desactivar", "DELETE", `/tecnicas/${ids.tecnicaDelete}`, {
    token: tokens.admin,
  });
  await api(
    "Tecnicas eliminar fisico",
    "DELETE",
    `/tecnicas/${ids.tecnicaDelete}/eliminar`,
    { token: tokens.admin },
  );

  response = await api("Proveedores crear flujo", "POST", "/proveedores", {
    token: tokens.admin,
    body: {
      nombre: `QA Proveedor ${suffix}`,
      telefono: "3010000000",
      correo: `qa.proveedor.${suffix}@pixel.test`,
      direccion: "Bodega QA",
    },
  });
  ids.proveedor = idOf(response.data, ["idProveedor", "id"]);

  await api("Proveedores listar", "GET", "/proveedores", { token: tokens.admin });
  await api("Proveedores buscar", "GET", "/proveedores/buscar", {
    token: tokens.admin,
    query: { termino: "QA Proveedor" },
  });
  await api("Proveedores buscar por id", "GET", `/proveedores/${ids.proveedor}`, {
    token: tokens.admin,
  });
  await api("Proveedores actualizar", "PATCH", `/proveedores/${ids.proveedor}`, {
    token: tokens.admin,
    body: { telefono: "3020000000", direccion: "Bodega QA actualizada" },
  });

  response = await api("Proveedores crear delete", "POST", "/proveedores", {
    token: tokens.admin,
    body: { nombre: `QA Proveedor Delete ${suffix}`, telefono: "3030000000" },
  });
  ids.proveedorDelete = idOf(response.data, ["idProveedor", "id"]);
  await api("Proveedores desactivar", "DELETE", `/proveedores/${ids.proveedorDelete}`, {
    token: tokens.admin,
  });
  await api(
    "Proveedores eliminar fisico",
    "DELETE",
    `/proveedores/${ids.proveedorDelete}/eliminar`,
    { token: tokens.admin },
  );

  response = await api("Cotizaciones cliente crear solicitud", "POST", "/cotizaciones/cliente", {
    token: tokens.cliente,
    body: {
      observaciones: "QA solicitud cliente",
      detalles: [
        {
          idTecnica: ids.tecnica,
          descripcion: "QA camiseta cliente",
          cantidad: 1,
          imagenReferencia: "https://example.com/qa.png",
          observaciones: "QA detalle cliente",
        },
      ],
    },
  });
  ids.cotCliente = idOf(response.data, ["idCotizacion", "id"]);
  ids.detalleCotCliente = response.data?.detalles?.[0]?.idDetalleCotizacion;

  await api(
    "Cotizaciones cliente editar solicitud",
    "PATCH",
    `/cotizaciones/${ids.cotCliente}/cliente`,
    {
      token: tokens.cliente,
      body: {
        observaciones: "QA solicitud cliente editada",
        detalles: [
          {
            idDetalleCotizacion: ids.detalleCotCliente,
            idTecnica: ids.tecnica,
            descripcion: "QA camiseta cliente editada",
            cantidad: 2,
            imagenReferencia: "https://example.com/qa2.png",
            observaciones: "QA detalle editado",
          },
        ],
      },
    },
  );
  await api("Cotizaciones anular solicitud", "PATCH", `/cotizaciones/${ids.cotCliente}/anular`, {
    token: tokens.cliente,
  });

  response = await api("Cotizaciones crear presencial", "POST", "/cotizaciones", {
    token: tokens.admin,
    body: {
      idCliente: ids.cliente,
      observaciones: "QA cotizacion presencial",
      detalles: [
        {
          idTecnica: ids.tecnica,
          descripcion: "QA pedido flujo integral",
          cantidad: 10,
          imagenReferencia: "https://example.com/qa-flow.png",
          observaciones: "QA detalle flujo",
        },
      ],
    },
  });
  ids.cotMain = idOf(response.data, ["idCotizacion", "id"]);
  ids.detalleCotMain = response.data?.detalles?.[0]?.idDetalleCotizacion;

  await api("Cotizaciones listar", "GET", "/cotizaciones", { token: tokens.admin });
  await api("Cotizaciones buscar", "GET", "/cotizaciones/buscar", {
    token: tokens.admin,
    query: { termino: "pendiente" },
  });
  await api("Cotizaciones buscar por id", "GET", `/cotizaciones/${ids.cotMain}`, {
    token: tokens.admin,
  });
  await api("Cotizaciones cotizar", "PATCH", `/cotizaciones/${ids.cotMain}/cotizar`, {
    token: tokens.admin,
    body: {
      costosAdicionales: 0,
      observaciones: "QA precios asignados",
      detalles: [
        {
          idDetalleCotizacion: ids.detalleCotMain,
          precioUnitario: 10000,
          costoDiseno: 10000,
          observaciones: "QA precio detalle",
        },
      ],
    },
  });
  await api("Cotizaciones actualizar", "PATCH", `/cotizaciones/${ids.cotMain}`, {
    token: tokens.admin,
    body: { observaciones: "QA cotizacion ajustada", costosAdicionales: 5000 },
  });
  response = await api(
    "Cotizaciones aprobar y crear pedido",
    "PATCH",
    `/cotizaciones/${ids.cotMain}/aprobar`,
    { token: tokens.admin },
  );
  ids.pedido = response.data?.pedido?.idPedido;

  response = await api("Cotizaciones crear para DELETE", "POST", "/cotizaciones", {
    token: tokens.admin,
    body: {
      idCliente: ids.cliente,
      observaciones: "QA cotizacion delete",
      detalles: [{ idTecnica: ids.tecnica, descripcion: "QA delete cotizacion", cantidad: 1 }],
    },
  });
  ids.cotDelete = idOf(response.data, ["idCotizacion", "id"]);
  await api("Cotizaciones eliminar DELETE", "DELETE", `/cotizaciones/${ids.cotDelete}`, {
    token: tokens.admin,
  });

  response = await api("Cotizaciones crear para DELETE eliminar", "POST", "/cotizaciones", {
    token: tokens.admin,
    body: {
      idCliente: ids.cliente,
      observaciones: "QA cotizacion delete eliminar",
      detalles: [
        { idTecnica: ids.tecnica, descripcion: "QA delete cotizacion eliminar", cantidad: 1 },
      ],
    },
  });
  ids.cotDeleteEliminar = idOf(response.data, ["idCotizacion", "id"]);
  await api("Cotizaciones eliminar fisico", "DELETE", `/cotizaciones/${ids.cotDeleteEliminar}/eliminar`, {
    token: tokens.admin,
  });

  await api("Pedidos crear desde cotizacion duplicada", "POST", "/pedidos", {
    token: tokens.admin,
    body: {
      idCotizacion: ids.cotMain,
      fechaEntregaEstimada: "2026-07-15",
      observaciones: "QA pedido duplicado esperado",
    },
    expect: [400],
  });
  await api("Pedidos listar", "GET", "/pedidos", { token: tokens.admin });
  await api("Pedidos buscar", "GET", "/pedidos/buscar", {
    token: tokens.admin,
    query: { termino: String(ids.pedido) },
  });
  await api("Pedidos buscar por id", "GET", `/pedidos/${ids.pedido}`, {
    token: tokens.admin,
  });
  await api("Pedidos actualizar", "PATCH", `/pedidos/${ids.pedido}`, {
    token: tokens.admin,
    body: { fechaEntregaEstimada: "2026-07-20", observaciones: "QA fecha estimada" },
  });
  await api("Pedidos anular deshabilitado", "PATCH", `/pedidos/${ids.pedido}/anular`, {
    token: tokens.admin,
    body: { observaciones: "QA anular" },
    expect: [400],
  });

  response = await api("Abonos crear confirmado inicial", "POST", "/abonos", {
    token: tokens.admin,
    body: {
      idPedido: ids.pedido,
      monto: 60000,
      metodoPago: "TRANSFERENCIA",
      referencia: `QA-${suffix}-INI`,
      comprobanteUrl: "https://example.com/comprobante.png",
      confirmar: true,
    },
  });
  ids.abonoInicial = idOf(response.data, ["idAbono", "id"]);

  response = await api("Abonos crear pendiente update", "POST", "/abonos", {
    token: tokens.admin,
    body: {
      idPedido: ids.pedido,
      monto: 5000,
      metodoPago: "EFECTIVO",
      referencia: `QA-${suffix}-UPD`,
    },
  });
  ids.abonoUpdate = idOf(response.data, ["idAbono", "id"]);

  await api("Abonos listar", "GET", "/abonos", {
    token: tokens.admin,
    query: { idPedido: ids.pedido },
  });
  await api("Abonos listar por pedido", "GET", `/pedidos/${ids.pedido}/abonos`, {
    token: tokens.admin,
  });
  await api("Abonos buscar por id", "GET", `/abonos/${ids.abonoUpdate}`, {
    token: tokens.admin,
  });
  await api("Abonos actualizar pendiente", "PATCH", `/abonos/${ids.abonoUpdate}`, {
    token: tokens.admin,
    body: { monto: 6000, referencia: `QA-${suffix}-UPD2` },
  });
  await api("Abonos confirmar pendiente", "PATCH", `/abonos/${ids.abonoUpdate}/confirmar`, {
    token: tokens.admin,
    body: { referencia: `QA-${suffix}-CONF` },
  });

  response = await api("Abonos crear pendiente rechazar", "POST", "/abonos", {
    token: tokens.admin,
    body: {
      idPedido: ids.pedido,
      monto: 1000,
      metodoPago: "EFECTIVO",
      referencia: `QA-${suffix}-REJ`,
    },
  });
  ids.abonoReject = idOf(response.data, ["idAbono", "id"]);
  await api("Abonos rechazar pendiente", "PATCH", `/abonos/${ids.abonoReject}/rechazar`, {
    token: tokens.admin,
    body: { motivoRechazo: "QA rechazo controlado" },
  });

  response = await api("Abonos crear pendiente eliminar", "POST", "/abonos", {
    token: tokens.admin,
    body: {
      idPedido: ids.pedido,
      monto: 1000,
      metodoPago: "EFECTIVO",
      referencia: `QA-${suffix}-DEL`,
    },
  });
  ids.abonoDelete = idOf(response.data, ["idAbono", "id"]);
  await api("Abonos eliminar pendiente", "DELETE", `/abonos/${ids.abonoDelete}`, {
    token: tokens.admin,
  });

  response = await api("Disenos crear eliminar", "POST", "/disenos", {
    token: tokens.admin,
    body: {
      idPedido: ids.pedido,
      archivoUrl: "https://example.com/diseno-delete.png",
      descripcion: "QA diseno delete",
      observaciones: "QA",
    },
  });
  ids.disenoDelete = idOf(response.data, ["idDiseno", "id"]);
  await api("Disenos eliminar no aprobado", "DELETE", `/disenos/${ids.disenoDelete}`, {
    token: tokens.admin,
  });

  response = await api("Disenos crear flujo", "POST", "/disenos", {
    token: tokens.admin,
    body: {
      idPedido: ids.pedido,
      archivoUrl: "https://example.com/diseno.png",
      descripcion: "QA diseno flujo",
      observaciones: "QA diseno enviado",
    },
  });
  ids.diseno = idOf(response.data, ["idDiseno", "id"]);

  await api("Disenos listar", "GET", "/disenos", {
    token: tokens.admin,
    query: { idPedido: ids.pedido },
  });
  await api("Disenos listar por pedido", "GET", `/pedidos/${ids.pedido}/disenos`, {
    token: tokens.admin,
  });
  await api("Disenos buscar por id", "GET", `/disenos/${ids.diseno}`, {
    token: tokens.admin,
  });
  await api("Disenos actualizar", "PATCH", `/disenos/${ids.diseno}`, {
    token: tokens.admin,
    body: { descripcion: "QA diseno actualizado", observaciones: "QA ajuste" },
  });
  await api("Disenos aprobar", "PATCH", `/disenos/${ids.diseno}/aprobar`, {
    token: tokens.admin,
    body: { observaciones: "QA aprobado" },
  });
  await api("Disenos produccion pendientes", "GET", "/disenos/produccion/pendientes", {
    token: tokens.admin,
  });

  await api("Pedidos en proceso ya aplicado", "PATCH", `/pedidos/${ids.pedido}/en-proceso`, {
    token: tokens.admin,
    body: { observaciones: "QA verificar en proceso" },
    expect: [400],
  });

  response = await api("Compras crear flujo", "POST", "/compras", {
    token: tokens.admin,
    body: {
      idPedido: ids.pedido,
      idProveedor: ids.proveedor,
      observaciones: "QA compra flujo",
      confirmar: false,
      detalles: [{ descripcionInsumo: "QA insumo principal", cantidad: 2, costoUnitario: 15000 }],
    },
  });
  ids.compra = idOf(response.data, ["idCompra", "id"]);

  await api("Compras listar", "GET", "/compras", {
    token: tokens.admin,
    query: { idPedido: ids.pedido },
  });
  await api("Compras resumen", "GET", "/compras/resumen", {
    token: tokens.admin,
    query: { idPedido: ids.pedido },
  });
  await api("Compras listar por pedido", "GET", `/pedidos/${ids.pedido}/compras`, {
    token: tokens.admin,
  });
  await api("Compras buscar por id", "GET", `/compras/${ids.compra}`, {
    token: tokens.admin,
  });
  await api("Compras actualizar", "PATCH", `/compras/${ids.compra}`, {
    token: tokens.admin,
    body: {
      observaciones: "QA compra actualizada",
      detalles: [{ descripcionInsumo: "QA insumo actualizado", cantidad: 3, costoUnitario: 12000 }],
    },
  });
  await api("Compras confirmar", "PATCH", `/compras/${ids.compra}/confirmar`, {
    token: tokens.admin,
  });

  response = await api("Compras crear anular", "POST", "/compras", {
    token: tokens.admin,
    body: {
      idPedido: ids.pedido,
      idProveedor: ids.proveedor,
      observaciones: "QA compra anular",
      confirmar: false,
      detalles: [{ descripcionInsumo: "QA insumo anular", cantidad: 1, costoUnitario: 5000 }],
    },
  });
  ids.compraAnular = idOf(response.data, ["idCompra", "id"]);
  await api("Compras anular", "PATCH", `/compras/${ids.compraAnular}/anular`, {
    token: tokens.admin,
    body: { observaciones: "QA anular compra" },
  });

  response = await api("Compras crear eliminar", "POST", "/compras", {
    token: tokens.admin,
    body: {
      idPedido: ids.pedido,
      idProveedor: ids.proveedor,
      observaciones: "QA compra eliminar",
      confirmar: false,
      detalles: [{ descripcionInsumo: "QA insumo eliminar", cantidad: 1, costoUnitario: 5000 }],
    },
  });
  ids.compraDelete = idOf(response.data, ["idCompra", "id"]);
  await api("Compras eliminar", "DELETE", `/compras/${ids.compraDelete}`, {
    token: tokens.admin,
  });

  await api("Dashboard admin", "GET", "/dashboard/admin", { token: tokens.admin });
  await api("Dashboard cliente", "GET", "/dashboard/cliente", { token: tokens.cliente });

  await api("Pedidos finalizar", "PATCH", `/pedidos/${ids.pedido}/finalizar`, {
    token: tokens.admin,
    body: { fechaEntregado: "2026-07-25", observaciones: "QA produccion finalizada" },
  });
  await api("Ventas listar", "GET", "/ventas", { token: tokens.admin });
  await api("Ventas buscar", "GET", "/ventas/buscar", {
    token: tokens.admin,
    query: { termino: String(ids.pedido) },
  });
  await api("Ventas resumen", "GET", "/ventas/resumen", { token: tokens.admin });
  await api("Ventas resumen periodo", "GET", "/ventas/resumen-periodo", {
    token: tokens.admin,
    query: { fechaInicio: "2026-01-01", fechaFin: "2026-12-31" },
  });

  const failed = results.filter((item) => !item.ok);
  const slowest = [...results]
    .sort((left, right) => right.durationMs - left.durationMs)
    .slice(0, 12);
  const byStatus = results.reduce((acc, item) => {
    acc[item.status] = (acc[item.status] ?? 0) + 1;
    return acc;
  }, {});

  console.log(JSON.stringify({
    suffix,
    base,
    total: results.length,
    failed: failed.length,
    byStatus,
    ids,
    slowest,
    failedItems: failed,
    results,
  }, null, 2));
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  if (server) {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});
