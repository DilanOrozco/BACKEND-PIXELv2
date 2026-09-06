-- AlterTable
ALTER TABLE "disenos" ADD COLUMN     "archivo_bytes" INTEGER,
ADD COLUMN     "archivo_formato" VARCHAR(20),
ADD COLUMN     "archivo_mime_type" VARCHAR(100),
ADD COLUMN     "archivo_nombre_original" VARCHAR(255),
ADD COLUMN     "archivo_public_id" VARCHAR(255),
ADD COLUMN     "archivo_resource_type" VARCHAR(30);
