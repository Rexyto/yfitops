interface CreditsPageProps {
  user: { username: string; role: 'superadmin' | 'user' };
}

const GithubIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 .5C5.65.5.5 5.65.5 12a11.5 11.5 0 0 0 7.86 10.94c.57.1.78-.25.78-.55v-1.94c-3.2.7-3.87-1.36-3.87-1.36-.53-1.34-1.29-1.7-1.29-1.7-1.06-.72.08-.71.08-.71 1.17.08 1.78 1.2 1.78 1.2 1.04 1.78 2.72 1.27 3.38.97.1-.75.4-1.27.73-1.56-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.29 1.19-3.09-.12-.29-.52-1.47.11-3.06 0 0 .97-.31 3.18 1.18a11.1 11.1 0 0 1 5.8 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.77.11 3.06.74.8 1.19 1.83 1.19 3.09 0 4.41-2.7 5.38-5.27 5.67.42.36.78 1.07.78 2.16v3.2c0 .3.21.66.79.55A11.5 11.5 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5z" />
  </svg>
);

const HeartIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.8 1-1a5.5 5.5 0 0 0 0-7.8z" />
  </svg>
);

export default function CreditsPage({ user }: CreditsPageProps) {
  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">Créditos</div>
        <div className="page-subtitle">Las personas y herramientas detrás de YFitops</div>
      </div>

      <div className="credits-grid" style={{ marginBottom: '1.5rem' }}>
        <div className="card credit-card">
          <div className="credit-avatar"><GithubIcon /></div>
          <div>
            <div className="card-title" style={{ marginBottom: 2 }}>Rexy</div>
            <a
              href="https://github.com/Rexyto"
              target="_blank"
              rel="noreferrer"
              style={{ color: 'var(--accent)', fontSize: '0.85rem', textDecoration: 'none', fontWeight: 600 }}
            >
              Desarrollador principal — github.com/Rexyto
            </a>
          </div>
        </div>

        <div className="card credit-card">
          <div className="credit-avatar"><HeartIcon /></div>
          <div>
            <div className="card-title" style={{ marginBottom: 2 }}>Gracias por usar YFitops</div>
            <div style={{ color: 'var(--text-2)', fontSize: '0.85rem' }}>
              Hola, {user.username} 👋 este proyecto se mantiene entre ratos libres.
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Tecnologías utilizadas</div>
        <div className="tech-list">
          <span className="tech-pill">React</span>
          <span className="tech-pill">TypeScript</span>
          <span className="tech-pill">Vite</span>
          <span className="tech-pill">React Router</span>
          <span className="tech-pill">Node.js</span>
        </div>
      </div>
    </div>
  );
}
