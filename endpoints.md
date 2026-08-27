# Documentacion de Endpoints - Backend PIXEL

Base URL sugerida:

```txt
http://localhost:3000/api
```

Para rutas protegidas se debe enviar el token JWT:

```txt
Authorization: Bearer TU_TOKEN
Content-Type: application/json
```

---

# 1. Auth

## Registrar cliente

```http
POST /api/auth/register
```

### Body

```json
{
  "nombre": "Juan Cliente",
  "telefono": "3001234567",
  "correo": "juan.cliente@gmail.com",
  "contrasena": "123456"
}
```

## Iniciar sesion

```http
POST /api/auth/login
```

### Body

```json
{
  "correo": "admin@pixel.com",
  "contrasena": "admin123"
}
```

### Respuesta

```json
{
  "message": "Inicio de sesion exitoso.",
  "data": {
    "token": "TOKEN_JWT",
    "usuario": {
      "idUsuario": 1,
      "nombre": "Admin Principal",
      "correo": "admin@pixel.com",
      "rol": {
        "nombre": "Admin"
      }
    }
  }
}
```

---

# 2. Roles

```http
POST /api/roles
GET /api/roles
GET /api/roles/buscar?nombre=admin
PATCH /api/roles/:id
DELETE /api/roles/:id
DELETE /api/roles/:id/eliminar
```

Reglas principales:

- El nombre no puede estar vacio.
- El nombre no puede repetirse.
- La descripcion debe tener minimo 5 caracteres.
- `DELETE` no elimina fisicamente; cambia el estado.
- `DELETE /api/roles/:id/eliminar` elimina fisicamente el rol y, por cascada, sus usuarios relacionados con sus cotizaciones y detalles.

---

# 3. Usuarios

```http
POST /api/usuarios
GET /api/usuarios
GET /api/usuarios/buscar?termino=juan
GET /api/usuarios/:id
PATCH /api/usuarios/:id
DELETE /api/usuarios/:id
DELETE /api/usuarios/:id/eliminar
```

Reglas principales:

- El correo debe ser valido y unico.
- El documento debe ser unico.
- La contrasena debe tener minimo 6 caracteres.
- El rol debe existir.
- La API no devuelve `contrasenaHash`.
- `DELETE` no elimina fisicamente; cambia `estado` a `false`.
- `DELETE /api/usuarios/:id/eliminar` elimina fisicamente el usuario y, por cascada, sus cotizaciones con sus detalles.

---

# 4. Tecnicas

Todas las rutas de tecnicas usan JWT.

```http
POST /api/tecnicas
GET /api/tecnicas
GET /api/tecnicas/buscar?termino=sub
GET /api/tecnicas/:id
PATCH /api/tecnicas/:id
DELETE /api/tecnicas/:id
DELETE /api/tecnicas/:id/eliminar
```

Roles:

- Crear, actualizar, desactivar y eliminar: `Admin`, `Secretaria`.
- Listar y consultar: `Admin`, `Secretaria`, `Cliente`.

Reglas principales:

- `DELETE /api/tecnicas/:id` cambia el estado de la tecnica.
- `DELETE /api/tecnicas/:id/eliminar` elimina fisicamente la tecnica y, por cascada, los detalles de cotizacion relacionados.

---

# 5. Cotizaciones

La cotizacion inicia el flujo comercial de PIXEL. Todas las rutas usan JWT y devuelven el `cotizacionSelect`, incluyendo `cliente`, `creadoPor` y `detalles.tecnica`.

Estados validos:

```txt
PENDIENTE, APROBADA, ANULADA
```

Calculos del backend:

```txt
subtotalDetalle = cantidad * precioUnitario + costoDiseno
subtotalCotizacion = subtotal del unico detalle
totalCotizacion = subtotalCotizacion + costosAdicionales
```

Reglas generales:

- Una cotizacion representa una sola solicitud comercial concreta.
- Cada cotizacion debe tener un unico detalle: la prenda, mug o producto solicitado.
- Si el cliente quiere otra prenda o producto, debe crear otra cotizacion.
- Cliente solo ve y modifica sus propias cotizaciones.
- Cliente no puede enviar ni modificar precios, costos de diseno, subtotales, costos adicionales ni totales.
- Admin y Secretaria pueden consultar todas las cotizaciones.
- Anular conserva la cotizacion y cambia el estado a `ANULADA`.
- Eliminar borra la cotizacion y, por cascada, sus detalles.
- Una cotizacion `APROBADA` o `ANULADA` no se edita.
- Una cotizacion `PENDIENTE` con precios asignados ya no puede ser editada por el cliente.
- `imagenReferencia` es opcional; puede enviarse como texto, `null` u omitirse.

---

## Crear solicitud como cliente

Roles permitidos:

```txt
Cliente
```

```http
POST /api/cotizaciones/cliente
```

El `idCliente` sale del token. Estado inicial: `PENDIENTE`.

### Body

```json
{
  "detalles": [
    {
      "idTecnica": 1,
      "descripcion": "Camiseta blanca sublimada talla M",
      "cantidad": 10,
      "imagenReferencia": "https://example.com/referencia.png",
      "observaciones": "Diseno frontal"
    }
  ]
}
```

### Validaciones

- `idTecnica` obligatorio.
- `descripcion` no puede estar vacia.
- `cantidad` debe ser mayor a 0.
- `detalles` debe tener exactamente un elemento.
- `imagenReferencia` es opcional.
- No se aceptan `idDetalleCotizacion`, `precioUnitario`, `costoDiseno`, `subtotal`, `costosAdicionales` ni `total`.

---

## Editar solicitud como cliente

Roles permitidos:

```txt
Cliente
```

```http
PATCH /api/cotizaciones/:id/cliente
```

Solo permitido si:

- Si el usuario es Cliente, la cotizacion le pertenece.
- El estado actual es `PENDIENTE`.
- La cotizacion aun no tiene precios asignados.

### Body

```json
{
  "detalles": [
    {
      "idDetalleCotizacion": 12,
      "idTecnica": 1,
      "descripcion": "Camiseta blanca sublimada talla L",
      "cantidad": 12,
      "imagenReferencia": "https://example.com/nueva-referencia.png",
      "observaciones": "Cambiar talla y cantidad"
    }
  ]
}
```

Notas:

- Debe enviarse el `idDetalleCotizacion` del detalle existente.
- Solo se actualiza ese detalle existente.
- No se pueden agregar nuevos detalles desde este endpoint.
- Para otra prenda, mug o producto, se debe crear una nueva cotizacion.

---

## Anular solicitud

Roles permitidos:

```txt
Admin, Secretaria, Cliente
```

```http
PATCH /api/cotizaciones/:id/anular
```

Solo permitido si:

- Si el usuario es Cliente, la cotizacion le pertenece.
- El estado actual es `PENDIENTE`.

Resultado:

```txt
estado = ANULADA
```

---

## Aprobar cotizacion

Roles permitidos:

```txt
Admin, Secretaria, Cliente
```

```http
PATCH /api/cotizaciones/:id/aprobar
```

Solo permitido si:

- Si el usuario es Cliente, la cotizacion le pertenece.
- El estado actual es `PENDIENTE`.
- La cotizacion tiene precios asignados.

Resultado:

```txt
estado = APROBADA
pedido.estadoPedido = PENDIENTE
pedido.estadoPago = PENDIENTE
```

Al aprobar, el backend crea automaticamente el pedido en la misma transaccion.
Si el pedido no puede crearse, la cotizacion no queda aprobada.

### Respuesta

```json
{
  "message": "Cotizacion aprobada y pedido creado correctamente.",
  "data": {
    "cotizacion": {},
    "pedido": {}
  }
}
```

---

## Crear solicitud presencial

Roles permitidos:

```txt
Admin, Secretaria
```

```http
POST /api/cotizaciones
```

Admin o Secretaria selecciona el cliente. Estado inicial: `PENDIENTE`.

### Body

```json
{
  "idCliente": 4,
  "observaciones": "Cliente presencial solicita cotizacion formal",
  "detalles": [
    {
      "idTecnica": 1,
      "descripcion": "Camiseta blanca sublimada talla M",
      "cantidad": 10,
      "imagenReferencia": "https://example.com/referencia.png",
      "observaciones": "Diseno frontal"
    }
  ]
}
```

Este endpoint no recibe precios. Para asignar precios se usa `PATCH /api/cotizaciones/:id/cotizar`.
La solicitud presencial tambien debe tener un unico detalle; otro producto se registra como otra cotizacion.

---

## Cotizar solicitud

Roles permitidos:

```txt
Admin, Secretaria
```

```http
PATCH /api/cotizaciones/:id/cotizar
```

Asigna precios, costos de diseno, costos adicionales y observaciones de empresa. La cotizacion permanece en estado `PENDIENTE` hasta que sea aprobada o anulada.

Solo permitido si el estado actual es `PENDIENTE`.

### Body

```json
{
  "costosAdicionales": 10000,
  "observaciones": "Incluye entrega local",
  "detalles": [
    {
      "idDetalleCotizacion": 12,
      "precioUnitario": 25000,
      "costoDiseno": 30000,
      "observaciones": "Precio validado por produccion"
    }
  ]
}
```

### Validaciones

- `detalles` debe tener exactamente un elemento.
- El detalle debe incluir `idDetalleCotizacion`.
- `precioUnitario` debe ser mayor o igual a 0.
- `costoDiseno` debe ser mayor o igual a 0.
- `costosAdicionales`, si se envia, debe ser mayor o igual a 0.

---

## Actualizar observaciones o costos adicionales

Roles permitidos:

```txt
Admin, Secretaria
```

```http
PATCH /api/cotizaciones/:id
```

Solo permitido si la cotizacion esta en `PENDIENTE`.

### Body

```json
{
  "observaciones": "Cliente pidio ajustar condiciones de entrega",
  "costosAdicionales": 15000
}
```

Reglas:

- Solo se aceptan `observaciones` y `costosAdicionales`.
- Si cambia `costosAdicionales`, el backend recalcula `total`.

---

## Eliminar cotizacion

Roles permitidos:

```txt
Admin, Secretaria
```

```http
DELETE /api/cotizaciones/:id
DELETE /api/cotizaciones/:id/eliminar
```

Elimina fisicamente la cotizacion y, por cascada, sus detalles. Ambos endpoints hacen la misma eliminacion; se mantiene `DELETE /api/cotizaciones/:id` por convencion REST y `DELETE /api/cotizaciones/:id/eliminar` para usar el mismo patron explicito de las demas APIs. Esto no reemplaza `PATCH /api/cotizaciones/:id/anular`; anular se mantiene para cerrar el flujo comercial conservando el registro.

---

## Listar cotizaciones

Roles permitidos:

```txt
Admin, Secretaria, Cliente
```

```http
GET /api/cotizaciones
```

Comportamiento:

- Admin y Secretaria ven todas.
- Cliente solo ve sus propias cotizaciones.

---

## Buscar cotizacion por ID

Roles permitidos:

```txt
Admin, Secretaria, Cliente
```

```http
GET /api/cotizaciones/:id
```

Comportamiento:

- Admin y Secretaria pueden ver cualquier cotizacion.
- Cliente solo puede ver cotizaciones propias.

---

## Buscar cotizaciones parcialmente

Roles permitidos:

```txt
Admin, Secretaria, Cliente
```

```http
GET /api/cotizaciones/buscar?termino=pendiente
```

Busca por:

- Estado.
- Tipo de cotizacion.
- Nombre del cliente.

---

# 6. Pedidos

La API de pedidos parte de cotizaciones `APROBADA`. Todas las rutas usan JWT y devuelven cliente, cotizacion, creador de la cotizacion, detalles del pedido y la relacion `abonos` preparada para la futura API de pagos.

Estados de pedido:

```txt
PENDIENTE, EN_PROCESO, FINALIZADO, ANULADO
```

Estados de pago:

```txt
PENDIENTE, PARCIAL, COMPLETO
```

Reglas principales:

- Al aprobar una cotizacion se crea automaticamente un pedido `PENDIENTE`.
- `POST /api/pedidos` se conserva como endpoint administrativo de recuperacion para cotizaciones antiguas o casos excepcionales donde una cotizacion ya estuviera `APROBADA` y aun no tenga pedido. No es el flujo principal y puede marcarse como deprecado cuando no existan datos antiguos por corregir.
- Un pedido solo se crea desde una cotizacion `APROBADA`.
- No se crea mas de un pedido por cotizacion.
- El pedido inicia en `PENDIENTE`.
- El cliente solo ve sus pedidos y solo puede agregar observaciones mientras el pedido este `PENDIENTE`.
- Admin y Secretaria pueden asignar `fechaEntregaEstimada` mientras el pedido este `PENDIENTE` o `EN_PROCESO`.
- No se aceptan fechas estimadas de entrega pasadas.
- Las fechas de pedidos se devuelven como texto legible, por ejemplo `15 de junio de 2026`; si el campo no tiene valor, se devuelve `null`.
- El paso a `EN_PROCESO` exige confirmacion manual del primer abono y monto minimo del 50% del total. Esto queda como hook temporal hasta implementar la API de Abonos.
- Un pedido solo puede finalizar si esta `EN_PROCESO`.
- Un pedido solo puede anularse si sigue `PENDIENTE`.
- No hay eliminacion fisica de pedidos desde esta API.

---

## Crear pedido desde cotizacion aprobada

Roles permitidos:

```txt
Admin, Secretaria
```

```http
POST /api/pedidos
```

### Body

```json
{
  "idCotizacion": 12,
  "fechaEntregaEstimada": "2026-06-15",
  "observaciones": "Cliente aprobo condiciones y tiempos."
}
```

Notas:

- Este endpoint se mantiene para recuperacion/backfill. El flujo normal crea el pedido desde `PATCH /api/cotizaciones/:id/aprobar`.
- Si se envia `fechaEntregaEstimada`, no puede ser una fecha pasada.
- La respuesta devuelve las fechas de pedido en formato legible.

---

## Listar pedidos

Roles permitidos:

```txt
Admin, Secretaria, Cliente
```

```http
GET /api/pedidos
```

Comportamiento:

- Admin y Secretaria ven todos.
- Cliente solo ve sus propios pedidos.

---

## Buscar pedido por ID

Roles permitidos:

```txt
Admin, Secretaria, Cliente
```

```http
GET /api/pedidos/:id
```

---

## Buscar pedidos parcialmente

Roles permitidos:

```txt
Admin, Secretaria, Cliente
```

```http
GET /api/pedidos/buscar?termino=pendiente
```

Busca por:

- ID de pedido.
- ID de cotizacion.
- Estado.
- Nombre del cliente.

---

## Actualizar pedido

Roles permitidos:

```txt
Admin, Secretaria, Cliente
```

```http
PATCH /api/pedidos/:id
```

Comportamiento por rol:

- Cliente: solo puede enviar `observaciones`, y solo si el pedido esta `PENDIENTE`.
- Admin y Secretaria: pueden enviar `observaciones` y/o `fechaEntregaEstimada`.
- `fechaEntregaEstimada` solo se puede asignar o actualizar si el pedido esta `PENDIENTE` o `EN_PROCESO`.
- `fechaEntregaEstimada` no puede ser una fecha pasada.

### Body cliente

```json
{
  "observaciones": "Confirmo direccion de entrega."
}
```

### Body Admin/Secretaria

```json
{
  "fechaEntregaEstimada": "2026-06-15",
  "observaciones": "Entrega estimada asignada por secretaria."
}
```

---

## Pasar pedido a EN_PROCESO

Roles permitidos:

```txt
Admin, Secretaria
```

```http
PATCH /api/pedidos/:id/en-proceso
```

Hook temporal para la futura API de Abonos. No crea registros en `Abonos`, pero valida la confirmacion y registra el resumen de pago en el pedido.

### Body

```json
{
  "abonoConfirmado": true,
  "montoPrimerAbono": 50000,
  "observaciones": "Primer abono confirmado por transferencia."
}
```

---

## Finalizar pedido

Roles permitidos:

```txt
Admin, Secretaria
```

```http
PATCH /api/pedidos/:id/finalizar
```

Solo permitido si el pedido esta `EN_PROCESO`.

### Body

```json
{
  "fechaEntregado": "2026-06-20",
  "observaciones": "Produccion entregada al cliente."
}
```

---

## Anular pedido

Roles permitidos:

```txt
Admin, Secretaria
```

```http
PATCH /api/pedidos/:id/anular
```

Solo permitido si el pedido esta `PENDIENTE`, antes de iniciar produccion.

### Body

```json
{
  "observaciones": "Cliente cancelo antes del primer abono."
}
```

---

# 7. Proveedores

Modulo interno. Todas las rutas usan JWT. Cliente no tiene acceso a proveedores.

```http
POST /api/proveedores
GET /api/proveedores
GET /api/proveedores/buscar?termino=dtf
GET /api/proveedores/:id
PATCH /api/proveedores/:id
DELETE /api/proveedores/:id
DELETE /api/proveedores/:id/eliminar
```

Roles:

- Crear, listar, buscar, consultar, actualizar y desactivar: `Admin`, `Secretaria`.
- Eliminar fisicamente: `Admin`.

Reglas principales:

- `nombre` es obligatorio y unico.
- `telefono`, `correo` y `direccion` son opcionales.
- `correo`, si se envia, debe tener formato valido.
- `DELETE /api/proveedores/:id` hace eliminacion logica con `estado=false`.
- `DELETE /api/proveedores/:id/eliminar` solo elimina si no tiene compras asociadas.
- Un proveedor inactivo no puede usarse en compras nuevas.

---

# 8. Compras

Modulo interno de operacion. Cliente no tiene acceso a compras, proveedores, costos, subtotales ni totales de compra. Admin y Secretaria gestionan el modulo. Disenador solo consulta compras asociadas a pedidos y recibe una vista reducida sin proveedor, comprador ni valores financieros.

Estados validos:

```txt
PENDIENTE, COMPRADA, ANULADA
```

Calculos del backend:

```txt
subtotalDetalle = cantidad * costoUnitario
totalCompra = suma de subtotales
```

```http
POST /api/compras
GET /api/compras?idPedido=8
GET /api/compras/resumen
GET /api/compras/:id
GET /api/pedidos/:idPedido/compras
PATCH /api/compras/:id
PATCH /api/compras/:id/confirmar
PATCH /api/compras/:id/anular
DELETE /api/compras/:id
```

Roles:

- Crear, actualizar, confirmar, anular, eliminar y ver resumen: `Admin`, `Secretaria`.
- Consultar por pedido o por id: `Admin`, `Secretaria`, `Disenador`.
- Cliente: sin acceso.

Crear compra:

```json
{
  "idPedido": 8,
  "idProveedor": 2,
  "observaciones": "Compra de insumos para pedido urgente.",
  "confirmar": false,
  "detalles": [
    {
      "descripcionInsumo": "Pelicula DTF",
      "cantidad": 2,
      "costoUnitario": 45000
    }
  ]
}
```

Reglas principales:

- Toda compra pertenece a un pedido y a un proveedor.
- `compradoPorId` sale del usuario autenticado.
- No se aceptan `subtotal` ni `total` desde frontend.
- Cada compra requiere minimo un detalle.
- `cantidad` y `costoUnitario` deben ser mayores a cero.
- Solo se crean compras para pedidos `PENDIENTE` o `EN_PROCESO`; no para `FINALIZADO`.
- Solo compras `PENDIENTE` pueden actualizarse, confirmarse, anularse o eliminarse.
- Confirmar cambia estado a `COMPRADA`.
- Anular cambia estado a `ANULADA` y conserva detalles.
- Eliminar borra fisicamente solo compras `PENDIENTE`; los detalles caen por cascade.
- `/api/compras/resumen` no esta disponible para `Disenador`.

---

# 9. Credenciales de prueba

## Admin

```json
{
  "correo": "admin@pixel.com",
  "contrasena": "admin123"
}
```

## Secretaria

```json
{
  "correo": "ana.gomez@gmail.com",
  "contrasena": "secret123"
}
```

## Disenador

```json
{
  "correo": "luis.martinez@gmail.com",
  "contrasena": "diseno123"
}
```

## Cliente

```json
{
  "correo": "juan.cliente@gmail.com",
  "contrasena": "123456"
}
```

---

# 10. Errores comunes

## Token no enviado

```json
{
  "message": "Token no proporcionado."
}
```

## Token invalido

```json
{
  "message": "Token invalido o expirado."
}
```

## Sin permisos

```json
{
  "message": "No tienes permisos para realizar esta accion."
}
```

## Sin resultados

```json
{
  "message": "No se encontraron resultados."
}
```

## Tecnica inexistente

```json
{
  "message": "La tecnica con ID 99 no existe."
}
```

---

# 11. Orden recomendado de prueba

```txt
1. Crear roles
2. Crear usuarios internos
3. Hacer login
4. Copiar token
5. Crear tecnicas
6. Crear solicitud como cliente o solicitud presencial
7. Cotizar solicitud como Admin/Secretaria
8. Aprobar, anular o eliminar la cotizacion
9. Crear pedido desde la cotizacion aprobada
10. Confirmar primer abono para pasar el pedido a EN_PROCESO
11. Finalizar o anular segun el estado del flujo
```
