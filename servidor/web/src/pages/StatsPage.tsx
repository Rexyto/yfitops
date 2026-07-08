import { useState, useEffect, useRef } from 'react';

interface StatsPageProps {
  user: { username: string; role: 'superadmin' | 'user' };
}

interface ServerStats {
  totalListeningSeconds: number;
  totalSongsPlayed: number;
  avgLatencyMs: number | null;
  avgProcessingMs: number | null;
  dailyChart: Array<{ date: string; seconds: number }>;
  latencySamples: number[];
  processingTimes: number[];
  activeListeners?: number;
  uptime?: number; // seconds
  peakListeners?: number;
  topSongs?: Array<{ title: string; artist: string; plays: number }>;
}

/* ─── helpers ─────────────────────────────── */
function fmtHours(secs: number): string {
  if (!secs || secs < 1) return '0 seg';
  if (secs < 60) return `${secs} seg`;
  if (secs < 3600) {
    const m = Math.floor(secs / 60), s = secs % 60;
    return s > 0 ? `${m} min ${s} seg` : `${m} min`;
  }
  const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60);
  return m > 0 ? `${h}h ${m} min` : `${h}h`;
}

function fmtUptime(secs: number): string {
  if (!secs) return '—';
  const d = Math.floor(secs / 86400);
  const h = Math.floor((secs % 86400) / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function latencyColor(ms: number): string {
  if (ms < 100) return '#1ed760';
  if (ms < 500) return '#f59e0b';
  return '#ef4444';
}

/* ─── sub-components ──────────────────────── */
function Pulse() {
  return (
    <span style={{
      display: 'inline-block', width: 8, height: 8,
      background: '#1ed760', borderRadius: '50%',
      animation: 'pulse 2s infinite',
      flexShrink: 0,
    }} />
  );
}

function MetricCard({
  value, label, sub, accent = false,
}: { value: string; label: string; sub?: string; accent?: boolean }) {
  return (
    <div style={{
      background: '#0e0e0e',
      border: `1px solid ${accent ? '#1ed76033' : '#1a1a1a'}`,
      borderRadius: 14,
      padding: '20px 18px',
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
    }}>
      <div style={{
        fontSize: 28, fontWeight: 800, color: '#1ed760',
        lineHeight: 1.1, letterSpacing: '-0.5px',
      }}>
        {value}
      </div>
      <div style={{
        color: '#555', fontSize: 11,
        textTransform: 'uppercase', letterSpacing: '0.9px', fontWeight: 700,
      }}>
        {label}
      </div>
      {sub && (
        <div style={{ color: '#333', fontSize: 11 }}>{sub}</div>
      )}
    </div>
  );
}

function SectionCard({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: '#111', border: '1px solid #1a1a1a',
      borderRadius: 18, padding: '24px 28px',
      ...style,
    }}>
      {children}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 15, fontWeight: 700, color: '#fff',
      marginBottom: 18, letterSpacing: '-0.2px',
    }}>
      {children}
    </div>
  );
}

function RowLabel({ left, right }: { left: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div style={{
      color: '#444', fontSize: 11, fontWeight: 700,
      textTransform: 'uppercase', letterSpacing: '0.8px',
      marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    }}>
      <span>{left}</span>
      {right && <span style={{ color: '#555' }}>{right}</span>}
    </div>
  );
}

function Timeline({ samples, unit = 'ms' }: { samples: number[]; unit?: string }) {
  const [hovered, setHovered] = useState<number | null>(null);
  if (!samples || samples.length === 0) {
    return <span style={{ color: '#2a2a2a', fontSize: 12 }}>Sin datos aún</span>;
  }
  const max = Math.max(...samples, 1);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 60, position: 'relative' }}>
      {samples.map((v, i) => (
        <div
          key={i}
          onMouseEnter={() => setHovered(i)}
          onMouseLeave={() => setHovered(null)}
          title={`${v}${unit}`}
          style={{
            flex: 1, borderRadius: '3px 3px 0 0', minHeight: 4,
            height: `${Math.max((v / max) * 100, 4)}%`,
            background: latencyColor(v),
            opacity: hovered === null || hovered === i ? 1 : 0.4,
            transition: 'opacity 0.15s, height 0.3s',
            cursor: 'default',
            position: 'relative',
          }}
        >
          {hovered === i && (
            <div style={{
              position: 'absolute', bottom: 'calc(100% + 6px)',
              left: '50%', transform: 'translateX(-50%)',
              background: '#1a1a1a', border: '1px solid #2a2a2a',
              borderRadius: 6, padding: '3px 8px',
              fontSize: 11, color: '#fff', whiteSpace: 'nowrap',
              zIndex: 10, pointerEvents: 'none',
            }}>
              {v}{unit}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function DailyChart({ data }: { data: Array<{ date: string; seconds: number }> }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const maxSecs = Math.max(...data.map(d => d.seconds), 1);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 80, marginBottom: 8 }}>
        {data.map((day, i) => {
          const pct = Math.max((day.seconds / maxSecs) * 100, 3);
          return (
            <div
              key={day.date}
              style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: '100%' }}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            >
              {hovered === i && (
                <div style={{
                  background: '#1a1a1a', border: '1px solid #2a2a2a',
                  borderRadius: 6, padding: '3px 8px',
                  fontSize: 11, color: '#fff', whiteSpace: 'nowrap',
                  alignSelf: 'center', marginBottom: 6,
                }}>
                  {fmtHours(day.seconds)}
                </div>
              )}
              <div style={{
                height: `${pct}%`, minHeight: 3,
                borderRadius: '4px 4px 0 0',
                background: hovered === i
                  ? '#1ed760'
                  : 'linear-gradient(to top, #1ed760, #1ed76044)',
                transition: 'background 0.2s, height 0.4s',
                cursor: 'default',
              }} />
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        {data.map(day => (
          <div key={day.date} style={{
            flex: 1, textAlign: 'center', fontSize: 10,
            color: '#333', fontWeight: 600,
          }}>
            {new Date(day.date + 'T12:00:00').toLocaleDateString('es', { weekday: 'short' })}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── main component ──────────────────────── */
export default function StatsPage({ user }: StatsPageProps) {
  const [stats, setStats] = useState<ServerStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = () => {
    fetch('/api/stats', { credentials: 'include' })
      .then(r => (r.ok ? r.json() : Promise.reject('Error')))
      .then(d => { setStats(d); setLastUpdated(new Date()); })
      .catch(() => setError('No se pudieron cargar las estadísticas'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    intervalRef.current = setInterval(load, 30_000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  if (loading) return (
    <div className="loading">
      <div className="spinner" />
      Cargando estadísticas...
    </div>
  );

  if (error) return (
    <div className="page">
      <div className="alert alert-error">{error}</div>
    </div>
  );

  const latMin = stats?.latencySamples?.length ? Math.min(...stats.latencySamples) : null;
  const latMax = stats?.latencySamples?.length ? Math.max(...stats.latencySamples) : null;
  const procMin = stats?.processingTimes?.length ? Math.min(...stats.processingTimes) : null;
  const procMax = stats?.processingTimes?.length ? Math.max(...stats.processingTimes) : null;
  const maxSecs = stats?.dailyChart?.length ? Math.max(...stats.dailyChart.map(d => d.seconds), 1) : 1;

  // Latency health indicator
  const avgLat = stats?.avgLatencyMs ?? null;
  const latencyHealth = avgLat === null ? null : avgLat < 100 ? 'Excelente' : avgLat < 500 ? 'Normal' : 'Elevada';
  const latencyHealthColor = avgLat === null ? '#555' : avgLat < 100 ? '#1ed760' : avgLat < 500 ? '#f59e0b' : '#ef4444';

  return (
    <div className="page" style={{ maxWidth: 1100 }}>
      {/* Inject pulse keyframe */}
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }`}</style>

      {/* Header */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div className="page-title">Estadísticas</div>
          <div className="page-subtitle">Actividad del servidor</div>
        </div>
        {lastUpdated && (
          <div style={{ color: '#333', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Pulse />
            Actualizado {lastUpdated.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </div>
        )}
      </div>

      {/* ── Top metric row ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: 14, marginBottom: 18,
      }}>
        <MetricCard
          value={fmtHours(stats?.totalListeningSeconds ?? 0)}
          label="Horas escuchadas"
          sub="entre todos los usuarios"
          accent
        />
        <MetricCard
          value={(stats?.totalSongsPlayed ?? 0).toLocaleString('es')}
          label="Canciones reproducidas"
          sub="total histórico"
        />
        <MetricCard
          value={stats?.avgLatencyMs != null ? `${stats.avgLatencyMs} ms` : '— ms'}
          label="Latencia media"
          sub="cliente → servidor"
        />
        <MetricCard
          value={stats?.avgProcessingMs != null ? `${stats.avgProcessingMs} ms` : '— ms'}
          label="Procesado medio"
          sub="por subida de canción"
        />
      </div>

      {/* ── Secondary row: server status + latency health ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 14, marginBottom: 18, flexWrap: 'wrap' }}>

        {/* Server status */}
        <SectionCard>
          <SectionTitle>Estado del servidor</SectionTitle>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <Pulse />
            <span style={{ color: '#888', fontSize: 13 }}>
              En línea en{' '}
              <strong style={{ color: '#ccc', fontWeight: 600 }}>https://yfitops.duckdns.org</strong>
            </span>
          </div>

          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            {stats?.uptime != null && (
              <div>
                <div style={{ color: '#1ed760', fontSize: 22, fontWeight: 800 }}>{fmtUptime(stats.uptime)}</div>
                <div style={{ color: '#444', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.7px', marginTop: 2 }}>Uptime</div>
              </div>
            )}
            {stats?.activeListeners != null && (
              <div>
                <div style={{ color: '#1ed760', fontSize: 22, fontWeight: 800 }}>{stats.activeListeners}</div>
                <div style={{ color: '#444', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.7px', marginTop: 2 }}>Escuchando ahora</div>
              </div>
            )}
            {stats?.peakListeners != null && (
              <div>
                <div style={{ color: '#1ed760', fontSize: 22, fontWeight: 800 }}>{stats.peakListeners}</div>
                <div style={{ color: '#444', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.7px', marginTop: 2 }}>Pico de oyentes</div>
              </div>
            )}
          </div>
        </SectionCard>

        {/* Latency health pill */}
        {latencyHealth && (
          <SectionCard style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minWidth: 140, gap: 8 }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%',
              border: `3px solid ${latencyHealthColor}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 700, color: latencyHealthColor,
              textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'center',
            }}>
              {latencyHealth}
            </div>
            <div style={{ color: '#444', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.7px' }}>
              Latencia
            </div>
          </SectionCard>
        )}
      </div>

      {/* ── Daily chart ── */}
      {stats?.dailyChart && stats.dailyChart.length > 0 && (
        <SectionCard style={{ marginBottom: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
            <SectionTitle>Escucha diaria — últimos 7 días</SectionTitle>
            <span style={{ color: '#1ed760', fontSize: 12, fontWeight: 700 }}>
              {fmtHours(maxSecs)} max
            </span>
          </div>
          <DailyChart data={stats.dailyChart} />
        </SectionCard>
      )}

      {/* ── Latency + Processing timelines side by side ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 18 }}>
        <SectionCard>
          <RowLabel
            left="Latencia — últimas muestras"
            right={latMin !== null && latMax !== null ? `${latMin}–${latMax} ms` : undefined}
          />
          <Timeline samples={stats?.latencySamples ?? []} unit="ms" />
          <div style={{ display: 'flex', gap: 16, marginTop: 12 }}>
            {[['#1ed760', '< 100ms'], ['#f59e0b', '< 500ms'], ['#ef4444', '≥ 500ms']].map(([c, l]) => (
              <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: c, display: 'inline-block' }} />
                <span style={{ color: '#333', fontSize: 11 }}>{l}</span>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard>
          <RowLabel
            left="Procesado — últimas subidas"
            right={procMin !== null && procMax !== null ? `${procMin}–${procMax} ms` : undefined}
          />
          <Timeline samples={stats?.processingTimes ?? []} unit="ms" />
          <div style={{ marginTop: 12, color: '#2a2a2a', fontSize: 11 }}>
            {stats?.processingTimes?.length
              ? `${stats.processingTimes.length} muestras registradas`
              : 'Sin subidas recientes'}
          </div>
        </SectionCard>
      </div>

      {/* ── Top songs (si viene del API) ── */}
      {stats?.topSongs && stats.topSongs.length > 0 && (
        <SectionCard>
          <SectionTitle>Canciones más reproducidas</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {stats.topSongs.map((song, i) => {
              const maxPlays = Math.max(...stats.topSongs!.map(s => s.plays), 1);
              return (
                <div key={i} style={{
                  display: 'grid',
                  gridTemplateColumns: '24px 1fr auto',
                  alignItems: 'center',
                  gap: 14,
                  padding: '12px 0',
                  borderBottom: i < stats.topSongs!.length - 1 ? '1px solid #1a1a1a' : 'none',
                }}>
                  <span style={{ color: '#333', fontSize: 13, fontWeight: 700 }}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <div style={{ overflow: 'hidden' }}>
                    <div style={{ color: '#ccc', fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {song.title}
                    </div>
                    <div style={{ color: '#444', fontSize: 12, marginTop: 2 }}>{song.artist}</div>
                    <div style={{
                      marginTop: 6, height: 3, borderRadius: 2,
                      background: '#1a1a1a', overflow: 'hidden',
                    }}>
                      <div style={{
                        height: '100%', borderRadius: 2,
                        width: `${(song.plays / maxPlays) * 100}%`,
                        background: 'linear-gradient(to right, #1ed760, #1ed76066)',
                        transition: 'width 0.5s',
                      }} />
                    </div>
                  </div>
                  <span style={{ color: '#1ed760', fontSize: 13, fontWeight: 700 }}>
                    {song.plays.toLocaleString('es')}
                  </span>
                </div>
              );
            })}
          </div>
        </SectionCard>
      )}
    </div>
  );
}