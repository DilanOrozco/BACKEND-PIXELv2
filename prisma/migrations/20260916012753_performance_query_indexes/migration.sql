-- CreateIndex
CREATE INDEX "abonos_estado_fecha_confirmacion_idx" ON "abonos"("estado", "fecha_confirmacion");

-- CreateIndex
CREATE INDEX "compras_id_pedido_idx" ON "compras"("id_pedido");

-- CreateIndex
CREATE INDEX "compras_id_proveedor_fecha_compra_idx" ON "compras"("id_proveedor", "fecha_compra");

-- CreateIndex
CREATE INDEX "cotizaciones_estado_fecha_creacion_idx" ON "cotizaciones"("estado", "fecha_creacion");

-- CreateIndex
CREATE INDEX "cotizaciones_versiones_es_vigente_estado_valida_hasta_idx" ON "cotizaciones_versiones"("es_vigente", "estado", "valida_hasta");

-- CreateIndex
CREATE INDEX "detalle_compra_id_compra_idx" ON "detalle_compra"("id_compra");

-- CreateIndex
CREATE INDEX "detalle_pedido_id_pedido_idx" ON "detalle_pedido"("id_pedido");

-- CreateIndex
CREATE INDEX "disenos_id_pedido_fecha_creacion_idx" ON "disenos"("id_pedido", "fecha_creacion");

-- CreateIndex
CREATE INDEX "disenos_estado_fecha_aprobacion_idx" ON "disenos"("estado", "fecha_aprobacion");

-- CreateIndex
CREATE INDEX "pedidos_estadoPedido_fecha_creacion_idx" ON "pedidos"("estadoPedido", "fecha_creacion");

-- CreateIndex
CREATE INDEX "usuarios_id_rol_idx" ON "usuarios"("id_rol");
