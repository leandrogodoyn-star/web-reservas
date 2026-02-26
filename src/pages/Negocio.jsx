import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

const COLORS = {
  bg: "#0F1117",
  surface: "#1A1D27",
  border: "#2A2E45",
  accent: "#6C63FF",
  accentLight: "#8B85FF",
  accentDim: "#6C63FF22",
  success: "#22D3A5",
  successDim: "#22D3A522",
  textPrimary: "#EEEEF5",
  textSecondary: "#8B8FA8",
  textMuted: "#4A4E6A",
};

const MESES = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
];
const DIAS_SEMANA = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

export default function Negocio() {
  const { codigo } = useParams();
  const navigate = useNavigate();

  const [negocio, setNegocio] = useState(null);
  const [servicios, setServicios] = useState([]);
  const [paso, setPaso] = useState(1);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const [servicioElegido, setServicioElegido] = useState(null);
  const [fechaElegida, setFechaElegida] = useState(null);
  const [horaElegida, setHoraElegida] = useState(null);
  const [horarioId, setHorarioId] = useState(null);
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [reservando, setReservando] = useState(false);
  const [pagando, setPagando] = useState(false);
  const [pagoCompletado, setPagoCompletado] = useState(false);

  const [diasDisponibles, setDiasDisponibles] = useState([]);
  const [horasDisponibles, setHorasDisponibles] = useState([]);
  const [cargandoDias, setCargandoDias] = useState(false);

  useEffect(() => {
    cargarNegocio();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codigo]);

  const cargarNegocio = async () => {
    const { data: negocioData } = await supabase
      .from("profiles")
      .select("*")
      .eq("codigo_bot", codigo)
      .single();

    if (!negocioData) {
      setError("Negocio no encontrado.");
      setCargando(false);
      return;
    }

    setNegocio(negocioData);
    console.log("mp_habilitado:", negocioData.mp_habilitado);

    const { data: serviciosData } = await supabase
      .from("servicios")
      .select("*")
      .eq("admin_id", negocioData.id)
      .eq("activo", true);

    setServicios(serviciosData || []);
    await cargarDiasDisponibles(negocioData.id, null);
    setCargando(false);
  };

  const cargarDiasDisponibles = async (negocioId, servicioNombre) => {
    setCargandoDias(true);
    const hoy = new Date();
    const dias = [];

    for (let i = 0; i < 14; i++) {
      const d = new Date(hoy);
      d.setDate(hoy.getDate() + i);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      const fecha = `${yyyy}-${mm}-${dd}`;

      const { data: eventos } = await supabase
        .from("eventos_especiales")
        .select("tipo, servicio_especial")
        .eq("admin_id", negocioId)
        .eq("fecha", fecha);

      const evento = eventos?.[0] || null;

      if (evento?.tipo === "feriado") continue;

      // Verificar si el servicio tiene algún día especial asignado
      if (servicioNombre) {
        const { data: eventosDelServicio } = await supabase
          .from("eventos_especiales")
          .select("id")
          .eq("admin_id", negocioId)
          .eq("tipo", "servicio_especial")
          .eq("servicio_especial", servicioNombre);

        const tienesDiasEspeciales =
          eventosDelServicio && eventosDelServicio.length > 0;

        if (tienesDiasEspeciales) {
          if (
            !evento ||
            evento.tipo !== "servicio_especial" ||
            evento.servicio_especial !== servicioNombre
          )
            continue;
        }
      }

      const { data: horarios } = await supabase
        .from("horarios")
        .select("id")
        .eq("admin_id", negocioId)
        .eq("fecha", fecha)
        .eq("disponible", true);

      if (horarios && horarios.length > 0) {
        dias.push({
          fecha,
          dia: d.getDate(),
          mes: MESES[d.getMonth()],
          diaSemana: DIAS_SEMANA[d.getDay()],
          evento: evento,
        });
      }

      if (dias.length >= 7) break;
    }

    setDiasDisponibles(dias);
    setCargandoDias(false);
  };

  const cargarHoras = async (fecha) => {
    const { data: horarios } = await supabase
      .from("horarios")
      .select("id, hora")
      .eq("admin_id", negocio.id)
      .eq("fecha", fecha)
      .eq("disponible", true)
      .order("hora");

    const { data: reservados } = await supabase
      .from("reservas")
      .select("horario_id")
      .in(
        "horario_id",
        horarios.map((h) => h.id),
      );

    const reservadosSet = new Set(reservados?.map((r) => r.horario_id) ?? []);

    setHorasDisponibles(
      horarios
        .filter((h) => !reservadosSet.has(h.id))
        .map((h) => ({ id: h.id, hora: h.hora.slice(0, 5) })),
    );
  };

  const confirmarReserva = async () => {
    if (!nombre.trim() || !telefono.trim()) return;
    setReservando(true);

    const { error } = await supabase.from("reservas").insert({
      admin_id: negocio.id,
      horario_id: horarioId,
      cliente_nombre: nombre.trim(),
      cliente_telefono: telefono.trim(),
      servicio: servicioElegido?.nombre || null,
    });

    if (!error) {
      await supabase
        .from("horarios")
        .update({ disponible: false })
        .eq("id", horarioId);
      navigate("/confirmado", {
        state: {
          negocio: negocio.nombre,
          fecha: fechaElegida,
          hora: horaElegida,
          servicio: servicioElegido?.nombre,
        },
      });
    }
    setReservando(false);
  };

  if (cargando)
    return (
      <div
        style={{
          minHeight: "100vh",
          backgroundColor: COLORS.bg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <p style={{ color: COLORS.textMuted }}>Cargando...</p>
      </div>
    );

  if (error)
    return (
      <div
        style={{
          minHeight: "100vh",
          backgroundColor: COLORS.bg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <p style={{ color: COLORS.textMuted }}>{error}</p>
      </div>
    );

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: COLORS.bg,
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div style={{ width: "100%", maxWidth: 480, padding: 24 }}>
        {/* Header negocio */}
        <div style={{ textAlign: "center", marginBottom: 32, paddingTop: 32 }}>
          {negocio.avatar && (
            <img
              src={negocio.avatar}
              alt="logo"
              style={{
                width: 80,
                height: 80,
                borderRadius: "50%",
                objectFit: "cover",
                marginBottom: 12,
                border: `2px solid ${COLORS.accent}`,
              }}
            />
          )}
          <h1
            style={{
              color: COLORS.textPrimary,
              fontSize: 24,
              fontWeight: 800,
              margin: 0,
            }}
          >
            {negocio.nombre}
          </h1>
          <p style={{ color: COLORS.textMuted, fontSize: 13, marginTop: 4 }}>
            Reservá tu turno online
          </p>
        </div>

        {/* Indicador de pasos */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 8,
            marginBottom: 28,
          }}
        >
          {[1, 2, 3, 4].map((p) => (
            <div
              key={p}
              style={{
                width: paso >= p ? 24 : 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: paso >= p ? COLORS.accent : COLORS.border,
                transition: "all 0.3s",
              }}
            />
          ))}
        </div>

        {/* Paso 1 — Servicio */}
        {paso === 1 && (
          <div>
            <h2
              style={{
                color: COLORS.textPrimary,
                fontSize: 18,
                fontWeight: 700,
                marginBottom: 16,
              }}
            >
              {servicios.length > 0
                ? "¿Qué servicio necesitás?"
                : "Reservá tu turno"}
            </h2>
            {servicios.length > 0 ? (
              <div
                style={{ display: "flex", flexDirection: "column", gap: 10 }}
              >
                {servicios.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      setServicioElegido(s);
                      cargarDiasDisponibles(negocio.id, s.nombre);
                      setPaso(2);
                    }}
                    style={{
                      backgroundColor: COLORS.surface,
                      border: `1px solid ${COLORS.border}`,
                      borderRadius: 14,
                      padding: 16,
                      cursor: "pointer",
                      textAlign: "left",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <span
                      style={{
                        color: COLORS.textPrimary,
                        fontSize: 15,
                        fontWeight: 600,
                      }}
                    >
                      {s.nombre}
                    </span>
                    {s.precio && (
                      <span style={{ color: COLORS.success, fontWeight: 700 }}>
                        ${s.precio.toLocaleString("es-AR")}
                      </span>
                    )}
                  </button>
                ))}
                <button
                  onClick={() => {
                    setServicioElegido(null);
                    cargarDiasDisponibles(negocio.id, null);
                    setPaso(2);
                  }}
                  style={{
                    backgroundColor: "transparent",
                    border: `1px solid ${COLORS.border}`,
                    borderRadius: 14,
                    padding: 14,
                    cursor: "pointer",
                    color: COLORS.textMuted,
                    fontSize: 13,
                  }}
                >
                  Continuar sin elegir servicio
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  cargarDiasDisponibles(negocio.id, null);
                  setPaso(2);
                }}
                style={{
                  width: "100%",
                  backgroundColor: COLORS.accent,
                  border: "none",
                  borderRadius: 14,
                  padding: 18,
                  cursor: "pointer",
                  color: "white",
                  fontSize: 16,
                  fontWeight: 700,
                }}
              >
                Elegir fecha y hora →
              </button>
            )}
          </div>
        )}

        {/* Paso 2 — Fecha */}
        {paso === 2 && (
          <div>
            <h2
              style={{
                color: COLORS.textPrimary,
                fontSize: 18,
                fontWeight: 700,
                marginBottom: 16,
              }}
            >
              ¿Qué día preferís?
            </h2>
            {cargandoDias ? (
              <p
                style={{
                  color: COLORS.textMuted,
                  textAlign: "center",
                  padding: 40,
                }}
              >
                Cargando días...
              </p>
            ) : diasDisponibles.length === 0 ? (
              <p
                style={{
                  color: COLORS.textMuted,
                  textAlign: "center",
                  padding: 40,
                }}
              >
                No hay turnos disponibles para este servicio por el momento.
              </p>
            ) : (
              <div
                style={{ display: "flex", flexDirection: "column", gap: 10 }}
              >
                {diasDisponibles.map((d) => (
                  <button
                    key={d.fecha}
                    onClick={async () => {
                      setFechaElegida(d);
                      await cargarHoras(d.fecha);
                      setPaso(3);
                    }}
                    style={{
                      backgroundColor: COLORS.surface,
                      border: `1px solid ${d.evento?.tipo === "servicio_especial" ? "#6C63FF55" : COLORS.border}`,
                      borderRadius: 14,
                      padding: 16,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 16,
                      width: "100%",
                      boxSizing: "border-box",
                    }}
                  >
                    <div
                      style={{
                        backgroundColor:
                          d.evento?.tipo === "servicio_especial"
                            ? COLORS.accentDim
                            : "#1A1D27",
                        borderRadius: 10,
                        padding: "8px 14px",
                        textAlign: "center",
                        border: `1px solid ${d.evento?.tipo === "servicio_especial" ? COLORS.accent + "44" : "transparent"}`,
                        minWidth: 52,
                      }}
                    >
                      <p
                        style={{
                          color: COLORS.accentLight,
                          fontSize: 11,
                          fontWeight: 700,
                          margin: 0,
                        }}
                      >
                        {d.diaSemana}
                      </p>
                      <p
                        style={{
                          color: COLORS.textPrimary,
                          fontSize: 20,
                          fontWeight: 800,
                          margin: 0,
                        }}
                      >
                        {d.dia}
                      </p>
                      <p
                        style={{
                          color: COLORS.textMuted,
                          fontSize: 11,
                          margin: 0,
                        }}
                      >
                        {d.mes}
                      </p>
                    </div>
                    <div style={{ textAlign: "left" }}>
                      <p
                        style={{
                          color: COLORS.textPrimary,
                          fontSize: 15,
                          fontWeight: 600,
                          margin: 0,
                        }}
                      >
                        {d.diaSemana} {d.dia} de {d.mes}
                      </p>
                      {d.evento?.tipo === "servicio_especial" && (
                        <p
                          style={{
                            color: COLORS.accentLight,
                            fontSize: 12,
                            margin: "4px 0 0",
                            fontWeight: 600,
                          }}
                        >
                          🟣 {d.evento.servicio_especial}
                        </p>
                      )}
                      {d.evento?.tipo === "horario_especial" && (
                        <p
                          style={{
                            color: "#FFAA40",
                            fontSize: 12,
                            margin: "4px 0 0",
                            fontWeight: 600,
                          }}
                        >
                          🟡 Horario especial
                        </p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
            <button
              onClick={() => setPaso(1)}
              style={{
                marginTop: 16,
                backgroundColor: "transparent",
                border: "none",
                color: COLORS.textMuted,
                cursor: "pointer",
                fontSize: 14,
              }}
            >
              ← Volver
            </button>
          </div>
        )}

        {/* Paso 3 — Hora */}
        {paso === 3 && (
          <div>
            <h2
              style={{
                color: COLORS.textPrimary,
                fontSize: 18,
                fontWeight: 700,
                marginBottom: 16,
              }}
            >
              ¿A qué hora?
            </h2>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 10,
              }}
            >
              {horasDisponibles.map((h) => (
                <button
                  key={h.id}
                  onClick={() => {
                    setHoraElegida(h.hora);
                    setHorarioId(h.id);
                    setPaso(4);
                  }}
                  style={{
                    backgroundColor: COLORS.surface,
                    border: `1px solid ${COLORS.border}`,
                    borderRadius: 12,
                    padding: "14px 0",
                    cursor: "pointer",
                    color: COLORS.textPrimary,
                    fontSize: 15,
                    fontWeight: 600,
                  }}
                >
                  {h.hora}
                </button>
              ))}
            </div>
            <button
              onClick={() => setPaso(2)}
              style={{
                marginTop: 16,
                backgroundColor: "transparent",
                border: "none",
                color: COLORS.textMuted,
                cursor: "pointer",
                fontSize: 14,
              }}
            >
              ← Volver
            </button>
          </div>
        )}

        {/* Paso 4 — Datos */}
        {paso === 4 && (
          <div>
            <h2
              style={{
                color: COLORS.textPrimary,
                fontSize: 18,
                fontWeight: 700,
                marginBottom: 8,
              }}
            >
              Tus datos
            </h2>
            <p
              style={{
                color: COLORS.textMuted,
                fontSize: 13,
                marginBottom: 24,
              }}
            >
              {servicioElegido ? `${servicioElegido.nombre} · ` : ""}
              {fechaElegida?.diaSemana} {fechaElegida?.dia} de{" "}
              {fechaElegida?.mes} · {horaElegida}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <p
                  style={{
                    color: COLORS.textMuted,
                    fontSize: 11,
                    letterSpacing: 1,
                    marginBottom: 6,
                  }}
                >
                  NOMBRE
                </p>
                <input
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Tu nombre completo"
                  style={{
                    width: "100%",
                    backgroundColor: COLORS.surface,
                    border: `1px solid ${COLORS.border}`,
                    borderRadius: 12,
                    padding: 14,
                    color: COLORS.textPrimary,
                    fontSize: 15,
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>
              <div>
                <p
                  style={{
                    color: COLORS.textMuted,
                    fontSize: 11,
                    letterSpacing: 1,
                    marginBottom: 6,
                  }}
                >
                  TELÉFONO
                </p>
                <input
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                  placeholder="Ej: 3491234567"
                  type="tel"
                  style={{
                    width: "100%",
                    backgroundColor: COLORS.surface,
                    border: `1px solid ${COLORS.border}`,
                    borderRadius: 12,
                    padding: 14,
                    color: COLORS.textPrimary,
                    fontSize: 15,
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>
            </div>
            {/* Si MP está habilitado y no pagó todavía */}
            {negocio.mp_habilitado && !pagoCompletado ? (
              <button
                onClick={async () => {
                  if (!nombre.trim() || !telefono.trim()) return;
                  setPagando(true);
                  try {
                    const res = await fetch(
                      "https://app-turnos-4qaf.onrender.com/crear-preferencia",
                      {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          access_token: negocio.mp_access_token,
                          titulo: servicioElegido?.nombre || "Turno",
                          precio: servicioElegido?.precio || 1,
                          nombre: nombre.trim(),
                          telefono: telefono.trim(),
                        }),
                      },
                    );
                    const data = await res.json();
                    if (data.init_point) {
                      window.location.href = data.init_point;
                    }
                  } catch (e) {
                    alert("Error al conectar con Mercado Pago.");
                  }
                  setPagando(false);
                }}
                disabled={pagando || !nombre.trim() || !telefono.trim()}
                style={{
                  width: "100%",
                  marginTop: 24,
                  backgroundColor: "#00AEEF",
                  border: "none",
                  borderRadius: 14,
                  padding: 18,
                  cursor: "pointer",
                  color: "white",
                  fontSize: 16,
                  fontWeight: 700,
                  opacity: !nombre.trim() || !telefono.trim() ? 0.5 : 1,
                }}
              >
                {pagando ? "Redirigiendo..." : "Pagar con Mercado Pago"}
              </button>
            ) : (
              <button
                onClick={confirmarReserva}
                disabled={reservando || !nombre.trim() || !telefono.trim()}
                style={{
                  width: "100%",
                  marginTop: 24,
                  backgroundColor: COLORS.accent,
                  border: "none",
                  borderRadius: 14,
                  padding: 18,
                  cursor: "pointer",
                  color: "white",
                  fontSize: 16,
                  fontWeight: 700,
                  opacity: !nombre.trim() || !telefono.trim() ? 0.5 : 1,
                }}
              >
                {reservando ? "Confirmando..." : "Confirmar turno"}
              </button>
            )}

            {/* Si MP está habilitado pero no es obligatorio, mostrar opción de saltar */}
            {negocio.mp_habilitado &&
              !negocio.mp_obligatorio &&
              !pagoCompletado && (
                <button
                  onClick={() => setPagoCompletado(true)}
                  style={{
                    width: "100%",
                    marginTop: 10,
                    backgroundColor: "transparent",
                    border: "none",
                    color: COLORS.textMuted,
                    cursor: "pointer",
                    fontSize: 13,
                  }}
                >
                  Continuar sin pagar
                </button>
              )}
          </div>
        )}
      </div>
    </div>
  );
}
