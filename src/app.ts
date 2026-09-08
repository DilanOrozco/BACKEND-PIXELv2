import app from "./interface/server";

const PORT = process.env.PORT || 3000;

// Pasamos el puerto como número y el host '0.0.0.0'
app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`✅ running server from http://localhost:${PORT}`);
});
