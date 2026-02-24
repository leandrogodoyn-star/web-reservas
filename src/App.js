import { BrowserRouter, Routes, Route } from "react-router-dom";
import Negocio from "./pages/Negocio";
import Confirmacion from "./pages/Confirmacion";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/reservar/:codigo" element={<Negocio />} />
        <Route path="/confirmado" element={<Confirmacion />} />
        <Route
          path="*"
          element={
            <div
              style={{
                minHeight: "100vh",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "#0F1117",
              }}
            >
              <p style={{ color: "#8B8FA8", fontSize: 16 }}>Link inválido.</p>
            </div>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
