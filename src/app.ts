import app from "./interface/server";

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`✅ running server from http://localhost:${PORT}`);
});
