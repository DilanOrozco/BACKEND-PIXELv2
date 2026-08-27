-- AlterTable
ALTER TABLE "cotizaciones" ADD COLUMN     "descuento_total" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "detalle_cotizacion" ADD COLUMN     "descuento_total" DECIMAL(10,2) DEFAULT 0,
ADD COLUMN     "descuento_valor_unitario" DECIMAL(10,2) DEFAULT 0,
ADD COLUMN     "subtotal_bruto" DECIMAL(10,2),
ADD COLUMN     "subtotal_con_descuento" DECIMAL(10,2);
