-- AlterTable
ALTER TABLE "disenos" ADD COLUMN     "fecha_recepcion" TIMESTAMP(3),
ADD COLUMN     "medio_recepcion" VARCHAR(30),
ADD COLUMN     "origen_diseno" VARCHAR(30) NOT NULL DEFAULT 'DISENADOR',
ADD COLUMN     "recibido_por_id" INTEGER;

-- AddForeignKey
ALTER TABLE "disenos" ADD CONSTRAINT "disenos_recibido_por_id_fkey" FOREIGN KEY ("recibido_por_id") REFERENCES "usuarios"("id_usuario") ON DELETE SET NULL ON UPDATE CASCADE;
