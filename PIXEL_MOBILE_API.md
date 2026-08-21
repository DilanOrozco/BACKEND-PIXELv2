# PIXEL Mobile - API de Consulta

## 1. Objetivo

Inventario verificado de las rutas Express disponibles para una primera aplicacion movil administrativa de solo lectura. Mobile no debe crear, editar, eliminar, aprobar, rechazar ni cambiar estados.

Este documento se obtuvo de `src/interface/server.ts`, los routers registrados, sus middlewares, controllers, services, repositories y selects Prisma. Fecha de revision: 20 de agosto de 2026.

**Resumen:** 51 endpoints GET administrativos protegidos, 6 GET exclusivos del portal Cliente y 4 GET publicos.

## 2. URL base

- Desarrollo actual: `http://localhost:3000/api` (el puerto usa `PORT` y su valor por defecto es `3000`).
- Mobile debe recibir la URL del entorno por configuracion. No debe fijar `localhost` en una compilacion distribuida.
- Todas las rutas administrativas de este documento parten de `/api`.

## 3. Autenticacion

### Iniciar sesion

**Metodo y ruta:** `POST /api/auth/login`

**Autenticacion:** publica.

**Body obligatorio:**

```json
{
  "correo": "admin@pixel.com",
  "contrasena": "********"
}
```

**Respuesta resumida real:**

```json
{
  "message": "Inicio de sesion exitoso.",
  "data": {
    "token": "<jwt>",
    "usuario": {
      "idUsuario": 1,
      "nombre": "Administrador",
      "telefono": "3000000000",
      "correo": "admin@pixel.com",
      "estado": true,
      "idRol": 1,
      "rol": { "idRol": 1, "nombre": "Admin", "descripcion": null, "estado": true },
      "cliente": null
    }
  }
}
```

El JWT viene en `data.token`. Enviar en cada GET protegido:

```http
Authorization: Bearer <token>
```

La contrasena y `contrasenaHash` no se devuelven en el login.

### Sesion y permisos actuales

#### Consultar usuario autenticado y permisos

- **Metodo y ruta:** `GET /api/auth/me/permisos`
- **Autenticacion:** Bearer JWT requerido.
- **Permiso adicional:** ninguno; basta una sesion valida.
- **Parametros:** ninguno.
- **Respuesta:**

```json
{
  "data": {
    "usuario": { "idUsuario": 1, "correo": "admin@pixel.com", "idRol": 1, "rol": "Admin" },
    "permisos": [
      { "idPermiso": 1, "codigo": "pedidos.ver", "modulo": "pedidos", "accion": "ver", "descripcion": "Consultar pedidos", "estado": true }
    ],
    "codigos": ["pedidos.ver"]
  }
}
```

- **Uso movil:** bootstrap de sesion, menu y capacidades visibles. El rol `Admin` tiene bypass en los guards, aunque el endpoint igualmente devuelve el catalogo de permisos.

### Errores de autenticacion/autorizacion

- `401 { "message": "Token no proporcionado." }`: no se envio JWT.
- `401 { "message": "Sesion expirada. Inicia sesion nuevamente." }`: cerrar sesion local y volver al login.
- `401 { "message": "Token invalido." }`: descartar el token.
- `401 { "message": "Usuario inactivo o no autorizado." }`: no reintentar automaticamente.
- `403 { "message": "No tienes permisos para realizar esta accion." }`: la sesion es valida, pero el rol no tiene el permiso.

## 4. Convenciones

### Respuestas

- JSON individual: `{ "data": { ... } }`.
- JSON listado simple: `{ "data": [ ... ] }`.
- Listado paginado: `{ "data": [ ... ], "meta": { ... } }`.
- Excepcion: los endpoints de comprobante responden un archivo binario con `Content-Type` real e `inline`; no responden JSON cuando tienen exito.
- Los errores usan normalmente `{ "message": "..." }`.
- Campos relacionales pueden ser `null` y arreglos pueden estar vacios.
- Los `Decimal` de Prisma pueden serializarse como texto decimal; Mobile debe aceptar numero o string numerico y no usar `double` para calculos financieros sensibles.
- Los timestamps salen en formato JSON/ISO. `fechaEntregaEstimada` puede estar normalizada como `YYYY-MM-DD` en pedidos.

### Paginacion real

Parametros estandar opcionales:

- `page`: entero mayor que 0; invalido cae en `1`.
- `limit`: entero mayor que 0; por defecto `10`; en los modulos documentados el maximo es `10`.
- `search`: texto de busqueda en base de datos, solo donde se indica.
- `sortBy`: solo acepta los campos indicados en cada endpoint; otro valor usa el orden por defecto.
- `order`: `asc` o `desc`; cualquier valor distinto de `asc` se trata como `desc`.

```json
{
  "data": [],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 0,
    "totalPages": 0,
    "hasNextPage": false,
    "hasPrevPage": false
  }
}
```

**Importante:** clientes, productos, categorias y tarifas siempre devuelven paginacion. Usuarios, roles, tecnicas, cotizaciones, pedidos, abonos y proveedores solo la activan al recibir `page`, `limit`, `search`, `sortBy` u `order`. Mobile debe enviar siempre `page=1&limit=10` para no descargar listados completos.

## 5. Endpoints obligatorios para PIXEL Mobile

### Dashboard

#### Dashboard administrativo

- **Metodo y ruta:** `GET /api/dashboard/admin`
- **Autenticacion:** Bearer JWT.
- **Permiso:** `dashboard.admin`.
- **Query opcional:** `anio` (entero `2000..2100`, por defecto ano actual), `ultimos` (entero `1..20`, por defecto `5`).
- **Respuesta:**

```json
{
  "data": {
    "kpis": { "totalPedidos": 0, "pedidosPendientes": 0, "pedidosEnProceso": 0, "pedidosFinalizados": 0, "totalClientes": 0, "cotizacionesPendientes": 0, "ingresosDia": 0, "ingresosMes": 0, "ingresosAnio": 0 },
    "ingresos": { "diario": 0, "mensual": 0, "anual": 0 },
    "ventasPorMes": [{ "mes": "Enero", "numeroMes": 1, "total": 0, "cantidadPedidos": 0 }],
    "distribucionPedidos": { "PENDIENTE": 0, "EN_PROCESO": 0, "PENDIENTE_SALDO_FINAL": 0, "FINALIZADO": 0, "ENTREGADO": 0, "ANULADO": 0 },
    "ultimosPedidos": [{ "idPedido": 1, "estadoPedido": "PENDIENTE", "estadoPago": "PENDIENTE", "total": 0, "totalPagado": 0, "saldoPendiente": 0, "fechaCreacion": "<ISO>", "cliente": {} }],
    "cotizacionesPendientes": [{ "idCotizacion": 1, "estado": "EN_REVISION", "total": 0, "precioSugeridoInterno": 0, "requiereRevisionPrecio": false, "advertenciasInternas": null, "fechaCreacion": "<ISO>", "cliente": {} }]
  }
}
```

- **Uso movil:** pantalla `Inicio` administrativa.
- **Sensibilidad:** contiene ingresos y calculos internos de cotizacion; proteger capturas/cache local.

### Clientes

#### Listar y buscar clientes

- **Metodo y ruta:** `GET /api/clientes`
- **Autenticacion:** Bearer JWT.
- **Permiso:** `clientes.ver`.
- **Query opcional:** `page`, `limit` (maximo 10), `search`, `sortBy` (`idCliente`, `nombre`, `correo`, `telefono`, `fechaCreacion`), `order`.
- **Busqueda:** nombre, correo, telefono o documento; correo/telefono/documento priorizan prefijo.
- **Respuesta:**

```json
{
  "data": [{ "idCliente": 1, "idUsuario": null, "nombre": "Cliente", "documento": null, "correo": null, "telefono": null, "direccion": null, "estado": true, "fechaCreacion": "<ISO>", "fechaActualizacion": "<ISO>" }],
  "meta": { "page": 1, "limit": 10, "total": 1, "totalPages": 1, "hasNextPage": false, "hasPrevPage": false }
}
```

- **Uso movil:** pantalla `Clientes`.
- **Sensibilidad:** PII. No persistir documento, direccion, correo o telefono sin necesidad.

#### Ver cliente

- **Metodo y ruta:** `GET /api/clientes/:id`
- **Autenticacion:** Bearer JWT.
- **Permiso:** `clientes.ver`.
- **Ruta obligatoria:** `id`, entero positivo.
- **Query:** ninguno.
- **Respuesta:** `{ "data": { <campos del cliente>, "cotizaciones": [{ "idCotizacion", "tipoCotizacion", "estado", "total", "fechaCreacion" }], "pedidos": [{ "idPedido", "idCotizacion", "estadoPedido", "estadoPago", "total", "fechaCreacion" }], "_count": { "cotizaciones": 0, "pedidos": 0 } } }`. Solo incluye las 10 cotizaciones y 10 pedidos mas recientes.
- **Uso movil:** pantalla `Detalle del cliente`.
- **Sensibilidad:** PII.

#### Listar pedidos de un cliente

- **Metodo y ruta:** `GET /api/clientes/:id/pedidos`
- **Autenticacion:** Bearer JWT.
- **Permiso:** `pedidos.ver`.
- **Ruta obligatoria:** `id`, entero positivo.
- **Query opcional:** `page`, `limit` (maximo 10), `sortBy=fechaCreacion`, `order`. `search` activa paginacion pero actualmente no filtra este listado.
- **Respuesta:**

```json
{
  "data": [{ "idPedido": 1, "numeroPedido": 1, "total": 0, "totalPagado": 0, "totalConfirmado": 0, "saldoPendiente": 0, "estadoPedido": "PENDIENTE", "estadoPago": "PENDIENTE", "fechaCreacion": "<ISO>", "fechaEntregaEstimada": null, "productosResumen": "Camiseta" }],
  "meta": { "page": 1, "limit": 10, "total": 1, "totalPages": 1, "hasNextPage": false, "hasPrevPage": false }
}
```

- **Uso movil:** pestana `Pedidos` dentro del cliente.

### Cotizaciones

#### Listar y buscar cotizaciones

- **Metodo y ruta:** `GET /api/cotizaciones`
- **Autenticacion:** Bearer JWT.
- **Permiso:** `cotizaciones.ver` (la ruta tambien acepta `cotizaciones.cliente.ver`, pero Mobile administrativo debe usar el primero).
- **Query opcional:** `page`, `limit` (maximo 10), `search`, `sortBy` (`idCotizacion`, `fechaCreacion`, `total`, `estado`), `order`.
- **Respuesta:** `{ "data": [<CotizacionAdmin>], "meta": { ... } }` al paginar; sin parametros puede devolver `{ "data": [...] }` sin `meta`.
- **CotizacionAdmin resumida real:** `idCotizacion`, `idCliente`, `creadoPorId`, `tipoCotizacion`, `estado`, `subtotal`, `descuentoTotal`, `costosAdicionales`, `total`, `precioSugeridoInterno`, `requiereRevisionPrecio`, `advertenciasInternas`, `observacionesInternas`, `observaciones`, fechas, `cliente`, `creadoPor`, `detalles[]` y `versiones[]`.
- **Uso movil:** pantalla `Cotizaciones`.
- **Sensibilidad:** contiene precio sugerido, advertencias y observaciones internas. Solo para personal autorizado; no reutilizar esta respuesta en vistas de cliente.

#### Buscar cotizaciones por termino

- **Metodo y ruta:** `GET /api/cotizaciones/buscar`
- **Autenticacion:** Bearer JWT.
- **Permiso:** `cotizaciones.ver` o `cotizaciones.cliente.ver`.
- **Query obligatorio:** `termino`, texto no vacio.
- **Paginacion:** no disponible; devuelve coincidencias completas.
- **Respuesta:** `{ "data": [<CotizacionAdmin>] }`.
- **Uso movil:** busqueda puntual por cotizacion/cliente. Preferir `GET /api/cotizaciones?search=...&page=1&limit=10` para listas grandes.

#### Ver cotizacion

- **Metodo y ruta:** `GET /api/cotizaciones/:id`
- **Autenticacion:** Bearer JWT.
- **Permiso:** `cotizaciones.ver` o `cotizaciones.cliente.ver`.
- **Ruta obligatoria:** `id`, entero positivo.
- **Respuesta resumida:** `{ "data": { <CotizacionAdmin>, "detalles": [{ "idDetalleCotizacion", "idTecnica", "idProducto", "tipoProducto", "cantidad", "precioBase", "descuentoPorcentaje", "subtotal", "estampados": [], "tecnica": {}, "producto": {} }], "versiones": [] } }`.
- **Uso movil:** pantalla `Detalle de cotizacion`.
- **Sensibilidad:** incluye snapshot, costos, notas y calculos internos.

#### Listar versiones/propuestas

- **Metodo y ruta:** `GET /api/cotizaciones/:id/versiones`
- **Autenticacion:** Bearer JWT.
- **Permiso:** `cotizaciones.versiones.ver`.
- **Ruta obligatoria:** `id`, entero de cotizacion.
- **Query:** ninguno; no paginado.
- **Respuesta:** `{ "data": [{ "idVersion", "idCotizacion", "numeroVersion", "precioSugeridoInterno", "precioFinal", "descuentoManual", "costosAdicionales", "subtotalDesglose", "ajusteManual", "motivoAjusteManual", "conceptosAdicionales", "disenosOficiales", "desgloseVisible", "snapshotCompleto", "observacionesCliente", "observacionesInternas", "mensajeCliente", "validaHasta", "enviadaAt", "estado", "esVigente", "fechaCreacion", "respuesta" }] }`.
- **Uso movil:** pestana `Propuestas` de una cotizacion.
- **Sensibilidad:** alta; contiene snapshots y motivos internos.

### Pedidos

#### Listar y buscar pedidos

- **Metodo y ruta:** `GET /api/pedidos`
- **Autenticacion:** Bearer JWT.
- **Permiso:** `pedidos.ver`.
- **Query opcional:** `page`, `limit` (maximo 10), `search`, `sortBy` (`idPedido`, `fechaCreacion`, `total`, `estadoPedido`), `order`.
- **Respuesta:** `{ "data": [<PedidoCompleto>], "meta": { ... } }` al paginar; sin parametros puede devolver todos sin `meta`.
- **PedidoCompleto resumido:** `idPedido`, ids de cotizacion/version/cliente, `estadoPedido`, `estadoPago`, `total`, `totalPagado`, `saldoPendiente`, fechas, `observaciones`, `cliente`, `cotizacion`, `cotizacionVersion`, `detalles[]`, `abonos[]`, `disenos[]`, `venta`, `_count`, resumen de productos y acciones financieras calculadas.
- **Uso movil:** pantalla `Pedidos`.
- **Sensibilidad:** contiene PII, datos de pago y analisis de comprobantes.

#### Buscar pedidos por termino

- **Metodo y ruta:** `GET /api/pedidos/buscar`
- **Autenticacion:** Bearer JWT.
- **Permiso:** `pedidos.ver`.
- **Query obligatorio:** `termino`, texto no vacio.
- **Paginacion:** no disponible.
- **Respuesta:** `{ "data": [<PedidoCompleto>] }`.
- **Uso movil:** busqueda puntual. Para escala, preferir `GET /api/pedidos?search=...&page=1&limit=10`.

#### Ver pedido

- **Metodo y ruta:** `GET /api/pedidos/:id`
- **Autenticacion:** Bearer JWT.
- **Permiso:** `pedidos.ver`.
- **Ruta obligatoria:** `id`, entero positivo.
- **Respuesta:** `{ "data": { <PedidoCompleto> } }`.
- **Uso movil:** pantalla `Detalle del pedido`.

#### Ver expediente del pedido

- **Metodo y ruta:** `GET /api/pedidos/:idPedido/expediente`
- **Autenticacion:** Bearer JWT.
- **Permiso:** `pedidos.ver`.
- **Ruta obligatoria:** `idPedido`, entero positivo.
- **Respuesta:**

```json
{
  "data": {
    "pedido": { "idPedido": 1, "idCotizacion": 1, "estadoPedido": "PENDIENTE", "estadoPago": "PENDIENTE", "fechaCreacion": "<ISO>", "fechaEntregaEstimada": null, "observaciones": null, "puedeSolicitarSaldoFinal": false, "puedeFinalizar": false, "motivoBloqueoFinalizacion": null, "estadoPasoSaldoFinal": null },
    "cliente": {},
    "detalles": [],
    "requerimientosDiseno": [],
    "estadoCoberturaDiseno": "PENDIENTE",
    "resumenEconomico": { "total": 0, "totalConfirmado": 0, "totalPagadoConfirmado": 0, "saldoPendiente": 0, "estadoPago": "PENDIENTE", "montoMinimoPrimerAbono": 0 },
    "totalDisenosRequeridos": 0,
    "totalDisenosAprobados": 0,
    "totalDisenosPendientes": 0,
    "venta": null,
    "abonos": [],
    "disenos": [],
    "historial": [],
    "proximasAcciones": []
  }
}
```

- **Uso movil:** pantalla principal `Expediente`, recomendada como detalle integral.

#### Listar requerimientos de diseno del pedido

- **Metodo y ruta:** `GET /api/pedidos/:idPedido/requerimientos-diseno`
- **Autenticacion:** Bearer JWT.
- **Permiso:** `disenos.ver`.
- **Ruta obligatoria:** `idPedido`, entero positivo.
- **Respuesta:** `{ "data": { "requerimientos": [{ "idRequerimientoDiseno", "tipo", "origenDiseno", "idDetallePedido", "estampadosCubiertos", "disenoVigente", "versiones", "puedeCrearDiseno", "puedeCargarCorreccion", "puedeRegistrarDisenoCliente", "puedeDefinirOrigen", "puedeAprobar" }], "resumen": { ... } } }`.
- **Uso movil:** pestana `Requerimientos de diseno`.
- **Nota:** identificadores funcionales pueden usar prefijos `STAMP-`, `GROUP-`, `PRODUCT-` o `LEGACY-`; tratarlos como string opaco.

#### Listar disenos del pedido

- **Metodo y ruta:** `GET /api/pedidos/:idPedido/disenos`
- **Autenticacion:** Bearer JWT.
- **Permiso:** `disenos.ver`.
- **Ruta obligatoria:** `idPedido`.
- **Respuesta:** `{ "data": [<DisenoEnriquecido>] }`.
- **Uso movil:** pestana `Disenos` del pedido.

#### Listar abonos del pedido

- **Metodo y ruta:** `GET /api/pedidos/:idPedido/abonos`
- **Autenticacion:** Bearer JWT.
- **Permiso:** `abonos.ver`.
- **Ruta obligatoria:** `idPedido`.
- **Respuesta:** `{ "data": [<Abono>] }`.
- **Uso movil:** pestana `Pagos` del pedido.
- **Sensibilidad:** datos financieros y referencias.

#### Listar compras del pedido

- **Metodo y ruta:** `GET /api/pedidos/:idPedido/compras`
- **Autenticacion:** Bearer JWT.
- **Permiso:** `compras.ver`.
- **Ruta obligatoria:** `idPedido`.
- **Respuesta:** `{ "data": [<Compra>] }`.
- **Uso movil:** pestana `Compras/Insumos` del pedido.

### Disenos y produccion

#### Listar disenos

- **Metodo y ruta:** `GET /api/disenos`
- **Autenticacion:** Bearer JWT.
- **Permiso:** `disenos.ver`.
- **Query opcional:** `idPedido` (entero positivo), `idDisenador` (entero positivo), `estado` (`PENDIENTE`, `ENVIADO`, `APROBADO`, `RECHAZADO`).
- **Paginacion:** no disponible; devuelve todos los resultados filtrados. Un usuario con rol Disenador queda restringido a sus propios disenos.
- **Respuesta:** `{ "data": [{ "idDiseno", "idPedido", "idDetallePedido", "idDetalleEstampadoPedido", "grupoDisenoCompartido", "esDisenoGeneral", "idDisenador", "archivoUrl", "descripcion", "observaciones", "estado", "origenDiseno", "medioRecepcion", fechas, "detallePedido", "detalleEstampadoPedido", "pedido", "disenador", "tipoObjetivo", "idRequerimientoDiseno", "version", "estampadosCubiertos", "acciones" }] }`.
- **Uso movil:** pantalla `Disenos`.
- **Sensibilidad:** enlaces de archivos, PII del cliente y correos internos.

#### Ver diseno

- **Metodo y ruta:** `GET /api/disenos/:id`
- **Autenticacion:** Bearer JWT.
- **Permiso:** `disenos.ver`.
- **Ruta obligatoria:** `id`.
- **Respuesta:** `{ "data": { <DisenoEnriquecido> } }`.
- **Uso movil:** pantalla `Detalle del diseno`.

#### Consultar produccion pendiente

- **Metodo y ruta:** `GET /api/disenos/produccion/pendientes`
- **Autenticacion:** Bearer JWT.
- **Permiso:** `disenos.produccion`.
- **Parametros:** ninguno; no paginado.
- **Respuesta:** `{ "data": [{ "idDiseno", "idPedido", "idDetallePedido", "idDetalleEstampadoPedido", "grupoDisenoCompartido", "esDisenoGeneral", "idDisenador", "archivoUrl", "descripcion", "observaciones", "estado", "origenDiseno", "medioRecepcion", "recibidoPorId", "fechaRecepcion", "medioRespuestaCliente", "observacionesCliente", "fechaRespuestaCliente", "respuestaRegistradaPorId", "fechaCreacion", "fechaActualizacion", "fechaEnvio", "fechaAprobacion", "detallePedido", "detalleEstampadoPedido", "pedido", "respuestaRegistradaPor", "recibidoPor", "disenador" }] }`. El repositorio filtra `estado=APROBADO` y pedidos `EN_PROCESO`.
- **Uso movil:** pantalla `Produccion`.
- **Nota:** un Disenador recibe solo registros asociados a su usuario.

### Abonos

#### Listar y filtrar abonos

- **Metodo y ruta:** `GET /api/abonos`
- **Autenticacion:** Bearer JWT.
- **Permiso:** `abonos.ver`.
- **Query opcional:** `idCliente`, `idPedido`, `estado` (`PENDIENTE`, `CONFIRMADO`, `RECHAZADO`), `metodoPago` (`EFECTIVO`, `TRANSFERENCIA`), `desde`, `hasta`, `page`, `limit` (maximo 10), `search`, `sortBy` (`idAbono`, `fechaCreacion`, `monto`, `estado`), `order`.
- **Busqueda paginada:** id de abono/pedido, referencia o nombre del cliente.
- **Respuesta:** `{ "data": [<Abono>], "meta": { ... } }` al paginar; sin paginacion `{ "data": [<Abono>] }`.
- **Abono resumido:** `idAbono`, `idPedido`, `monto`, `metodoPago`, `referencia`, `fechaPago`, metadatos publicos del comprobante, sugerencias detectadas, `requiereRevisionManual`, `origenRegistro`, `observaciones`, `estado`, fechas, `pedido`, `confirmadoPor`, `rechazadoPor`, `corregidoPor`.
- **Uso movil:** pantalla `Abonos`.
- **Sensibilidad:** alta; no guardar localmente referencias, banco o metadatos del comprobante sin proteccion.

#### Ver abono

- **Metodo y ruta:** `GET /api/abonos/:id`
- **Autenticacion:** Bearer JWT.
- **Permiso:** `abonos.ver`.
- **Ruta obligatoria:** `id`.
- **Respuesta:** `{ "data": { <Abono> } }`.
- **Uso movil:** pantalla `Detalle del abono`.

#### Abrir comprobante

- **Metodo y ruta:** `GET /api/abonos/:idAbono/comprobante`
- **Autenticacion:** Bearer JWT.
- **Permiso:** `abonos.ver`.
- **Ruta obligatoria:** `idAbono`.
- **Respuesta:** stream binario `inline`, con `Content-Type` y nombre de archivo; error `404` en JSON.
- **Uso movil:** visor protegido de comprobantes.
- **Sensibilidad:** critica. No registrar URL con token, no cachear en galeria y borrar temporales.

### Ventas

#### Listar ventas

- **Metodo y ruta:** `GET /api/ventas`
- **Autenticacion:** Bearer JWT.
- **Permiso:** `ventas.ver`.
- **Query opcional:** `fechaInicio`, `fechaFin`, `idCliente`, `estadoPago` (`PENDIENTE`, `PARCIAL`, `COMPLETO`).
- **Paginacion:** no disponible.
- **Respuesta:** `{ "data": [{ "idPedido", "idVenta", "idCliente", "nombreCliente", "correoCliente", "telefonoCliente", "total", "totalPagado", "saldoPendiente", "fechaCreacion", "fechaFinalizado", "fechaEntregado", "estadoPago", "estado", "fechaPrimerPago", "tecnicas", "cantidadTotalProductos" }] }`.
- **Uso movil:** pantalla `Ventas`.
- **Sensibilidad:** PII e informacion financiera.

#### Buscar ventas

- **Metodo y ruta:** `GET /api/ventas/buscar`
- **Autenticacion:** Bearer JWT.
- **Permiso:** `ventas.ver`.
- **Query obligatorio:** uno de `termino`, `q` o `busqueda`.
- **Busqueda:** id de pedido, nombre, correo o documento del cliente.
- **Respuesta:** `{ "data": [<Venta>] }`.
- **Uso movil:** buscador de ventas.

#### Resumen general de ventas

- **Metodo y ruta:** `GET /api/ventas/resumen`
- **Autenticacion:** Bearer JWT.
- **Permiso:** `ventas.resumen`.
- **Query:** no acepta filtros.
- **Respuesta:** `{ "data": { "totalVentas": 0, "ingresosRecibidos": 0, "cantidadVentas": 0, "ticketPromedio": 0, "ventasPagadasCompletas": 0, "ventasPagadasParciales": 0 } }`.
- **Uso movil:** tarjetas financieras.

#### Resumen de ventas por periodo

- **Metodo y ruta:** `GET /api/ventas/resumen-periodo`
- **Autenticacion:** Bearer JWT.
- **Permiso:** `ventas.resumen`.
- **Query obligatorio:** `fechaInicio`, `fechaFin`; fechas validas y rango ascendente.
- **Respuesta:** `{ "data": { "totalVentas": 0, "ingresosRecibidos": 0, "cantidadVentas": 0, "ticketPromedio": 0 } }`.
- **Uso movil:** filtro de resultados por periodo.

## 6. Endpoints utiles / segunda etapa

### Usuarios y roles

#### Listar usuarios

- **Ruta:** `GET /api/usuarios`
- **Auth/permiso:** Bearer JWT, `usuarios.ver`.
- **Query opcional:** `idRol`, `page`, `limit` (maximo 10), `search`, `sortBy` (`idUsuario`, `nombre`, `correo`, `fechaCreacion`), `order`.
- **Respuesta:** `{ "data": [{ "idUsuario", "nombre", "documento", "telefono", "direccion", "correo", "estado", fechas, "rol", "cliente" }], "meta": { ... } }` al paginar; sin parametros no incluye `meta`.
- **Uso movil:** directorio interno. **Sensibilidad:** PII; revisar antes de habilitar.

#### Buscar usuarios

- **Ruta:** `GET /api/usuarios/buscar`
- **Auth/permiso:** Bearer JWT, `usuarios.ver`.
- **Query obligatorio:** `termino`; opcionales `idRol`, `page`, `limit`, `sortBy`, `order`.
- **Respuesta:** paginada `{ "data": [<Usuario>], "meta": { ... } }`.
- **Uso movil:** busqueda en directorio interno.

#### Ver usuario

- **Ruta:** `GET /api/usuarios/:id`
- **Auth/permiso:** Bearer JWT, `usuarios.ver`.
- **Ruta obligatoria:** `id`.
- **Respuesta:** `{ "data": { <Usuario> } }`.
- **Uso movil:** detalle interno. **Sensibilidad:** PII.

#### Listar roles

- **Ruta:** `GET /api/roles`
- **Auth/permiso:** Bearer JWT, `roles.ver`.
- **Query opcional:** `page`, `limit` (maximo 10), `search`, `sortBy` (`idRol`, `nombre`), `order`.
- **Respuesta:** `{ "data": [{ "idRol", "nombre", "descripcion", "estado" }], "meta": { ... } }` al paginar.
- **Uso movil:** consulta de roles.

#### Buscar roles

- **Ruta:** `GET /api/roles/buscar`
- **Auth/permiso:** Bearer JWT, `roles.ver`.
- **Query:** `nombre` opcional en controller; vacio puede devolver todos los roles.
- **Respuesta:** `{ "data": [{ "idRol", "nombre", "descripcion", "estado" }] }`.
- **Uso movil:** selector/consulta de roles.

#### Impacto de eliminacion del rol

- **Ruta:** `GET /api/roles/:id/impacto-eliminacion`
- **Auth/permiso:** Bearer JWT, `roles.ver`.
- **Ruta obligatoria:** `id`.
- **Respuesta:** `{ "data": { "puedeEliminar": true, "requiereConfirmacionReforzada": true, "totalAfectados": 1, "limiteRegistrosPorTipo": 10, "afectados": [{ "tipo", "accion", "cantidad", "registros", "registrosOmitidos" }] } }`.
- **Uso movil:** diagnostico de solo lectura; no es necesario en MVP porque Mobile no elimina.

### Permisos

#### Listar catalogo de permisos

- **Ruta:** `GET /api/permisos`
- **Auth/permiso:** Bearer JWT, `permisos.ver`.
- **Parametros:** ninguno; no paginado.
- **Respuesta:** `{ "data": [{ "idPermiso", "codigo", "modulo", "accion", "descripcion", "estado", "fechaCreacion" }] }`.
- **Uso movil:** diagnostico de autorizacion.

#### Listar permisos de un rol

- **Ruta:** `GET /api/permisos/roles/:idRol`
- **Auth/permiso:** Bearer JWT, `permisos.ver`.
- **Ruta obligatoria:** `idRol`.
- **Respuesta:** `{ "data": [<Permiso>] }`.
- **Uso movil:** detalle del rol.

### Productos y categorias

#### Listar productos administrativos

- **Ruta:** `GET /api/productos`
- **Auth/permiso:** Bearer JWT, `productos.ver`.
- **Query opcional:** `page`, `limit` (maximo 10), `search` por nombre, `sortBy` (`idProducto`, `nombre`, `precioBase`, `fechaCreacion`), `order`, `idCategoriaProducto` entero positivo.
- **Respuesta:** `{ "data": [{ "idProducto", "idCategoriaProducto", "nombre", "descripcion", "precioBase", "requiereDiseno", "estado", fechas, "categoriaProducto", "rangos" }], "meta": { ... } }`.
- **Uso movil:** catalogo administrativo.

#### Ver producto

- **Ruta:** `GET /api/productos/:id`
- **Auth/permiso:** Bearer JWT, `productos.ver`.
- **Ruta obligatoria:** `id`.
- **Respuesta:** `{ "data": { <Producto con categoria y rangos> } }`.
- **Uso movil:** detalle de producto.

#### Listar rangos legacy del producto

- **Ruta:** `GET /api/productos/:id/rangos`
- **Auth/permiso:** Bearer JWT y alguno de `productos.descuentos.gestionar`, `productos.precios`.
- **Ruta obligatoria:** `id`.
- **Respuesta:** `{ "data": [{ "idRango", "idProducto", "cantidadMin", "descuentoPorcentaje", "estado", fechas, "id", "cantidadMinima", "porcentaje" }] }`.
- **Uso movil:** consulta legacy. No asumir que estos rangos calculan solicitudes nuevas.

#### Listar categorias

- **Ruta:** `GET /api/categorias-producto`
- **Auth/permiso:** Bearer JWT, `categorias_producto.ver`.
- **Query opcional:** `page`, `limit` (maximo 10), `search`, `sortBy` (`idCategoriaProducto`, `nombre`, `fechaCreacion`), `order`.
- **Respuesta:** `{ "data": [{ "idCategoriaProducto", "nombre", "descripcion", "estado", fechas }], "meta": { ... } }`.
- **Uso movil:** catalogo de categorias.

#### Ver categoria

- **Ruta:** `GET /api/categorias-producto/:id`
- **Auth/permiso:** Bearer JWT, `categorias_producto.ver`.
- **Ruta obligatoria:** `id`.
- **Respuesta:** `{ "data": { "idCategoriaProducto", "nombre", "descripcion", "estado", "fechaCreacion", "fechaActualizacion" } }`.
- **Uso movil:** detalle de categoria.

### Tecnicas, tarifas y descuentos

#### Listar tecnicas

- **Ruta:** `GET /api/tecnicas`
- **Auth/permiso:** Bearer JWT, `tecnicas.ver`.
- **Query opcional:** `page`, `limit` (maximo 10), `search`, `sortBy` (`idTecnica`, `nombre`, `fechaCreacion`), `order`.
- **Respuesta:** `{ "data": [{ "idTecnica", "nombre", "descripcion", "requiereMedidas", "estado", fechas }], "meta": { ... } }` al paginar.
- **Uso movil:** catalogo de servicios/tecnicas.

#### Buscar tecnicas

- **Ruta:** `GET /api/tecnicas/buscar`
- **Auth/permiso:** Bearer JWT, `tecnicas.ver`.
- **Query obligatorio:** `termino` no vacio.
- **Respuesta:** `{ "data": [<Tecnica>] }`; no paginado.
- **Uso movil:** busqueda puntual.

#### Ver tecnica

- **Ruta:** `GET /api/tecnicas/:id`
- **Auth/permiso:** Bearer JWT, `tecnicas.ver`.
- **Ruta obligatoria:** `id`.
- **Respuesta:** `{ "data": { <Tecnica> } }`.
- **Uso movil:** detalle de tecnica.

#### Listar tarifas por dimensiones

- **Ruta:** `GET /api/tarifas-tecnicas`
- **Auth/permiso:** Bearer JWT, `tarifas.tecnicas.ver`.
- **Query opcional:** `idTecnica`, `page`, `limit` (maximo 10), `search` (nombre de tecnica), `sortBy` (`idTarifa`, `nombre`, `anchoHastaCm`, `altoHastaCm`, `precioUnitario`, `fechaCreacion`), `order`.
- **Respuesta:** `{ "data": [{ "idTarifa", "idTecnica", "nombre", "anchoHastaCm", "altoHastaCm", "esGeneral", "precioUnitario", "estado", fechas, "tecnica" }], "meta": { ... } }`.
- **Uso movil:** consulta de tarifas internas. **Sensibilidad:** precio interno.

#### Listar descuentos legacy de una tecnica

- **Ruta:** `GET /api/tarifas-tecnicas/tecnicas/:idTecnica/descuentos`
- **Auth/permiso:** Bearer JWT, `tarifas.tecnicas.ver`.
- **Ruta obligatoria:** `idTecnica`.
- **Respuesta:** `{ "data": [{ "idDescuento", "idTecnica", "cantidadMinima", "porcentaje", "estado", fechas }], "deprecated": true, "message": "Configuracion legacy: estos descuentos no se aplican a solicitudes nuevas." }`.
- **Uso movil:** solo auditoria legacy.

### Proveedores y compras

#### Listar proveedores

- **Ruta:** `GET /api/proveedores`
- **Auth/permiso:** Bearer JWT, `proveedores.ver`.
- **Query opcional:** `estado` (`true`/`false`), `page`, `limit` (maximo 10), `search`, `sortBy` (`idProveedor`, `nombre`, `correo`, `fechaCreacion`), `order`.
- **Respuesta:** `{ "data": [{ "idProveedor", "nombre", "telefono", "correo", "direccion", "estado", fechas }], "meta": { ... } }` al paginar.
- **Uso movil:** pantalla `Proveedores`.
- **Sensibilidad:** datos de contacto comercial.

#### Buscar proveedores

- **Ruta:** `GET /api/proveedores/buscar`
- **Auth/permiso:** Bearer JWT, `proveedores.ver`.
- **Query:** `termino`; vacio puede devolver todos.
- **Respuesta:** `{ "data": [<Proveedor>] }`; no paginado.
- **Uso movil:** busqueda puntual.

#### Ver proveedor

- **Ruta:** `GET /api/proveedores/:id`
- **Auth/permiso:** Bearer JWT, `proveedores.ver`.
- **Ruta obligatoria:** `id`.
- **Respuesta:** `{ "data": { <Proveedor> } }`.
- **Uso movil:** detalle del proveedor.

#### Listar compras

- **Ruta:** `GET /api/compras`
- **Auth/permiso:** Bearer JWT, `compras.ver`.
- **Query opcional:** `idPedido`, `idProveedor`, `compradoPorId`, `estado` (`PENDIENTE`, `COMPRADA`, `ANULADA`), `desde`, `hasta`.
- **Paginacion:** no disponible. Disenador debe enviar `idPedido` y recibe una respuesta sin costos.
- **Respuesta:** `{ "data": [{ "idCompra", "idPedido", "idProveedor", "compradoPorId", "estado", "total", "fechaCompra", "observaciones", "proveedor", "compradoPor", "pedido", "detalles" }] }`.
- **Uso movil:** pantalla `Compras`.
- **Sensibilidad:** costos internos; la sanitizacion depende del rol.

#### Ver compra

- **Ruta:** `GET /api/compras/:id`
- **Auth/permiso:** Bearer JWT, `compras.ver`.
- **Ruta obligatoria:** `id`.
- **Respuesta:** `{ "data": { <Compra> } }`.
- **Uso movil:** detalle de compra.

#### Resumen de compras

- **Ruta:** `GET /api/compras/resumen`
- **Auth/permiso:** Bearer JWT, `compras.resumen`; el service limita la gestion a Admin/Secretaria.
- **Query opcional:** `idPedido`, `idProveedor`, `desde`, `hasta`.
- **Respuesta:** `{ "data": { "totalCompras": 0, "cantidadCompras": 0, "porEstado": { "PENDIENTE": 0, "COMPRADA": 0, "ANULADA": 0 } } }`.
- **Uso movil:** resumen de compras.

## 7. Endpoints publicos

Estas rutas no requieren JWT. Para Mobile administrativo se prefieren sus equivalentes protegidos porque incluyen estado, fechas y datos internos autorizados.

### Productos activos publicos

- **Ruta:** `GET /api/public/productos`
- **Query opcional:** `idCategoriaProducto` entero positivo.
- **Respuesta:** `{ "data": [{ "idProducto", "idCategoriaProducto", "nombre", "descripcion", "requiereDiseno", "estado", "categoriaProducto" }] }`.

### Categorias activas publicas

- **Ruta:** `GET /api/public/categorias-producto`
- **Parametros:** ninguno.
- **Respuesta:** `{ "data": [{ "idCategoriaProducto", "nombre", "descripcion" }] }`.

### Tecnicas activas publicas

- **Ruta:** `GET /api/public/tecnicas`
- **Parametros:** ninguno.
- **Respuesta:** `{ "data": [{ "idTecnica", "nombre", "descripcion", "requiereMedidas", "estado" }] }`.

### Tarifas visibles de una tecnica

- **Ruta:** `GET /api/public/tecnicas/:idTecnica/tarifas`
- **Ruta obligatoria:** `idTecnica`, entero positivo y tecnica activa.
- **Respuesta:** `{ "data": [{ "idTarifa", "nombre", "anchoHastaCm", "altoHastaCm", "esGeneral" }] }`.
- **Nota:** el endpoint publico no devuelve `precioUnitario`.

## 8. GET exclusivos del portal Cliente (no usar en Mobile administrativo)

- `GET /api/dashboard/cliente` y `GET /api/cliente/dashboard`: requieren `dashboard.cliente` y el rol Cliente; son dos rutas al mismo dashboard propio.
- `GET /api/cliente/disenos`: requiere `disenos.cliente.ver`; solo disenos del cliente autenticado.
- `GET /api/cliente/disenos/:idDiseno`: requiere `disenos.cliente.ver` y ownership.
- `GET /api/cliente/pedidos/:idPedido/abonos`: requiere `abonos.cliente.ver` y ownership.
- `GET /api/cliente/abonos/:idAbono/comprobante`: requiere `abonos.cliente.ver`, devuelve binario y valida ownership.

## 9. Endpoints que NO debe usar Mobile de solo lectura

### Autenticacion no necesaria para la sesion normal

- `POST /api/auth/register`: crea un usuario Cliente.
- `POST /api/auth/forgot-password`: inicia recuperacion.
- `POST /api/auth/reset-password`: cambia contrasena.
- `POST /api/auth/cliente/crear-password`: crea contrasena de Cliente.

### Escritura administrativa

- `POST /api/roles`, `PATCH /api/roles/:id`, `DELETE /api/roles/:id`, `DELETE /api/roles/:id/eliminar`.
- `POST /api/usuarios`, `PATCH /api/usuarios/:id`, `DELETE /api/usuarios/:id`, `DELETE /api/usuarios/:id/eliminar`.
- `PATCH /api/clientes/:id/desactivar`, `DELETE /api/clientes/:id`.
- `POST /api/permisos/sincronizar`, `PATCH /api/permisos/roles/:idRol`.
- `POST /api/productos`, `PATCH /api/productos/:id`, `PATCH /api/productos/:id/rangos`, `DELETE /api/productos/:id`, `DELETE /api/productos/:id/eliminar`.
- `POST /api/categorias-producto`, `PATCH /api/categorias-producto/:id`, `PATCH /api/categorias-producto/:id/desactivar`, `DELETE /api/categorias-producto/:id`, `DELETE /api/categorias-producto/:id/eliminar`.
- `POST /api/tecnicas`, `PATCH /api/tecnicas/:id`, `DELETE /api/tecnicas/:id`, `DELETE /api/tecnicas/:id/eliminar`.
- `POST /api/tarifas-tecnicas`, `PATCH /api/tarifas-tecnicas/:id`, `DELETE /api/tarifas-tecnicas/:id`, `PATCH /api/tarifas-tecnicas/tecnicas/:idTecnica/descuentos`.
- `POST /api/cotizaciones`, `POST /api/cotizaciones/cliente`, `PATCH /api/cotizaciones/:id`, `PATCH /api/cotizaciones/:id/cliente`, `PATCH /api/cotizaciones/:id/cotizar`, `PATCH /api/cotizaciones/:id/aprobar`, `PATCH /api/cotizaciones/:id/anular`, `POST /api/cotizaciones/:id/propuestas`, `POST /api/cotizaciones/:id/respuesta-cliente`, `POST /api/cotizaciones/:id/responder`, `DELETE /api/cotizaciones/:id`, `DELETE /api/cotizaciones/:id/eliminar`.
- `POST /api/pedidos` y todos los `PATCH /api/pedidos/...`: cambian pedido, estado, entrega, diseno o requerimientos.
- `POST /api/disenos`, todos los `PATCH /api/disenos/...` y `DELETE /api/disenos/:id`.
- `POST /api/abonos`, todos los `PATCH /api/abonos/...` y `DELETE /api/abonos/:id`.
- `POST /api/proveedores`, `PATCH /api/proveedores/:id`, `DELETE /api/proveedores/:id`, `DELETE /api/proveedores/:id/eliminar`.
- `POST /api/compras`, todos los `PATCH /api/compras/...` y `DELETE /api/compras/:id`.

### Escritura publica/Cliente

- `POST /api/public/cotizaciones/calcular`: calcula una solicitud; no es lectura administrativa persistida.
- `POST /api/public/cotizaciones`: crea una solicitud.
- `POST /api/cliente/pedidos/:idPedido/abonos/comprobante`: registra un comprobante.
- Todos los `PATCH /api/cliente/...`: aprueban/rechazan disenos o registran archivos.

Mobile debe aplicar una allowlist de metodos y rutas, no solo ocultar botones.

## 10. Codigos HTTP relevantes

- `200`: consulta correcta.
- `400`: parametro/filtro invalido. Mostrar `message` de forma controlada.
- `401`: token ausente, invalido, expirado o usuario/rol inactivo. Cerrar sesion local.
- `403`: falta de permiso o rol incorrecto. No reintentar.
- `404`: entidad o resultados no encontrados; varios listados actuales usan 404 para lista vacia.
- `500`: fallo interno. No mostrar detalles tecnicos al usuario.

## 11. Endpoints que deben revisarse antes de Flutter

1. `GET /api/disenos`, `GET /api/compras` y `GET /api/ventas` no tienen paginacion backend.
2. Los endpoints `/buscar` de cotizaciones, pedidos, tecnicas, proveedores y ventas tampoco tienen paginacion.
3. `GET /api/cotizaciones` y `GET /api/pedidos` pueden devolver todos los registros si Mobile omite parametros de paginacion.
4. `GET /api/clientes/:id/pedidos` acepta `search` por la utilidad comun, pero actualmente no lo aplica al query.
5. `GET /api/roles/buscar` y `GET /api/proveedores/buscar` no exigen realmente un termino no vacio.
6. Listados vacios no son consistentes: algunos devuelven `200 data: []` y otros `404`.
7. No existe `GET /api/ventas/:id`; el detalle financiero debe obtenerse desde pedido/expediente.
8. Los listados de cotizaciones y pedidos son muy amplios e incluyen relaciones internas; seria recomendable un DTO movil de lectura en una fase futura, sin reutilizarlo para clientes.
9. La respuesta administrativa de cotizacion expone deliberadamente calculos y observaciones internas; requiere almacenamiento local seguro.
10. El comprobante es binario y requiere un cliente HTTP que conserve el header Bearer durante la descarga.

## 12. Notas para Flutter

- Todas las respuestas normales son JSON; el comprobante es la excepcion binaria.
- Guardar el JWT en almacenamiento seguro y enviarlo como Bearer.
- Tratar `401` como sesion expirada y `403` como falta de permiso.
- Construir navegacion con `data.codigos` de `/auth/me/permisos`, pero mantener controles del backend como autoridad.
- No asumir que `data` siempre es un arreglo ni que siempre existe `meta`.
- El nombre real del bloque de paginacion es `meta`, no `pagination`.
- Enviar siempre `page` y `limit=10` en listados que soporten paginacion.
- No descargar todos los registros para paginar localmente.
- Modelar relaciones y campos opcionales como nullable.
- Parsear timestamps ISO y fechas calendario sin alterar el dia por zona horaria.
- Manejar importes Decimal como string/decimal seguro; no redondear con `double`.
- No inventar campos ni convertir enums a otros valores al comunicarse con la API; humanizarlos solo en UI.
- No registrar JWT, PII, respuestas completas de cotizaciones, referencias de pago ni contenido de comprobantes en logs.
- Usar una allowlist de los GET de este documento y el unico POST necesario para login.
