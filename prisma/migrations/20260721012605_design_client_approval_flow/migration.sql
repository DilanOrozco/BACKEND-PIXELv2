-- AlterEnum
ALTER TYPE "EstadoDiseno" ADD VALUE 'RECHAZADO';

-- AlterTable
ALTER TABLE "disenos" ADD COLUMN     "fecha_respuesta_cliente" TIMESTAMP(3),
ADD COLUMN     "medio_respuesta_cliente" VARCHAR(30),
ADD COLUMN     "observaciones_cliente" TEXT,
ADD COLUMN     "respuesta_registrada_por_id" INTEGER;

-- AddForeignKey
ALTER TABLE "disenos" ADD CONSTRAINT "disenos_respuesta_registrada_por_id_fkey" FOREIGN KEY ("respuesta_registrada_por_id") REFERENCES "usuarios"("id_usuario") ON DELETE SET NULL ON UPDATE CASCADE;
