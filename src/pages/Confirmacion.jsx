import { useLocation, useNavigate } from "react-router-dom";

const COLORS = {
  bg: "#0F1117",
  surface: "#1A1D27",
  border: "#2A2E45",
  accent: "#6C63FF",
  success: "#22D3A5",
  successDim: "#22D3A522",
  textPrimary: "#EEEEF5",
  textSecondary: "#8B8FA8",
  textMuted: "#4A4E6A",
};

export default function Confirmacion() {
  const { state } = useLocation();
  const navigate = useNavigate();

  if (!state) {
    navigate("/");
    return null;
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: COLORS.bg,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 480,
          padding: 24,
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: "50%",
            backgroundColor: COLORS.successDim,
            border: `2px solid ${COLORS.success}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 24px",
          }}
        >
          <span style={{ fontSize: 36 }}>✓</span>
        </div>

        <h1
          style={{
            color: COLORS.textPrimary,
            fontSize: 24,
            fontWeight: 800,
            marginBottom: 8,
          }}
        >
          ¡Turno confirmado!
        </h1>
        <p
          style={{
            color: COLORS.textSecondary,
            fontSize: 15,
            marginBottom: 32,
          }}
        >
          Te esperamos en {state.negocio}
        </p>

        <div
          style={{
            backgroundColor: COLORS.surface,
            borderRadius: 16,
            border: `1px solid ${COLORS.border}`,
            padding: 24,
            textAlign: "left",
            marginBottom: 32,
          }}
        >
          {[
            {
              label: "📅 Fecha",
              value: `${state.fecha?.diaSemana} ${state.fecha?.dia} de ${state.fecha?.mes}`,
            },
            { label: "🕐 Hora", value: state.hora },
            ...(state.servicio
              ? [{ label: "✂️ Servicio", value: state.servicio }]
              : []),
          ].map((item) => (
            <div key={item.label} style={{ marginBottom: 16 }}>
              <p
                style={{
                  color: COLORS.textMuted,
                  fontSize: 11,
                  letterSpacing: 1,
                  margin: 0,
                }}
              >
                {item.label}
              </p>
              <p
                style={{
                  color: COLORS.textPrimary,
                  fontSize: 16,
                  fontWeight: 700,
                  margin: "4px 0 0",
                }}
              >
                {item.value}
              </p>
            </div>
          ))}
        </div>

        <p style={{ color: COLORS.textMuted, fontSize: 13 }}>
          Si necesitás cancelar o modificar tu turno, contactá directamente al
          negocio.
        </p>
      </div>
    </div>
  );
}
