-- AlterTable
ALTER TABLE "cotizaciones_versiones" ADD COLUMN     "ajuste_manual" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "conceptos_adicionales" JSONB,
ADD COLUMN     "disenos_oficiales" JSONB,
ADD COLUMN     "motivo_ajuste_manual" VARCHAR(500),
ADD COLUMN     "subtotal_desglose" DECIMAL(12,2) NOT NULL DEFAULT 0;
