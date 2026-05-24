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
```

Reglas principales:

- El nombre no puede estar vacio.
- El nombre no puede repetirse.
- La descripcion debe tener minimo 5 caracteres.
- `DELETE` no elimina fisicamente; cambia el estado.

---

# 3. Usuarios

```http
POST /api/usuarios
GET /api/usuarios
GET /api/usuarios/buscar?termino=juan
GET /api/usuarios/:id
PATCH /api/usuarios/:id
DELETE /api/usuarios/:id
```

Reglas principales:

- El correo debe ser valido y unico.
- El documento debe ser unico.
- La contrasena debe tener minimo 6 caracteres.
- El rol debe existir.
- La API no devuelve `contrasenaHash`.
- `DELETE` no elimina fisicamente; cambia `estado` a `false`.

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
```

Roles:

- Crear, actualizar y desactivar: `Admin`, `Secretaria`.
- Listar y consultar: `Admin`, `Secretaria`, `Cliente`.

---

# 5. Cotizaciones

La cotizacion inicia el flujo comercial de PIXEL. Todas las rutas usan JWT y devuelven el `cotizacionSelect`, incluyendo `cliente`, `creadoPor` y `detalles.tecnica`.

Estados validos:

```txt
SOLICITADA, COTIZADA, APROBADA, RECHAZADA, ANULADA
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
- No se eliminan cotizaciones; se cambia el estado.
- Una cotizacion `APROBADA`, `RECHAZADA` o `ANULADA` no se edita.

---

## Crear solicitud como cliente

Roles permitidos:

```txt
Cliente
```

```http
POST /api/cotizaciones/cliente
```

El `idCliente` sale del token. Estado inicial: `SOLICITADA`.

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

- La cotizacion pertenece al cliente autenticado.
- El estado actual es `SOLICITADA`.

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
Cliente
```

```http
PATCH /api/cotizaciones/:id/anular
```

Solo permitido si:

- La cotizacion pertenece al cliente autenticado.
- El estado actual es `SOLICITADA`.

Resultado:

```txt
estado = ANULADA
```

---

## Aprobar cotizacion

Roles permitidos:

```txt
Cliente
```

```http
PATCH /api/cotizaciones/:id/aprobar
```

Solo permitido si:

- La cotizacion pertenece al cliente autenticado.
- El estado actual es `COTIZADA`.

Resultado:

```txt
estado = APROBADA
```

---

## Rechazar cotizacion

Roles permitidos:

```txt
Cliente
```

```http
PATCH /api/cotizaciones/:id/rechazar
```

Solo permitido si:

- La cotizacion pertenece al cliente autenticado.
- El estado actual es `COTIZADA`.

Resultado:

```txt
estado = RECHAZADA
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

Admin o Secretaria selecciona el cliente. Estado inicial: `SOLICITADA`.

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

Asigna precios, costos de diseno, costos adicionales y observaciones de empresa. Cambia el estado a `COTIZADA`.

Solo permitido si el estado actual es `SOLICITADA`.

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

## Crear cotizacion rapida

Roles permitidos:

```txt
Admin, Secretaria
```

```http
POST /api/cotizaciones/rapida
```

Cotizacion presencial con precios ya asignados. Nace `APROBADA` y devuelve un `pedidoSimulado` mientras no exista el modulo de pedidos.
Debe tener un unico detalle con precios completos.

### Body

```json
{
  "idCliente": 4,
  "costosAdicionales": 0,
  "observaciones": "Cliente presencial desea hacer pedido inmediato",
  "detalles": [
    {
      "idTecnica": 1,
      "descripcion": "Gorra bordada color negro",
      "cantidad": 5,
      "precioUnitario": 35000,
      "costoDiseno": 20000,
      "imagenReferencia": null,
      "observaciones": "Logo pequeno frontal"
    }
  ]
}
```

### Respuesta parcial

```json
{
  "message": "Cotizacion rapida creada, aprobada y con pedido simulado.",
  "data": {
    "idCotizacion": 20,
    "estado": "APROBADA",
    "tipoCotizacion": "RAPIDA",
    "subtotal": "195000",
    "costosAdicionales": "0",
    "total": "195000",
    "pedidoSimulado": {
      "generado": true,
      "mensaje": "Pedido simulado. El modulo de pedidos aun no esta implementado."
    }
  }
}
```

---

## Actualizar observaciones o costos adicionales

Roles permitidos:

```txt
Admin, Secretaria
```

```http
PATCH /api/cotizaciones/:id
```

Solo permitido si la cotizacion esta en `SOLICITADA` o `COTIZADA`.

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
GET /api/cotizaciones/buscar?termino=solicitada
```

Busca por:

- Estado.
- Tipo de cotizacion.
- Nombre del cliente.

---

# 6. Credenciales de prueba

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

# 7. Errores comunes

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

# 8. Orden recomendado de prueba

```txt
1. Crear roles
2. Crear usuarios internos
3. Hacer login
4. Copiar token
5. Crear tecnicas
6. Crear solicitud como cliente o solicitud presencial
7. Cotizar solicitud como Admin/Secretaria
8. Aprobar, rechazar o anular como cliente
9. Crear cotizacion rapida
```
