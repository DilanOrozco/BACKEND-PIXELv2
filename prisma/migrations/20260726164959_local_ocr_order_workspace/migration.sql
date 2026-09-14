-- CreateEnum
CREATE TYPE "EstadoVenta" AS ENUM ('PARCIAL', 'COMPLETA', 'ANULADA');

-- AlterTable
ALTER TABLE "abonos" ADD COLUMN     "banco_detectado_ocr" VARCHAR(100),
ADD COLUMN     "comprobante_hash" VARCHAR(64),
ADD COLUMN     "comprobante_mime_type" VARCHAR(100),
ADD COLUMN     "comprobante_path" VARCHAR(500),
ADD COLUMN     "comprobante_size_bytes" INTEGER,
ADD COLUMN     "comprobante_subido_en" TIMESTAMP(3),
ADD COLUMN     "confianza_ocr" DECIMAL(5,2),
ADD COLUMN     "corregido_por_id" INTEGER,
ADD COLUMN     "fecha_correccion" TIMESTAMP(3),
ADD COLUMN     "fecha_detectada_ocr" TIMESTAMP(3),
ADD COLUMN     "fecha_pago" TIMESTAMP(3),
ADD COLUMN     "monto_detectado_ocr" DECIMAL(10,2),
ADD COLUMN     "nombre_original_comprobante" VARCHAR(255),
ADD COLUMN     "nombre_seguro_comprobante" VARCHAR(255),
ADD COLUMN     "observaciones" VARCHAR(500),
ADD COLUMN     "origen_registro" VARCHAR(30) NOT NULL DEFAULT 'ADMIN_MANUAL',
ADD COLUMN     "referencia_detectada_ocr" VARCHAR(255),
ADD COLUMN     "requiere_revision_manual" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "texto_ocr" TEXT,
ALTER COLUMN "monto" DROP NOT NULL;

-- AlterTable
ALTER TABLE "detalle_cotizacion" ADD COLUMN     "archivo_diseno_inicial_url" VARCHAR(500),
ADD COLUMN     "es_diseno_general" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "medio_recepcion_diseno" VARCHAR(30),
ADD COLUMN     "origen_diseno" VARCHAR(20) NOT NULL DEFAULT 'PIXEL',
ADD COLUMN     "requiere_diseno" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "detalle_pedido" ADD COLUMN     "archivo_diseno_inicial_url" VARCHAR(500),
ADD COLUMN     "es_diseno_general" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "medio_recepcion_diseno" VARCHAR(30),
ADD COLUMN     "origen_diseno" VARCHAR(20) NOT NULL DEFAULT 'PIXEL';

-- CreateTable
CREATE TABLE "ventas" (
    "id_venta" SERIAL NOT NULL,
    "id_pedido" INTEGER NOT NULL,
    "id_cliente" INTEGER NOT NULL,
    "total_pedido" DECIMAL(10,2) NOT NULL,
    "total_pagado" DECIMAL(10,2) NOT NULL,
    "saldo_pendiente" DECIMAL(10,2) NOT NULL,
    "fecha_primer_pago" TIMESTAMP(3) NOT NULL,
    "estado" "EstadoVenta" NOT NULL DEFAULT 'PARCIAL',
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_actualizacion" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ventas_pkey" PRIMARY KEY ("id_venta")
);

-- CreateIndex
CREATE UNIQUE INDEX "ventas_id_pedido_key" ON "ventas"("id_pedido");

-- CreateIndex
CREATE INDEX "ventas_id_cliente_fecha_primer_pago_idx" ON "ventas"("id_cliente", "fecha_primer_pago");

-- CreateIndex
CREATE INDEX "ventas_estado_fecha_primer_pago_idx" ON "ventas"("estado", "fecha_primer_pago");

-- CreateIndex
CREATE INDEX "abonos_id_pedido_comprobante_hash_idx" ON "abonos"("id_pedido", "comprobante_hash");

-- CreateIndex
CREATE INDEX "abonos_estado_fecha_creacion_idx" ON "abonos"("estado", "fecha_creacion");

-- AddForeignKey
ALTER TABLE "abonos" ADD CONSTRAINT "abonos_corregido_por_id_fkey" FOREIGN KEY ("corregido_por_id") REFERENCES "usuarios"("id_usuario") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ventas" ADD CONSTRAINT "ventas_id_pedido_fkey" FOREIGN KEY ("id_pedido") REFERENCES "pedidos"("id_pedido") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ventas" ADD CONSTRAINT "ventas_id_cliente_fkey" FOREIGN KEY ("id_cliente") REFERENCES "clientes"("id_cliente") ON DELETE RESTRICT ON UPDATE CASCADE;
