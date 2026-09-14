-- AlterTable
ALTER TABLE "detalle_cotizacion" ADD COLUMN     "archivo_diseno_inicial_metadata" JSONB;

-- AlterTable
ALTER TABLE "detalle_pedido" ADD COLUMN     "archivo_diseno_inicial_metadata" JSONB;
