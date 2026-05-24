/*
  Warnings:

  - You are about to drop the column `costo_diseno` on the `cotizaciones` table. All the data in the column will be lost.
  - The `estado` column on the `cotizaciones` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "EstadoCotizacion" AS ENUM ('SOLICITADA', 'COTIZADA', 'APROBADA', 'RECHAZADA', 'ANULADA');

-- AlterTable
ALTER TABLE "cotizaciones" DROP COLUMN "costo_diseno",
DROP COLUMN "estado",
ADD COLUMN     "estado" "EstadoCotizacion" NOT NULL DEFAULT 'SOLICITADA';

-- AlterTable
ALTER TABLE "detalle_cotizacion" ADD COLUMN     "imagen_referencia" VARCHAR(255),
ALTER COLUMN "precio_unitario" DROP NOT NULL,
ALTER COLUMN "costo_diseno" DROP NOT NULL,
ALTER COLUMN "subtotal" DROP NOT NULL;
