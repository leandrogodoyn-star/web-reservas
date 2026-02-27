import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
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

    // Calcular rango de fechas
    const hoy = new Date();
    const fechas = [];
    for (let i = 0; i < 14; i++) {
      const d = new Date(hoy);
      d.setDate(hoy.getDate() + i);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      fechas.push({ fecha: `${yyyy}-${mm}-${dd}`, d });
    }

    const fechaInicio = fechas[0].fecha;
    const fechaFin = fechas[fechas.length - 1].fecha;

    // 3 consultas en paralelo en lugar de 28 en secuencia
    const [eventosRes, horariosRes, eventosServicioRes] = await Promise.all([
      supabase
        .from("eventos_especiales")
        .select("fecha, tipo, servicio_especial")
        .eq("admin_id", negocioId)
        .gte("fecha", fechaInicio)
        .lte("fecha", fechaFin),
      supabase
        .from("horarios")
        .select("fecha")
        .eq("admin_id", negocioId)
        .eq("disponible", true)
        .gte("fecha", fechaInicio)
        .lte("fecha", fechaFin),
      servicioNombre
        ? supabase
          .from("eventos_especiales")
          .select("id")
          .eq("admin_id", negocioId)
          .eq("tipo", "servicio_especial")
          .eq("servicio_especial", servicioNombre)
        : Promise.resolve({ data: null }),
    ]);

    // Crear mapas para búsqueda rápida
    const eventosPorFecha = {};
    for (const e of eventosRes.data || []) {
      eventosPorFecha[e.fecha] = e;
    }

    const fechasConHorarios = new Set(
      (horariosRes.data || []).map((h) => h.fecha),
    );
    const tienesDiasEspeciales =
      eventosServicioRes.data && eventosServicioRes.data.length > 0;

    // Procesar días
    const dias = [];
    for (const { fecha, d } of fechas) {
      const evento = eventosPorFecha[fecha] || null;

      if (evento?.tipo === "feriado") continue;

      if (servicioNombre) {
        if (tienesDiasEspeciales) {
          if (
            !evento ||
            evento.tipo !== "servicio_especial" ||
            evento.servicio_especial !== servicioNombre
          )
            continue;
        } else {
          if (evento?.tipo === "servicio_especial") continue;
        }
      }

      if (fechasConHorarios.has(fecha)) {
        dias.push({
          fecha,
          dia: d.getDate(),
          mes: MESES[d.getMonth()],
          diaSemana: DIAS_SEMANA[d.getDay()],
          evento,
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

      if (negocio.expo_push_token) {
        await fetch("https://app-turnos-4qaf.onrender.com/notificar-reserva", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            push_token: negocio.expo_push_token,
            cliente_nombre: nombre.trim(),
            fecha: `${fechaElegida.diaSemana} ${fechaElegida.dia} de ${fechaElegida.mes}`,
            hora: horaElegida,
            servicio: servicioElegido?.nombre || null,
          }),
        });
      }

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
          flexDirection: "column",
          gap: 16
        }}
      >
        <div style={{
          width: 40, height: 40, borderRadius: "50%",
          border: `3px solid ${COLORS.border}`,
          borderTopColor: COLORS.accent,
          animation: "spin 1s linear infinite"
        }} />
        <style>{"@keyframes spin { 100% { transform: rotate(360deg); } }"}</style>
        <p style={{ color: COLORS.textMuted, fontWeight: 500, letterSpacing: 1 }}>CARGANDO...</p>
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
        backgroundImage: "radial-gradient(circle at top right, #6C63FF10 0%, transparent 400px), radial-gradient(circle at bottom left, #22D3A50A 0%, transparent 400px)",
        display: "flex",
        justifyContent: "center",
        padding: "20px 16px",
      }}
    >
      <div
        className="glass-panel"
        style={{ width: "100%", maxWidth: 480, padding: "32px 24px", alignSelf: "flex-start", marginTop: "2vh" }}
      >
        {/* Header negocio */}
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          {negocio.avatar ? (
            <img
              src={negocio.avatar}
              alt="logo"
              className="hover-scale"
              style={{
                width: 88,
                height: 88,
                borderRadius: "50%",
                objectFit: "cover",
                marginBottom: 16,
                border: `3px solid ${COLORS.accent}`,
                boxShadow: `0 8px 24px ${COLORS.accentDim}`,
                cursor: "default"
              }}
            />
          ) : (
            <div style={{
              width: 88, height: 88, borderRadius: "50%",
              backgroundColor: COLORS.surface,
              border: `3px solid ${COLORS.border}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 16px auto",
              boxShadow: `0 8px 16px rgba(0,0,0,0.2)`
            }}>
              <span style={{ fontSize: 32, fontWeight: 800, color: COLORS.accentLight }}>
                {negocio.nombre[0].toUpperCase()}
              </span>
            </div>
          )}
          <h1
            style={{
              color: "white",
              fontSize: 26,
              fontWeight: 800,
              margin: 0,
              letterSpacing: "-0.5px"
            }}
          >
            {negocio.nombre}
          </h1>
          <p style={{ color: COLORS.textSecondary, fontSize: 14, marginTop: 6, fontWeight: 500 }}>
            Reservá tu turno online
          </p>
        </div>

        {/* Indicador de pasos */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 6,
            marginBottom: 32,
          }}
        >
          {[1, 2, 3, 4].map((p) => (
            <div
              key={p}
              style={{
                width: paso === p ? 28 : paso > p ? 16 : 8,
                height: 6,
                borderRadius: 4,
                backgroundColor: paso >= p ? COLORS.accent : COLORS.border,
                transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
                opacity: paso >= p ? 1 : 0.5
              }}
            />
          ))}
        </div>

        {/* Paso 1 — Servicio */}
        {paso === 1 && (
          <div className="animate-fade-in">
            <h2
              style={{
                color: "white",
                fontSize: 20,
                fontWeight: 700,
                marginBottom: 20,
                letterSpacing: "-0.3px"
              }}
            >
              {servicios.length > 0
                ? "¿Qué servicio necesitás?"
                : "Cargando servicios..."}
            </h2>
            {servicios.length > 0 ? (
              <div
                style={{ display: "flex", flexDirection: "column", gap: 12 }}
              >
                {servicios.map((s) => (
                  <button
                    key={s.id}
                    className="selectable-card"
                    onClick={() => {
                      setServicioElegido(s);
                      cargarDiasDisponibles(negocio.id, s.nombre);
                      setPaso(2);
                    }}
                    style={{
                      borderRadius: 16,
                      padding: "18px 20px",
                      cursor: "pointer",
                      textAlign: "left",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      color: "white"
                    }}
                  >
                    <span
                      style={{
                        fontSize: 16,
                        fontWeight: 600,
                      }}
                    >
                      {s.nombre}
                    </span>
                    {s.precio && (
                      <span style={{ color: COLORS.success, fontWeight: 800, fontSize: 16, backgroundColor: COLORS.successDim, padding: "4px 10px", borderRadius: 8 }}>
                        ${s.precio.toLocaleString("es-AR")}
                      </span>
                    )}
                  </button>
                ))}
                <button
                  className="hover-scale"
                  onClick={() => {
                    setServicioElegido(null);
                    cargarDiasDisponibles(negocio.id, null);
                    setPaso(2);
                  }}
                  style={{
                    backgroundColor: "transparent",
                    border: "none",
                    padding: 16,
                    cursor: "pointer",
                    color: COLORS.textSecondary,
                    fontSize: 14,
                    fontWeight: 600,
                    marginTop: 8
                  }}
                >
                  Omitir selección de servicio
                </button>
              </div>
            ) : (
              <button
                className="hover-scale"
                onClick={() => {
                  cargarDiasDisponibles(negocio.id, null);
                  setPaso(2);
                }}
                style={{
                  width: "100%",
                  backgroundColor: COLORS.accent,
                  border: "none",
                  borderRadius: 16,
                  padding: 20,
                  cursor: "pointer",
                  color: "white",
                  fontSize: 16,
                  fontWeight: 700,
                  boxShadow: `0 8px 24px ${COLORS.accentDim}`,
                }}
              >
                Elegir fecha y hora →
              </button>
            )}
          </div>
        )}

        {/* Paso 2 — Fecha */}
        {paso === 2 && (
          <div className="animate-fade-in">
            <h2
              style={{
                color: "white",
                fontSize: 20,
                fontWeight: 700,
                marginBottom: 20,
                letterSpacing: "-0.3px"
              }}
            >
              ¿Qué día preferís?
            </h2>
            {cargandoDias ? (
              <p style={{ color: COLORS.textMuted, textAlign: "center", padding: 40, fontWeight: 500 }}>
                Cargando calendario...
              </p>
            ) : diasDisponibles.length === 0 ? (
              <div style={{ padding: 40, textAlign: "center", backgroundColor: COLORS.surface, borderRadius: 16, border: `1px dashed ${COLORS.border}` }}>
                <span style={{ fontSize: 32, marginBottom: 12, display: "block" }}>📅</span>
                <p style={{ color: COLORS.textSecondary, margin: 0, lineHeight: 1.5 }}>
                  No hay turnos disponibles para este servicio en los próximos días.
                </p>
              </div>
            ) : (
              <div
                style={{ display: "flex", flexDirection: "column", gap: 12 }}
              >
                {diasDisponibles.map((d) => (
                  <button
                    key={d.fecha}
                    className="selectable-card"
                    onClick={async () => {
                      setFechaElegida(d);
                      await cargarHoras(d.fecha);
                      setPaso(3);
                    }}
                    style={{
                      borderRadius: 16,
                      padding: 16,
                      border: `1px solid ${d.evento?.tipo === "servicio_especial" ? COLORS.accent : COLORS.border}`,
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
                            ? COLORS.accent
                            : COLORS.bg,
                        borderRadius: 12,
                        padding: "10px",
                        textAlign: "center",
                        minWidth: 56,
                        boxShadow: d.evento?.tipo === "servicio_especial" ? `0 4px 12px ${COLORS.accentDim}` : "none"
                      }}
                    >
                      <p
                        style={{
                          color: d.evento?.tipo === "servicio_especial" ? "white" : COLORS.accentLight,
                          fontSize: 10,
                          fontWeight: 700,
                          margin: 0,
                          textTransform: "uppercase"
                        }}
                      >
                        {d.diaSemana}
                      </p>
                      <p
                        style={{
                          color: "white",
                          fontSize: 22,
                          fontWeight: 800,
                          margin: "2px 0",
                        }}
                      >
                        {d.dia}
                      </p>
                    </div>
                    <div style={{ textAlign: "left", flex: 1 }}>
                      <p
                        style={{
                          color: "white",
                          fontSize: 16,
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
                            margin: "6px 0 0",
                            fontWeight: 700,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            backgroundColor: COLORS.accentDim,
                            padding: "2px 8px",
                            borderRadius: 6
                          }}
                        >
                          🟣 Exclusivo {d.evento.servicio_especial}
                        </p>
                      )}
                      {d.evento?.tipo === "horario_especial" && (
                        <p
                          style={{
                            color: "#FFAA40",
                            fontSize: 12,
                            margin: "6px 0 0",
                            fontWeight: 700,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            backgroundColor: "#FFAA4022",
                            padding: "2px 8px",
                            borderRadius: 6
                          }}
                        >
                          🟡 Horario especial
                        </p>
                      )}
                    </div>
                    <div style={{ color: COLORS.textMuted, fontSize: 20 }}>
                      ›
                    </div>
                  </button>
                ))}
              </div>
            )}
            <button
              className="hover-scale"
              onClick={() => setPaso(1)}
              style={{
                marginTop: 20,
                backgroundColor: "transparent",
                border: "none",
                color: COLORS.textSecondary,
                cursor: "pointer",
                fontSize: 14,
                fontWeight: 600,
                width: "100%"
              }}
            >
              ← Volver a servicios
            </button>
          </div>
        )}

        {/* Paso 3 — Hora */}
        {paso === 3 && (
          <div className="animate-fade-in">
            <h2
              style={{
                color: "white",
                fontSize: 20,
                fontWeight: 700,
                marginBottom: 8,
                letterSpacing: "-0.3px"
              }}
            >
              ¿A qué hora?
            </h2>
            <p style={{ color: COLORS.textSecondary, marginBottom: 24, fontSize: 14, fontWeight: 500 }}>
              {fechaElegida?.diaSemana} {fechaElegida?.dia} de {fechaElegida?.mes}
            </p>

            {horasDisponibles.length === 0 ? (
              <div style={{ padding: 40, textAlign: "center", backgroundColor: COLORS.surface, borderRadius: 16, border: `1px dashed ${COLORS.border}` }}>
                <p style={{ color: COLORS.textSecondary, margin: 0 }}>No quedan horarios para este día.</p>
              </div>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: 12,
                }}
              >
                {horasDisponibles.map((h) => (
                  <button
                    key={h.id}
                    className="selectable-card"
                    onClick={() => {
                      setHoraElegida(h.hora);
                      setHorarioId(h.id);
                      setPaso(4);
                    }}
                    style={{
                      borderRadius: 12,
                      padding: "16px 0",
                      cursor: "pointer",
                      color: "white",
                      fontSize: 16,
                      fontWeight: 700,
                    }}
                  >
                    {h.hora}
                  </button>
                ))}
              </div>
            )}

            <button
              className="hover-scale"
              onClick={() => setPaso(2)}
              style={{
                marginTop: 24,
                backgroundColor: "transparent",
                border: "none",
                color: COLORS.textSecondary,
                cursor: "pointer",
                fontSize: 14,
                fontWeight: 600,
                width: "100%"
              }}
            >
              ← Cambiar de día
            </button>
          </div>
        )}

        {/* Paso 4 — Datos */}
        {paso === 4 && (
          <div className="animate-fade-in">
            <h2
              style={{
                color: "white",
                fontSize: 20,
                fontWeight: 700,
                marginBottom: 8,
                letterSpacing: "-0.3px"
              }}
            >
              Último paso
            </h2>
            <div
              style={{
                backgroundColor: COLORS.bg,
                borderRadius: 12,
                padding: "12px 16px",
                marginBottom: 24,
                border: `1px solid rgba(42, 46, 69, 0.5)`,
                display: "flex", flexDirection: "column", gap: 4
              }}
            >
              {servicioElegido && (
                <p style={{ color: COLORS.accentLight, fontWeight: 700, margin: 0, fontSize: 13 }}>
                  {servicioElegido.nombre}
                </p>
              )}
              <p style={{ color: "white", fontWeight: 600, margin: 0, fontSize: 15 }}>
                {fechaElegida?.diaSemana} {fechaElegida?.dia} de{" "}
                {fechaElegida?.mes} a las {horaElegida} hs
              </p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <p
                  style={{
                    color: COLORS.textSecondary,
                    fontSize: 11,
                    letterSpacing: 1.5,
                    marginBottom: 8,
                    fontWeight: 600
                  }}
                >
                  NOMBRE COMPLETO
                </p>
                <input
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Ej. Juan Pérez"
                  style={{
                    width: "100%",
                    backgroundColor: COLORS.bg,
                    border: `1px solid ${nombre.trim() ? COLORS.accent : "rgba(42, 46, 69, 0.8)"}`,
                    borderRadius: 14,
                    padding: "16px",
                    color: "white",
                    fontSize: 16,
                    fontWeight: 500,
                    outline: "none",
                    boxSizing: "border-box",
                    transition: "all 0.2s"
                  }}
                />
              </div>
              <div>
                <p
                  style={{
                    color: COLORS.textSecondary,
                    fontSize: 11,
                    letterSpacing: 1.5,
                    marginBottom: 8,
                    fontWeight: 600
                  }}
                >
                  TELÉFONO (WHATSAPP)
                </p>
                <input
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                  placeholder="Ej. 11 1234 5678"
                  type="tel"
                  style={{
                    width: "100%",
                    backgroundColor: COLORS.bg,
                    border: `1px solid ${telefono.trim() ? COLORS.accent : "rgba(42, 46, 69, 0.8)"}`,
                    borderRadius: 14,
                    padding: "16px",
                    color: "white",
                    fontSize: 16,
                    fontWeight: 500,
                    outline: "none",
                    boxSizing: "border-box",
                    transition: "all 0.2s"
                  }}
                />
              </div>
            </div>

            {negocio.mp_habilitado && !pagoCompletado && servicioElegido?.precio ? (
              <button
                className="hover-scale"
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
                          precio: servicioElegido?.precio,
                          nombre: nombre.trim(),
                          telefono: telefono.trim(),
                        }),
                      },
                    );
                    const data = await res.json();
                    if (data.init_point) window.location.href = data.init_point;
                  } catch (e) {
                    alert("Error al conectar con Mercado Pago.");
                  }
                  setPagando(false);
                }}
                disabled={pagando || !nombre.trim() || !telefono.trim()}
                style={{
                  width: "100%",
                  marginTop: 32,
                  backgroundColor: "#009EE3",
                  border: "none",
                  borderRadius: 14,
                  padding: "18px",
                  cursor: !nombre.trim() || !telefono.trim() ? "not-allowed" : "pointer",
                  color: "white",
                  fontSize: 16,
                  fontWeight: 700,
                  opacity: !nombre.trim() || !telefono.trim() ? 0.5 : 1,
                  boxShadow: !nombre.trim() || !telefono.trim() ? "none" : `0 8px 24px rgba(0, 158, 227, 0.3)`,
                }}
              >
                {pagando ? "Redirigiendo a Mercado Pago..." : `Pagar $${servicioElegido.precio.toLocaleString("es-AR")} y reservar`}
              </button>
            ) : (
              <button
                className="hover-scale"
                onClick={confirmarReserva}
                disabled={reservando || !nombre.trim() || !telefono.trim()}
                style={{
                  width: "100%",
                  marginTop: 32,
                  backgroundColor: COLORS.accent,
                  border: "none",
                  borderRadius: 14,
                  padding: "18px",
                  cursor: !nombre.trim() || !telefono.trim() ? "not-allowed" : "pointer",
                  color: "white",
                  fontSize: 16,
                  fontWeight: 700,
                  opacity: !nombre.trim() || !telefono.trim() ? 0.5 : 1,
                  boxShadow: !nombre.trim() || !telefono.trim() ? "none" : `0 8px 24px ${COLORS.accentDim}`,
                }}
              >
                {reservando ? "Confirmando reserva..." : "Confirmar reserva"}
              </button>
            )}

            {negocio.mp_habilitado &&
              !negocio.mp_obligatorio &&
              !pagoCompletado && (
                <button
                  className="hover-scale"
                  onClick={() => setPagoCompletado(true)}
                  style={{
                    width: "100%",
                    marginTop: 16,
                    backgroundColor: "transparent",
                    border: "none",
                    color: COLORS.textSecondary,
                    cursor: "pointer",
                    fontSize: 14,
                    fontWeight: 600
                  }}
                >
                  Continuar sin pagar (abonar en el local)
                </button>
              )}

            <button
              className="hover-scale"
              onClick={() => setPaso(3)}
              style={{
                marginTop: 16,
                backgroundColor: "transparent",
                border: "none",
                color: COLORS.textSecondary,
                cursor: "pointer",
                fontSize: 14,
                fontWeight: 600,
                width: "100%"
              }}
            >
              ← Volver
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
