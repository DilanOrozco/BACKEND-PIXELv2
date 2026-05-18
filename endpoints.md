# Documentación de Endpoints - Backend PIXEL

Base URL sugerida:

```txt
http://localhost:3000/api
```

Para las rutas protegidas se debe enviar el token JWT en los headers:

```txt
Authorization: Bearer TU_TOKEN
Content-Type: application/json
```

---

# 1. Auth

## Registrar cliente

Registra un cliente con rol `Cliente` automáticamente.

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

### Respuesta esperada

```json
{
  "message": "Cliente registrado correctamente.",
  "data": {
    "idUsuario": 5,
    "nombre": "Juan Cliente",
    "telefono": "3001234567",
    "correo": "juan.cliente@gmail.com",
    "estado": true,
    "rol": {
      "idRol": 4,
      "nombre": "Cliente"
    }
  }
}
```

---

## Iniciar sesión

Permite iniciar sesión y obtener el token JWT.

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

### Respuesta esperada

```json
{
  "message": "Inicio de sesión exitoso.",
  "data": {
    "token": "TOKEN_JWT",
    "usuario": {
      "idUsuario": 1,
      "nombre": "Admin Principal",
      "correo": "admin@pixel.com",
      "estado": true,
      "rol": {
        "idRol": 1,
        "nombre": "Admin"
      }
    }
  }
}
```

---

# 2. Roles

## Crear rol

Crea un nuevo rol.

> Actualmente está sin protección inicial si aún no se aplicó middleware.  
> Cuando se proteja, debe ser solo para `Admin`.

```http
POST /api/roles
```

### Body

```json
{
  "nombre": "Admin",
  "descripcion": "Administrador general del sistema"
}
```

### Reglas

- El nombre no puede estar vacío.
- El nombre no puede repetirse.
- La descripción debe tener mínimo 5 caracteres.
- El estado se registra automáticamente como activo.

---

## Listar roles

```http
GET /api/roles
```

### Respuesta esperada

```json
{
  "data": [
    {
      "idRol": 1,
      "nombre": "Admin",
      "descripcion": "Administrador general del sistema",
      "estado": true
    }
  ]
}
```

---

## Buscar roles por nombre

Permite búsqueda parcial.

```http
GET /api/roles/buscar?nombre=admin
```

### Si no hay resultados

```json
{
  "message": "No se encontraron resultados."
}
```

---

## Actualizar rol

Permite actualización parcial.

```http
PATCH /api/roles/:id
```

### Body

```json
{
  "descripcion": "Administrador con acceso completo al sistema"
}
```

### Cambiar estado

```json
{
  "estado": false
}
```

### Reglas

- El nombre no puede estar vacío.
- El nombre no puede repetirse.
- La descripción debe tener mínimo 5 caracteres.
- El estado debe ser booleano: `true` o `false`.

---

## Desactivar rol

No elimina físicamente el rol, solo cambia su estado a inactivo.

```http
DELETE /api/roles/:id
```

### Respuesta esperada

```json
{
  "message": "Rol desactivado correctamente."
}
```

---

# 3. Usuarios

## Crear usuario

Crea usuarios internos como Admin, Secretaria o Diseñador.

```http
POST /api/usuarios
```

### Body

```json
{
  "nombre": "Ana Gómez",
  "documento": "1002003002",
  "telefono": "3019876543",
  "direccion": "Carrera 15 # 8-40",
  "correo": "ana.gomez@gmail.com",
  "contrasena": "secret123",
  "idRol": 2
}
```

### Reglas

- El correo debe tener formato válido.
- El correo debe ser único.
- El documento debe ser único.
- La contraseña debe tener mínimo 6 caracteres.
- El rol debe existir.
- No se permiten campos obligatorios vacíos.
- La contraseña se guarda encriptada con bcrypt.
- La API no debe devolver `contrasenaHash`.

---

## Listar usuarios

```http
GET /api/usuarios
```

### Respuesta esperada

```json
{
  "data": [
    {
      "idUsuario": 1,
      "nombre": "Admin Principal",
      "documento": "1002003004",
      "telefono": "3105557788",
      "direccion": "Oficina Principal",
      "correo": "admin@pixel.com",
      "estado": true,
      "rol": {
        "idRol": 1,
        "nombre": "Admin"
      }
    }
  ]
}
```

---

## Buscar usuario por ID

```http
GET /api/usuarios/:id
```

---

## Buscar usuarios parcialmente

Busca por nombre, correo o documento.

```http
GET /api/usuarios/buscar?termino=juan
```

### Si no hay resultados

```json
{
  "message": "No se encontraron resultados."
}
```

---

## Actualizar usuario

Permite actualización parcial.

```http
PATCH /api/usuarios/:id
```

### Cambiar teléfono

```json
{
  "telefono": "3112223344"
}
```

### Cambiar contraseña

```json
{
  "contrasena": "nueva123"
}
```

### Cambiar rol

> Recomendado solo para Admin cuando las rutas estén protegidas.

```json
{
  "idRol": 2
}
```

### Cambiar estado

```json
{
  "estado": false
}
```

---

## Desactivar usuario

No elimina físicamente el usuario, solo cambia `estado` a `false`.

```http
DELETE /api/usuarios/:id
```

---

# 4. Técnicas

Las técnicas representan los métodos de personalización usados en las cotizaciones.

Ejemplos:

- Sublimación
- Bordado
- DTF
- Vinilo textil

Todas las rutas de técnicas están protegidas con JWT.

---

## Crear técnica

Roles permitidos:

```txt
Admin, Secretaria
```

```http
POST /api/tecnicas
```

### Headers

```txt
Authorization: Bearer TU_TOKEN
```

### Body

```json
{
  "nombre": "Sublimación",
  "descripcion": "Técnica de impresión por calor"
}
```

### Reglas

- El nombre no puede estar vacío.
- El nombre no puede repetirse.
- La descripción debe tener mínimo 5 caracteres.
- El estado se registra automáticamente como activo.

---

## Listar técnicas

Roles permitidos:

```txt
Admin, Secretaria, Cliente
```

```http
GET /api/tecnicas
```

---

## Buscar técnica por ID

Roles permitidos:

```txt
Admin, Secretaria, Cliente
```

```http
GET /api/tecnicas/:id
```

---

## Buscar técnicas parcialmente

Busca por nombre o descripción.

Roles permitidos:

```txt
Admin, Secretaria, Cliente
```

```http
GET /api/tecnicas/buscar?termino=sub
```

### Si no hay resultados

```json
{
  "message": "No se encontraron resultados."
}
```

---

## Actualizar técnica

Roles permitidos:

```txt
Admin, Secretaria
```

```http
PATCH /api/tecnicas/:id
```

### Body

```json
{
  "descripcion": "Técnica actualizada para personalización textil"
}
```

### Cambiar estado

```json
{
  "estado": true
}
```

---

## Desactivar técnica

No elimina físicamente la técnica, solo cambia su estado a inactivo.

Roles permitidos:

```txt
Admin, Secretaria
```

```http
DELETE /api/tecnicas/:id
```

---

# 5. Cotizaciones

La cotización es el inicio obligatorio del flujo comercial de PIXEL.

Reglas principales:

- Sin cotización aprobada no existe pedido.
- Una cotización normal inicia como `PENDIENTE`.
- Una cotización rápida inicia como `APROBADA`.
- La cotización rápida se usa cuando un cliente llega presencialmente y quiere hacer el pedido de una vez.
- Una cotización aprobada o rechazada no debe modificarse.
- El total lo calcula el backend, no el frontend.

Todas las rutas están protegidas con JWT.

---

## Crear cotización normal

Roles permitidos:

```txt
Admin, Secretaria, Cliente
```

```http
POST /api/cotizaciones
```

### Headers

```txt
Authorization: Bearer TU_TOKEN
```

### Body

```json
{
  "idCliente": 4,
  "costosAdicionales": 10000,
  "observaciones": "Cliente solicita camisetas personalizadas",
  "detalles": [
    {
      "idTecnica": 1,
      "descripcion": "Camiseta blanca sublimada talla M",
      "cantidad": 10,
      "precioUnitario": 25000,
      "costoDiseno": 30000,
      "observaciones": "Diseño frontal"
    }
  ]
}
```

### Cálculo del backend

```txt
subtotal detalle = cantidad * precioUnitario + costoDiseno
total cotización = suma de subtotales + costosAdicionales
```

---

## Crear cotización rápida

Usada para cliente presencial que quiere hacer pedido inmediato.

Roles permitidos:

```txt
Admin, Secretaria
```

```http
POST /api/cotizaciones/rapida
```

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
      "observaciones": "Logo pequeño frontal"
    }
  ]
}
```

### Flujo interno

```txt
1. Crear cotización
2. Marcarla como APROBADA
3. Generar pedido automáticamente cuando exista el módulo de pedidos
```

---

## Listar cotizaciones

Roles permitidos:

```txt
Admin, Secretaria, Cliente
```

```http
GET /api/cotizaciones
```

### Comportamiento

- Admin y Secretaria ven todas las cotizaciones.
- Cliente solo ve sus propias cotizaciones.

---

## Buscar cotización por ID

Roles permitidos:

```txt
Admin, Secretaria, Cliente
```

```http
GET /api/cotizaciones/:id
```

### Comportamiento

- Admin y Secretaria pueden ver cualquier cotización.
- Cliente solo puede ver cotizaciones propias.

---

## Buscar cotizaciones parcialmente

Busca por:

- estado
- tipo de cotización
- nombre del cliente

Roles permitidos:

```txt
Admin, Secretaria, Cliente
```

```http
GET /api/cotizaciones/buscar?termino=pendiente
```

### Si no hay resultados

```json
{
  "message": "No se encontraron resultados."
}
```

---

## Actualizar cotización

Solo permite actualizar cotizaciones en estado `PENDIENTE`.

Roles permitidos:

```txt
Admin, Secretaria
```

```http
PATCH /api/cotizaciones/:id
```

### Body

```json
{
  "observaciones": "Cliente pidió ajustar las medidas",
  "costosAdicionales": 15000
}
```

### Reglas

- Solo se puede modificar si está `PENDIENTE`.
- No se deben modificar cotizaciones `APROBADAS` o `RECHAZADAS`.
- Si cambia `costosAdicionales`, el backend recalcula el total.

---

## Aprobar cotización

Roles permitidos:

```txt
Admin, Secretaria, Cliente
```

```http
PATCH /api/cotizaciones/:id/aprobar
```

### Reglas

- Solo se pueden aprobar cotizaciones pendientes.
- En el futuro, al aprobar debe generarse el pedido.

---

## Rechazar cotización

Roles permitidos:

```txt
Admin, Secretaria, Cliente
```

```http
PATCH /api/cotizaciones/:id/rechazar
```

### Reglas

- Solo se pueden rechazar cotizaciones pendientes.
- Una cotización rechazada no genera pedido.

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

## Diseñador

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

## Token inválido

```json
{
  "message": "Token inválido o expirado."
}
```

## Sin permisos

```json
{
  "message": "No tienes permisos para realizar esta acción."
}
```

## Sin resultados

```json
{
  "message": "No se encontraron resultados."
}
```

## Rol inexistente

```json
{
  "message": "El rol debe existir."
}
```

## Técnica inexistente

```json
{
  "message": "La técnica con ID 99 no existe."
}
```

---

# 8. Orden recomendado de prueba

```txt
1. Crear roles
2. Crear usuarios internos
3. Hacer login
4. Copiar token
5. Crear técnicas
6. Crear cotización normal
7. Aprobar o rechazar cotización
8. Crear cotización rápida
```
