-- CreateEnum
CREATE TYPE "TipoProductoCotizacion" AS ENUM ('CATALOGO', 'OTRO');

-- CreateEnum
CREATE TYPE "SuministradoPorProducto" AS ENUM ('PIXEL', 'CLIENTE');

-- CreateEnum
CREATE TYPE "EstadoCotizacionVersion" AS ENUM ('BORRADOR', 'ENVIADA', 'ACEPTADA', 'RECHAZADA', 'AJUSTE_SOLICITADO', 'VENCIDA', 'INVALIDADA');

-- CreateEnum
CREATE TYPE "DecisionCotizacion" AS ENUM ('ACEPTAR', 'RECHAZAR', 'SOLICITAR_AJUSTE');

-- CreateEnum
CREATE TYPE "ActorRespuestaCotizacion" AS ENUM ('CLIENTE', 'USUARIO_INTERNO');

-- CreateEnum
CREATE TYPE "MedioRespuestaCotizacion" AS ENUM ('SISTEMA', 'WHATSAPP', 'LLAMADA', 'CORREO', 'PRESENCIAL', 'OTRO');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "EstadoCotizacion" ADD VALUE 'BORRADOR';
ALTER TYPE "EstadoCotizacion" ADD VALUE 'SOLICITUD_RECIBIDA';
ALTER TYPE "EstadoCotizacion" ADD VALUE 'EN_REVISION';
ALTER TYPE "EstadoCotizacion" ADD VALUE 'PENDIENTE_APROBACION_CLIENTE';
ALTER TYPE "EstadoCotizacion" ADD VALUE 'AJUSTE_SOLICITADO';
ALTER TYPE "EstadoCotizacion" ADD VALUE 'ACEPTADA';
ALTER TYPE "EstadoCotizacion" ADD VALUE 'RECHAZADA_CLIENTE';
ALTER TYPE "EstadoCotizacion" ADD VALUE 'VENCIDA';
ALTER TYPE "EstadoCotizacion" ADD VALUE 'CONVERTIDA_EN_PEDIDO';

-- AlterTable
ALTER TABLE "cotizaciones" ADD COLUMN     "advertencias_internas" JSONB,
ADD COLUMN     "observaciones_internas" TEXT,
ADD COLUMN     "precio_sugerido_interno" DECIMAL(12,2),
ADD COLUMN     "requiere_revision_precio" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "detalle_cotizacion" ADD COLUMN     "descripcion_personalizada" VARCHAR(500),
ADD COLUMN     "material_referencia" VARCHAR(255),
ADD COLUMN     "nombre_personalizado" VARCHAR(150),
ADD COLUMN     "precio_sugerido_interno" DECIMAL(12,2),
ADD COLUMN     "requiere_revision_precio" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "subtotal_sugerido_interno" DECIMAL(12,2),
ADD COLUMN     "suministrado_por" "SuministradoPorProducto" NOT NULL DEFAULT 'PIXEL',
ADD COLUMN     "tipo_producto" "TipoProductoCotizacion" NOT NULL DEFAULT 'CATALOGO';

-- AlterTable
ALTER TABLE "detalle_pedido" ADD COLUMN     "material_referencia" VARCHAR(255),
ADD COLUMN     "nombre_personalizado" VARCHAR(150),
ADD COLUMN     "suministrado_por" "SuministradoPorProducto" NOT NULL DEFAULT 'PIXEL',
ADD COLUMN     "tipo_producto" "TipoProductoCotizacion" NOT NULL DEFAULT 'CATALOGO';

-- AlterTable
ALTER TABLE "pedidos" ADD COLUMN     "id_cotizacion_version" INTEGER;

-- AlterTable
ALTER TABLE "productos_cotizables" ADD COLUMN     "requiere_diseno" BOOLEAN NOT NULL DEFAULT true,
ALTER COLUMN "precio_base" DROP NOT NULL;

-- CreateTable
CREATE TABLE "tarifas_tecnica" (
    "id_tarifa" SERIAL NOT NULL,
    "id_tecnica" INTEGER NOT NULL,
    "ancho_hasta_cm" DECIMAL(8,2) NOT NULL,
    "alto_hasta_cm" DECIMAL(8,2) NOT NULL,
    "precio_unitario" DECIMAL(12,2) NOT NULL,
    "estado" BOOLEAN NOT NULL DEFAULT true,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_actualizacion" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tarifas_tecnica_pkey" PRIMARY KEY ("id_tarifa")
);

-- CreateTable
CREATE TABLE "descuentos_tecnica" (
    "id_descuento" SERIAL NOT NULL,
    "id_tecnica" INTEGER NOT NULL,
    "cantidad_minima" INTEGER NOT NULL,
    "porcentaje" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "estado" BOOLEAN NOT NULL DEFAULT true,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_actualizacion" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "descuentos_tecnica_pkey" PRIMARY KEY ("id_descuento")
);

-- CreateTable
CREATE TABLE "detalle_estampado_cotizacion" (
    "id_detalle_estampado_cotizacion" SERIAL NOT NULL,
    "id_detalle_cotizacion" INTEGER NOT NULL,
    "id_tecnica" INTEGER NOT NULL,
    "id_tarifa_aplicada" INTEGER,
    "ubicacion" VARCHAR(100) NOT NULL,
    "ancho_cm" DECIMAL(8,2) NOT NULL,
    "alto_cm" DECIMAL(8,2) NOT NULL,
    "descripcion" VARCHAR(500),
    "observaciones" VARCHAR(500),
    "origen_diseno" VARCHAR(30) NOT NULL DEFAULT 'PENDIENTE_DEFINIR',
    "grupo_diseno_compartido" VARCHAR(100),
    "tarifa_ancho_snapshot" DECIMAL(8,2),
    "tarifa_alto_snapshot" DECIMAL(8,2),
    "precio_unitario_sugerido" DECIMAL(12,2),
    "descuento_porcentaje_snapshot" DECIMAL(5,2),
    "subtotal_bruto_sugerido" DECIMAL(12,2),
    "descuento_total_sugerido" DECIMAL(12,2),
    "subtotal_sugerido" DECIMAL(12,2),
    "costo_diseno_sugerido" DECIMAL(12,2),
    "requiere_revision_precio" BOOLEAN NOT NULL DEFAULT false,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_actualizacion" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "detalle_estampado_cotizacion_pkey" PRIMARY KEY ("id_detalle_estampado_cotizacion")
);

-- CreateTable
CREATE TABLE "cotizaciones_versiones" (
    "id_version" SERIAL NOT NULL,
    "id_cotizacion" INTEGER NOT NULL,
    "numero_version" INTEGER NOT NULL,
    "precio_sugerido_interno" DECIMAL(12,2),
    "precio_final" DECIMAL(12,2) NOT NULL,
    "descuento_manual" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "costos_adicionales" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "desglose_visible" JSONB NOT NULL,
    "snapshot_completo" JSONB NOT NULL,
    "observaciones_cliente" TEXT,
    "observaciones_internas" TEXT,
    "mensaje_cliente" TEXT,
    "valida_hasta" TIMESTAMP(3) NOT NULL,
    "enviada_at" TIMESTAMP(3),
    "estado" "EstadoCotizacionVersion" NOT NULL DEFAULT 'BORRADOR',
    "es_vigente" BOOLEAN NOT NULL DEFAULT false,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_actualizacion" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cotizaciones_versiones_pkey" PRIMARY KEY ("id_version")
);

-- CreateTable
CREATE TABLE "cotizaciones_respuestas" (
    "id_respuesta" SERIAL NOT NULL,
    "id_cotizacion" INTEGER NOT NULL,
    "id_version" INTEGER NOT NULL,
    "decision" "DecisionCotizacion" NOT NULL,
    "actor" "ActorRespuestaCotizacion" NOT NULL,
    "id_usuario_interno" INTEGER,
    "id_cliente" INTEGER NOT NULL,
    "medio" "MedioRespuestaCotizacion" NOT NULL,
    "fecha_respuesta" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "observaciones" TEXT,
    "evidencia_url" VARCHAR(500),
    "precio_aceptado" DECIMAL(12,2),
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cotizaciones_respuestas_pkey" PRIMARY KEY ("id_respuesta")
);

-- CreateTable
CREATE TABLE "detalle_estampado_pedido" (
    "id_detalle_estampado_pedido" SERIAL NOT NULL,
    "id_detalle_pedido" INTEGER NOT NULL,
    "id_tecnica" INTEGER NOT NULL,
    "ubicacion" VARCHAR(100) NOT NULL,
    "ancho_cm" DECIMAL(8,2) NOT NULL,
    "alto_cm" DECIMAL(8,2) NOT NULL,
    "descripcion" VARCHAR(500),
    "observaciones" VARCHAR(500),
    "origen_diseno" VARCHAR(30) NOT NULL DEFAULT 'PENDIENTE_DEFINIR',
    "grupo_diseno_compartido" VARCHAR(100),
    "precio_unitario" DECIMAL(12,2) NOT NULL,
    "descuento_porcentaje" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "subtotal_bruto" DECIMAL(12,2) NOT NULL,
    "descuento_total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "detalle_estampado_pedido_pkey" PRIMARY KEY ("id_detalle_estampado_pedido")
);

-- CreateIndex
CREATE INDEX "tarifas_tecnica_id_tecnica_estado_ancho_hasta_cm_alto_hasta_idx" ON "tarifas_tecnica"("id_tecnica", "estado", "ancho_hasta_cm", "alto_hasta_cm");

-- CreateIndex
CREATE UNIQUE INDEX "tarifas_tecnica_id_tecnica_ancho_hasta_cm_alto_hasta_cm_key" ON "tarifas_tecnica"("id_tecnica", "ancho_hasta_cm", "alto_hasta_cm");

-- CreateIndex
CREATE INDEX "descuentos_tecnica_id_tecnica_estado_cantidad_minima_idx" ON "descuentos_tecnica"("id_tecnica", "estado", "cantidad_minima");

-- CreateIndex
CREATE UNIQUE INDEX "descuentos_tecnica_id_tecnica_cantidad_minima_key" ON "descuentos_tecnica"("id_tecnica", "cantidad_minima");

-- CreateIndex
CREATE INDEX "detalle_estampado_cotizacion_id_detalle_cotizacion_idx" ON "detalle_estampado_cotizacion"("id_detalle_cotizacion");

-- CreateIndex
CREATE INDEX "detalle_estampado_cotizacion_id_tecnica_ancho_cm_alto_cm_idx" ON "detalle_estampado_cotizacion"("id_tecnica", "ancho_cm", "alto_cm");

-- CreateIndex
CREATE INDEX "cotizaciones_versiones_id_cotizacion_es_vigente_estado_idx" ON "cotizaciones_versiones"("id_cotizacion", "es_vigente", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "cotizaciones_versiones_id_cotizacion_numero_version_key" ON "cotizaciones_versiones"("id_cotizacion", "numero_version");

-- CreateIndex
CREATE UNIQUE INDEX "cotizaciones_respuestas_id_version_key" ON "cotizaciones_respuestas"("id_version");

-- CreateIndex
CREATE INDEX "cotizaciones_respuestas_id_cotizacion_fecha_respuesta_idx" ON "cotizaciones_respuestas"("id_cotizacion", "fecha_respuesta");

-- CreateIndex
CREATE INDEX "detalle_estampado_pedido_id_detalle_pedido_idx" ON "detalle_estampado_pedido"("id_detalle_pedido");

-- CreateIndex
CREATE INDEX "detalle_cotizacion_id_cotizacion_idx" ON "detalle_cotizacion"("id_cotizacion");

-- CreateIndex
CREATE UNIQUE INDEX "pedidos_id_cotizacion_key" ON "pedidos"("id_cotizacion");

-- CreateIndex
CREATE UNIQUE INDEX "pedidos_id_cotizacion_version_key" ON "pedidos"("id_cotizacion_version");

-- AddForeignKey
ALTER TABLE "tarifas_tecnica" ADD CONSTRAINT "tarifas_tecnica_id_tecnica_fkey" FOREIGN KEY ("id_tecnica") REFERENCES "tecnicas"("id_tecnica") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "descuentos_tecnica" ADD CONSTRAINT "descuentos_tecnica_id_tecnica_fkey" FOREIGN KEY ("id_tecnica") REFERENCES "tecnicas"("id_tecnica") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detalle_estampado_cotizacion" ADD CONSTRAINT "detalle_estampado_cotizacion_id_detalle_cotizacion_fkey" FOREIGN KEY ("id_detalle_cotizacion") REFERENCES "detalle_cotizacion"("id_detalle_cotizacion") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detalle_estampado_cotizacion" ADD CONSTRAINT "detalle_estampado_cotizacion_id_tecnica_fkey" FOREIGN KEY ("id_tecnica") REFERENCES "tecnicas"("id_tecnica") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detalle_estampado_cotizacion" ADD CONSTRAINT "detalle_estampado_cotizacion_id_tarifa_aplicada_fkey" FOREIGN KEY ("id_tarifa_aplicada") REFERENCES "tarifas_tecnica"("id_tarifa") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cotizaciones_versiones" ADD CONSTRAINT "cotizaciones_versiones_id_cotizacion_fkey" FOREIGN KEY ("id_cotizacion") REFERENCES "cotizaciones"("id_cotizacion") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cotizaciones_respuestas" ADD CONSTRAINT "cotizaciones_respuestas_id_cotizacion_fkey" FOREIGN KEY ("id_cotizacion") REFERENCES "cotizaciones"("id_cotizacion") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cotizaciones_respuestas" ADD CONSTRAINT "cotizaciones_respuestas_id_version_fkey" FOREIGN KEY ("id_version") REFERENCES "cotizaciones_versiones"("id_version") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cotizaciones_respuestas" ADD CONSTRAINT "cotizaciones_respuestas_id_cliente_fkey" FOREIGN KEY ("id_cliente") REFERENCES "clientes"("id_cliente") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cotizaciones_respuestas" ADD CONSTRAINT "cotizaciones_respuestas_id_usuario_interno_fkey" FOREIGN KEY ("id_usuario_interno") REFERENCES "usuarios"("id_usuario") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_id_cotizacion_version_fkey" FOREIGN KEY ("id_cotizacion_version") REFERENCES "cotizaciones_versiones"("id_version") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detalle_estampado_pedido" ADD CONSTRAINT "detalle_estampado_pedido_id_detalle_pedido_fkey" FOREIGN KEY ("id_detalle_pedido") REFERENCES "detalle_pedido"("id_detalle_pedido") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detalle_estampado_pedido" ADD CONSTRAINT "detalle_estampado_pedido_id_tecnica_fkey" FOREIGN KEY ("id_tecnica") REFERENCES "tecnicas"("id_tecnica") ON DELETE RESTRICT ON UPDATE CASCADE;
