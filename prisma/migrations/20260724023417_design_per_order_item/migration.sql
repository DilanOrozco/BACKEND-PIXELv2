-- AlterTable
ALTER TABLE "detalle_pedido" ADD COLUMN     "requiere_diseno" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "disenos" ADD COLUMN     "id_detalle_pedido" INTEGER;

-- CreateIndex
CREATE INDEX "disenos_id_detalle_pedido_idx" ON "disenos"("id_detalle_pedido");

-- AddForeignKey
ALTER TABLE "disenos" ADD CONSTRAINT "disenos_id_detalle_pedido_fkey" FOREIGN KEY ("id_detalle_pedido") REFERENCES "detalle_pedido"("id_detalle_pedido") ON DELETE SET NULL ON UPDATE CASCADE;
