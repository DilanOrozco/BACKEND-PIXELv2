-- DropForeignKey
ALTER TABLE "detalle_estampado_cotizacion" DROP CONSTRAINT "detalle_estampado_cotizacion_id_tecnica_fkey";

-- DropForeignKey
ALTER TABLE "detalle_estampado_pedido" DROP CONSTRAINT "detalle_estampado_pedido_id_tecnica_fkey";

-- AlterTable
ALTER TABLE "detalle_estampado_cotizacion" ALTER COLUMN "id_tecnica" DROP NOT NULL;

-- AlterTable
ALTER TABLE "detalle_estampado_pedido" ALTER COLUMN "id_tecnica" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "detalle_estampado_cotizacion" ADD CONSTRAINT "detalle_estampado_cotizacion_id_tecnica_fkey" FOREIGN KEY ("id_tecnica") REFERENCES "tecnicas"("id_tecnica") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detalle_estampado_pedido" ADD CONSTRAINT "detalle_estampado_pedido_id_tecnica_fkey" FOREIGN KEY ("id_tecnica") REFERENCES "tecnicas"("id_tecnica") ON DELETE SET NULL ON UPDATE CASCADE;
