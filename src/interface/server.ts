import express from "express";
import cors from "cors";

const app = express();

//configuracion de cors

app.use(cors({
  origin: "http://localhost:5173",
  methods: ["GET", "POST", "PATCH", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

app.use(express.json());

//rutas 
import rolRoutes from "../infrastructure/routes/rol.routes";
import usuarioRoutes from "../infrastructure/routes/usuario.routes";
import authRoutes from "../infrastructure/routes/auth.routes";
import cotizacionRoutes from "../infrastructure/routes/cotizacion.routes";
import pedidoRoutes from "../infrastructure/routes/pedido.routes";
import tecnicaRoutes from "../infrastructure/routes/tecnica.routes";
import abonoRoutes from "../infrastructure/routes/abono.routes";
import disenoRoutes from "../infrastructure/routes/diseno.routes";
import proveedorRoutes from "../infrastructure/routes/proveedor.routes";
import compraRoutes from "../infrastructure/routes/compra.routes";
import dashboardRoutes from "../infrastructure/routes/dashboard.routes";
import ventaRoutes from "../infrastructure/routes/venta.routes";
import permisoRoutes from "../infrastructure/routes/permiso.routes";
import productoRoutes from "../infrastructure/routes/producto.routes";
import publicRoutes from "../infrastructure/routes/public.routes";

//endpoints
app.use("/api/roles", rolRoutes);
app.use("/api/usuarios", usuarioRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/cotizaciones", cotizacionRoutes);
app.use("/api/pedidos", pedidoRoutes);
app.use("/api/tecnicas", tecnicaRoutes);
app.use("/api/abonos", abonoRoutes);
app.use("/api/disenos", disenoRoutes);
app.use("/api/proveedores", proveedorRoutes);
app.use("/api/compras", compraRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/ventas", ventaRoutes);
app.use("/api/permisos", permisoRoutes);
app.use("/api/productos", productoRoutes);
app.use("/api/public", publicRoutes);

export default app;
