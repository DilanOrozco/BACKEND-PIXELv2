-- AlterTable
ALTER TABLE "detalle_estampado_pedido" ALTER COLUMN "ancho_cm" DROP NOT NULL,
ALTER COLUMN "alto_cm" DROP NOT NULL;

-- AlterTable
ALTER TABLE "disenos" ADD COLUMN     "grupo_diseno_compartido" VARCHAR(100),
ADD COLUMN     "id_detalle_estampado_pedido" INTEGER;

-- CreateIndex
CREATE INDEX "disenos_id_detalle_estampado_pedido_idx" ON "disenos"("id_detalle_estampado_pedido");

-- AddForeignKey
ALTER TABLE "disenos" ADD CONSTRAINT "disenos_id_detalle_estampado_pedido_fkey" FOREIGN KEY ("id_detalle_estampado_pedido") REFERENCES "detalle_estampado_pedido"("id_detalle_estampado_pedido") ON DELETE SET NULL ON UPDATE CASCADE;
