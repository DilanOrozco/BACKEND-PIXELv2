-- Clientes externos sin autenticacion.
CREATE TABLE IF NOT EXISTS "clientes" (
  "id_cliente" SERIAL PRIMARY KEY,
  "nombre" VARCHAR(100) NOT NULL,
  "documento" VARCHAR(30),
  "correo" VARCHAR(100),
  "telefono" VARCHAR(20),
  "direccion" VARCHAR(150),
  "estado" BOOLEAN NOT NULL DEFAULT true,
  "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "fecha_actualizacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "clientes_correo_idx" ON "clientes"("correo");
CREATE INDEX IF NOT EXISTS "clientes_telefono_idx" ON "clientes"("telefono");
CREATE INDEX IF NOT EXISTS "clientes_documento_idx" ON "clientes"("documento");

-- Preserva compatibilidad: los id_cliente existentes apuntaban a usuarios.
INSERT INTO "clientes" (
  "id_cliente",
  "nombre",
  "documento",
  "correo",
  "telefono",
  "direccion",
  "estado",
  "fecha_creacion",
  "fecha_actualizacion"
)
SELECT DISTINCT
  u."id_usuario",
  u."nombre",
  u."documento",
  u."correo",
  u."telefono",
  u."direccion",
  u."estado",
  u."fecha_creacion",
  u."fecha_actualizacion"
FROM "usuarios" u
WHERE u."id_usuario" IN (
  SELECT "id_cliente" FROM "cotizaciones"
  UNION
  SELECT "id_cliente" FROM "pedidos"
)
ON CONFLICT ("id_cliente") DO NOTHING;

SELECT setval(
  pg_get_serial_sequence('"clientes"', 'id_cliente'),
  GREATEST(COALESCE((SELECT MAX("id_cliente") FROM "clientes"), 1), 1),
  true
);

CREATE TABLE IF NOT EXISTS "productos_cotizables" (
  "id_producto" SERIAL PRIMARY KEY,
  "nombre" VARCHAR(150) NOT NULL,
  "descripcion" VARCHAR(255),
  "precio_base" DECIMAL(10, 2) NOT NULL,
  "estado" BOOLEAN NOT NULL DEFAULT true,
  "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "fecha_actualizacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "productos_cotizables_nombre_key"
ON "productos_cotizables"("nombre");

CREATE TABLE IF NOT EXISTS "precios_producto_rangos" (
  "id_rango" SERIAL PRIMARY KEY,
  "id_producto" INTEGER NOT NULL,
  "cantidad_min" INTEGER NOT NULL,
  "descuento_porcentaje" DECIMAL(5, 2) NOT NULL DEFAULT 0,
  "estado" BOOLEAN NOT NULL DEFAULT true,
  "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "fecha_actualizacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "precios_producto_rangos_id_producto_fkey"
    FOREIGN KEY ("id_producto") REFERENCES "productos_cotizables"("id_producto")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "precios_producto_rangos_cantidad_min_check"
    CHECK ("cantidad_min" > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS "precios_producto_rangos_id_producto_cantidad_min_key"
ON "precios_producto_rangos"("id_producto", "cantidad_min");

CREATE INDEX IF NOT EXISTS "precios_producto_rangos_id_producto_estado_cantidad_min_idx"
ON "precios_producto_rangos"("id_producto", "estado", "cantidad_min");

ALTER TABLE "cotizaciones" DROP CONSTRAINT IF EXISTS "cotizaciones_id_cliente_fkey";
ALTER TABLE "cotizaciones"
ADD CONSTRAINT "cotizaciones_id_cliente_fkey"
FOREIGN KEY ("id_cliente") REFERENCES "clientes"("id_cliente")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "pedidos" DROP CONSTRAINT IF EXISTS "pedidos_id_cliente_fkey";
ALTER TABLE "pedidos"
ADD CONSTRAINT "pedidos_id_cliente_fkey"
FOREIGN KEY ("id_cliente") REFERENCES "clientes"("id_cliente")
ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "cotizaciones_id_cliente_fecha_creacion_idx"
ON "cotizaciones"("id_cliente", "fecha_creacion");

CREATE INDEX IF NOT EXISTS "pedidos_id_cliente_fecha_creacion_idx"
ON "pedidos"("id_cliente", "fecha_creacion");

CREATE INDEX IF NOT EXISTS "pedidos_id_cotizacion_idx"
ON "pedidos"("id_cotizacion");

ALTER TABLE "detalle_cotizacion" ADD COLUMN IF NOT EXISTS "id_producto" INTEGER;
ALTER TABLE "detalle_cotizacion" ADD COLUMN IF NOT EXISTS "precio_base" DECIMAL(10, 2);
ALTER TABLE "detalle_cotizacion" ADD COLUMN IF NOT EXISTS "descuento_porcentaje" DECIMAL(5, 2) DEFAULT 0;
ALTER TABLE "detalle_cotizacion" ALTER COLUMN "id_tecnica" DROP NOT NULL;

ALTER TABLE "detalle_cotizacion" DROP CONSTRAINT IF EXISTS "detalle_cotizacion_id_tecnica_fkey";
ALTER TABLE "detalle_cotizacion"
ADD CONSTRAINT "detalle_cotizacion_id_tecnica_fkey"
FOREIGN KEY ("id_tecnica") REFERENCES "tecnicas"("id_tecnica")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "detalle_cotizacion" DROP CONSTRAINT IF EXISTS "detalle_cotizacion_id_producto_fkey";
ALTER TABLE "detalle_cotizacion"
ADD CONSTRAINT "detalle_cotizacion_id_producto_fkey"
FOREIGN KEY ("id_producto") REFERENCES "productos_cotizables"("id_producto")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "detalle_pedido" ADD COLUMN IF NOT EXISTS "id_producto" INTEGER;
ALTER TABLE "detalle_pedido" ALTER COLUMN "id_tecnica" DROP NOT NULL;

ALTER TABLE "detalle_pedido" DROP CONSTRAINT IF EXISTS "detalle_pedido_id_tecnica_fkey";
ALTER TABLE "detalle_pedido"
ADD CONSTRAINT "detalle_pedido_id_tecnica_fkey"
FOREIGN KEY ("id_tecnica") REFERENCES "tecnicas"("id_tecnica")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "detalle_pedido" DROP CONSTRAINT IF EXISTS "detalle_pedido_id_producto_fkey";
ALTER TABLE "detalle_pedido"
ADD CONSTRAINT "detalle_pedido_id_producto_fkey"
FOREIGN KEY ("id_producto") REFERENCES "productos_cotizables"("id_producto")
ON DELETE SET NULL ON UPDATE CASCADE;

