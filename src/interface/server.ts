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
import tecnicaRoutes from "../infrastructure/routes/tecnica.routes";

//endpoints
app.use("/api/roles", rolRoutes);
app.use("/api/usuarios", usuarioRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/cotizaciones", cotizacionRoutes);
app.use("/api/tecnicas", tecnicaRoutes);

export default app;
