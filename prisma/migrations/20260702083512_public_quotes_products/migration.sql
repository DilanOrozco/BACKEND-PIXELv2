-- AlterTable
ALTER TABLE "clientes" ALTER COLUMN "fecha_actualizacion" DROP DEFAULT;

-- AlterTable
ALTER TABLE "precios_producto_rangos" ALTER COLUMN "fecha_actualizacion" DROP DEFAULT;

-- AlterTable
ALTER TABLE "productos_cotizables" ALTER COLUMN "fecha_actualizacion" DROP DEFAULT;
