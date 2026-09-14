-- AlterTable
ALTER TABLE "abonos" ADD COLUMN     "comprobante_formato" VARCHAR(20),
ADD COLUMN     "comprobante_public_id" VARCHAR(255),
ADD COLUMN     "comprobante_resource_type" VARCHAR(30);
