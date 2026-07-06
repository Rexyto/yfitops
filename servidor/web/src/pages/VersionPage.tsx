import { useEffect, useState } from 'react';

interface VersionData {
  version: string;
  apkUrl?: string;
  pc?: {
    version: string;
    exeUrl?: string;
  };
}

interface ChangelogData {
  version: string;
  notes: string;
  pc?: {
    version: string;
    notes: string;
  };
}

export default function VersionPage() {
  const [version, setVersion] = useState<VersionData | null>(null);
  const [changelog, setChangelog] = useState<ChangelogData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const vRes = await fetch('/web/version', { credentials: 'include' });
        const chRes = await fetch('/api/changelog', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });

        if (vRes.ok) setVersion(await vRes.json());
        if (chRes.ok) setChangelog(await chRes.json());
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return <div className="page">Cargando versiones...</div>;
  }

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">Versiones y actualizaciones</div>
        <div className="page-subtitle">Descarga la última versión para tu plataforma</div>
      </div>

      <div style={{ marginBottom: '2rem' }}>
        <div className="page-subtitle" style={{ marginBottom: '1rem' }}>Aplicación Móvil (Android)</div>
        <div className="card" style={{ borderLeft: '4px solid var(--accent)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
            <div>
              <h3 style={{ fontSize: '1.3rem', marginBottom: '0.5rem' }}>v{version?.version}</h3>
              <p style={{ color: 'var(--accent)', fontWeight: '600', marginBottom: '1rem' }}>Versión actual</p>
              <div style={{ 
                fontSize: '0.875rem', 
                color: 'var(--text-2)', 
                lineHeight: '1.8',
                whiteSpace: 'pre-wrap'
              }}>
                {changelog?.notes}
              </div>
            </div>
            <a
              href="/downloads/yfitopsapp.apk"
              style={{
                padding: '0.75rem 1.5rem',
                background: 'var(--accent)',
                color: '#000',
                borderRadius: '8px',
                textDecoration: 'none',
                fontWeight: '600',
                fontSize: '0.9rem',
                whiteSpace: 'nowrap',
                marginLeft: '1rem'
              }}
            >
              Descargar APK
            </a>
          </div>
        </div>
      </div>

      <div style={{ marginBottom: '2rem' }}>
        <div className="page-subtitle" style={{ marginBottom: '1rem' }}>Aplicación PC (Windows)</div>
        <div className="card" style={{ borderLeft: '4px solid #5865F2' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
            <div>
              <h3 style={{ fontSize: '1.3rem', marginBottom: '0.5rem' }}>v{version?.pc?.version || '1.0.0'}</h3>
              <p style={{ color: '#5865F2', fontWeight: '600', marginBottom: '1rem' }}>Nuevo</p>
              <div style={{ 
                fontSize: '0.875rem', 
                color: 'var(--text-2)', 
                lineHeight: '1.8',
                whiteSpace: 'pre-wrap'
              }}>
                {changelog?.pc?.notes || '• Aplicación de PC totalmente nueva\n• Interfaz elegante\n• Control completo de reproducción\n• Sincronización con tu cuenta'}
              </div>
            </div>
            <a
              href="/downloads/yfitopspc.exe"
              style={{
                padding: '0.75rem 1.5rem',
                background: '#5865F2',
                color: '#fff',
                borderRadius: '8px',
                textDecoration: 'none',
                fontWeight: '600',
                fontSize: '0.9rem',
                whiteSpace: 'nowrap',
                marginLeft: '1rem'
              }}
            >
              Descargar EXE
            </a>
          </div>
        </div>
      </div>

      <div>
        <div className="page-subtitle" style={{ marginBottom: '1rem' }}>Historial de versiones</div>
        
        <div className="card" style={{ marginBottom: '1rem', background: 'var(--bg-2)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
            <div>
              <h4 style={{ fontSize: '1.1rem', marginBottom: '0.3rem' }}>v2.0.0</h4>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-3)', marginBottom: '0.75rem' }}>28 de Abril, 2026</p>
              <ul style={{ fontSize: '0.875rem', color: 'var(--text-2)', marginLeft: '1.2rem', lineHeight: '1.8' }}>
                <li>Arreglado bug de iconos — ahora se ven correctamente en todos los dispositivos</li>
                <li>Soporte multiusuario — varios usuarios pueden usar la app con su cuenta propia</li>
                <li>Mejorado el sistema de favoritos — ya no desaparecen al marcarlos</li>
                <li>Mejorada la latencia de carga de canciones</li>
                <li>La música ahora avanza a la siguiente canción aunque la pantalla esté apagada</li>
                <li>Nuevo panel de estadísticas en el servidor</li>
              </ul>
            </div>
            <span className="badge badge-green" style={{ marginLeft: '1rem', whiteSpace: 'nowrap' }}>Actual</span>
          </div>
        </div>

        <div className="card" style={{ marginBottom: '1rem', background: 'var(--bg-2)' }}>
          <div>
            <h4 style={{ fontSize: '1.1rem', marginBottom: '0.3rem' }}>v1.0.0</h4>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-3)', marginBottom: '0.75rem' }}>20 de Abril, 2026</p>
            <ul style={{ fontSize: '0.875rem', color: 'var(--text-2)', marginLeft: '1.2rem', lineHeight: '1.8' }}>
              <li>API de búsqueda mejorada</li>
              <li>Habilitada la creación de usuarios</li>
              <li>Soporte para colecciones y playlists</li>
              <li>Arreglado bug con iconos</li>
            </ul>
          </div>
        </div>

        <div className="card" style={{ background: 'var(--bg-2)' }}>
          <div>
            <h4 style={{ fontSize: '1.1rem', marginBottom: '0.3rem' }}>v0.0.1</h4>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-3)', marginBottom: '0.75rem' }}>6 de Abril, 2026</p>
            <ul style={{ fontSize: '0.875rem', color: 'var(--text-2)', marginLeft: '1.2rem', lineHeight: '1.8' }}>
              <li>Lanzamiento inicial</li>
              <li>Reproducción básica de música</li>
              <li>Subida de canciones al servidor</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}