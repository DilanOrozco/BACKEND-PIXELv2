-- Abonos + disenos + reglas de produccion.

-- EstadoPedido queda limitado a los 3 estados del flujo principal.
-- Los registros historicos ANULADO se conservan como PENDIENTE con nota de auditoria.
UPDATE "pedidos"
SET
  "estadoPedido" = 'PENDIENTE',
  "observaciones" = COALESCE("observaciones" || E'\n', '') || '[migracion] Estado ANULADO migrado a PENDIENTE al limitar EstadoPedido al flujo principal.'
WHERE "estadoPedido" = 'ANULADO';

ALTER TABLE "pedidos" ALTER COLUMN "estadoPedido" DROP DEFAULT;
ALTER TYPE "EstadoPedido" RENAME TO "EstadoPedido_old";
CREATE TYPE "EstadoPedido" AS ENUM ('PENDIENTE', 'EN_PROCESO', 'FINALIZADO');
ALTER TABLE "pedidos" ALTER COLUMN "estadoPedido" TYPE "EstadoPedido" USING "estadoPedido"::text::"EstadoPedido";
ALTER TABLE "pedidos" ALTER COLUMN "estadoPedido" SET DEFAULT 'PENDIENTE';
DROP TYPE "EstadoPedido_old";

-- EstadoAbono ahora permite rechazos trazables.
ALTER TYPE "EstadoAbono" ADD VALUE IF NOT EXISTS 'RECHAZADO';

-- Estado propio del montaje/diseno.
CREATE TYPE "EstadoDiseno" AS ENUM ('PENDIENTE', 'ENVIADO', 'APROBADO');

-- Trazabilidad adicional de abonos.
ALTER TABLE "abonos"
ADD COLUMN "comprobante_url" TEXT,
ADD COLUMN "rechazado_por_id" INTEGER,
ADD COLUMN "fecha_rechazo" TIMESTAMP(3),
ADD COLUMN "motivo_rechazo" TEXT;

ALTER TABLE "abonos"
ADD CONSTRAINT "abonos_rechazado_por_id_fkey"
FOREIGN KEY ("rechazado_por_id") REFERENCES "usuarios"("id_usuario")
ON DELETE SET NULL ON UPDATE CASCADE;

-- Versiones de diseno/montaje asociadas a pedidos.
CREATE TABLE "disenos" (
    "id_diseno" SERIAL NOT NULL,
    "id_pedido" INTEGER NOT NULL,
    "id_disenador" INTEGER,
    "archivo_url" TEXT,
    "descripcion" TEXT,
    "observaciones" TEXT,
    "estado" "EstadoDiseno" NOT NULL DEFAULT 'PENDIENTE',
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_actualizacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_envio" TIMESTAMP(3),
    "fecha_aprobacion" TIMESTAMP(3),

    CONSTRAINT "disenos_pkey" PRIMARY KEY ("id_diseno")
);

ALTER TABLE "disenos"
ADD CONSTRAINT "disenos_id_pedido_fkey"
FOREIGN KEY ("id_pedido") REFERENCES "pedidos"("id_pedido")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "disenos"
ADD CONSTRAINT "disenos_id_disenador_fkey"
FOREIGN KEY ("id_disenador") REFERENCES "usuarios"("id_usuario")
ON DELETE SET NULL ON UPDATE CASCADE;
