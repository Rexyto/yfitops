import React, { useState } from 'react';
import useMusicStore from '../store/MusicStore';
import { pcLogin } from '../api';
import logo from '../../public/logo.png';

export default function LoginScreen() {
  const login = useMusicStore(s => s.login);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e?.preventDefault();
    if (!username.trim() || !password.trim()) { setError('Rellena usuario y contraseña'); return; }
    setLoading(true); setError('');
    try {
      const data = await pcLogin(username.trim(), password.trim());
      await login(data.token, data.username);
    } catch (err) {
      setError(err.message || 'Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.bg}>
      <div style={styles.card}>
        <div style={styles.logoWrap}>
          <div style={styles.logoCircle}>
            <img src={logo} style={styles.logoImg} alt="YFitops" />
          </div>
          <span style={styles.appName}>YFitops</span>
        </div>

        <form onSubmit={handleLogin} style={styles.form}>
          <div style={styles.inputWrap}>
            <span style={styles.inputIcon}>👤</span>
            <input
              style={styles.input}
              type="text"
              placeholder="Usuario"
              value={username}
              onChange={e => setUsername(e.target.value)}
              autoComplete="username"
              autoFocus
            />
          </div>

          <div style={styles.inputWrap}>
            <span style={styles.inputIcon}>🔒</span>
            <input
              style={styles.input}
              type={showPass ? 'text' : 'password'}
              placeholder="Contraseña"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
            />
            <button type="button" style={styles.eyeBtn} onClick={() => setShowPass(v => !v)}>
              {showPass ? '🙈' : '👁'}
            </button>
          </div>

          {error && <p style={styles.error}>{error}</p>}

          <button type="submit" style={{ ...styles.loginBtn, opacity: loading ? 0.6 : 1 }} disabled={loading}>
            {loading ? '...' : 'Iniciar sesión'}
          </button>
        </form>
      </div>
    </div>
  );
}

const styles = {
  bg: { width: '100vw', height: '100vh', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  card: { width: 360, background: '#111', borderRadius: 20, padding: '40px 36px', border: '1px solid #222' },
  logoWrap: { display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 36 },
  logoCircle: { width: 90, height: 90, borderRadius: '50%', overflow: 'hidden', border: '2px solid #1ed76055', marginBottom: 14 },
  logoImg: { width: '100%', height: '100%', objectFit: 'cover' },
  appName: { fontSize: 30, fontWeight: 800, color: '#fff', letterSpacing: -1 },
  form: { display: 'flex', flexDirection: 'column', gap: 12 },
  inputWrap: { display: 'flex', alignItems: 'center', background: '#1a1a1a', borderRadius: 10, border: '1px solid #2a2a2a', padding: '0 14px' },
  inputIcon: { fontSize: 16, marginRight: 10, flexShrink: 0 },
  input: { flex: 1, background: 'none', border: 'none', outline: 'none', color: '#fff', fontSize: 15, padding: '14px 0' },
  eyeBtn: { background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, padding: 6 },
  error: { color: '#ff5555', fontSize: 13, textAlign: 'center' },
  loginBtn: { background: '#1ed760', border: 'none', borderRadius: 10, padding: '14px 0', color: '#000', fontWeight: 800, fontSize: 16, cursor: 'pointer', marginTop: 6 },
};