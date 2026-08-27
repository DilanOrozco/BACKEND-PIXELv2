-- DropIndex
DROP INDEX "tarifas_tecnica_id_tecnica_estado_ancho_hasta_cm_alto_hasta_idx";

-- AlterTable
ALTER TABLE "detalle_cotizacion" ADD COLUMN     "cantidad_minima_descuento_snapshot" INTEGER,
ADD COLUMN     "id_rango_descuento_aplicado" INTEGER;

-- AlterTable
ALTER TABLE "detalle_estampado_cotizacion" ADD COLUMN     "estado_medidas" VARCHAR(20) NOT NULL DEFAULT 'PENDIENTES',
ADD COLUMN     "motivos_revision" JSONB,
ADD COLUMN     "tarifa_general_snapshot" BOOLEAN;

-- AlterTable
ALTER TABLE "tarifas_tecnica" ADD COLUMN     "es_general" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "ancho_hasta_cm" DROP NOT NULL,
ALTER COLUMN "alto_hasta_cm" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "detalle_cotizacion_id_rango_descuento_aplicado_idx" ON "detalle_cotizacion"("id_rango_descuento_aplicado");

-- CreateIndex
CREATE INDEX "tarifas_tecnica_id_tecnica_estado_es_general_ancho_hasta_cm_idx" ON "tarifas_tecnica"("id_tecnica", "estado", "es_general", "ancho_hasta_cm", "alto_hasta_cm");

-- AddForeignKey
ALTER TABLE "detalle_cotizacion" ADD CONSTRAINT "detalle_cotizacion_id_rango_descuento_aplicado_fkey" FOREIGN KEY ("id_rango_descuento_aplicado") REFERENCES "precios_producto_rangos"("id_rango") ON DELETE SET NULL ON UPDATE CASCADE;
