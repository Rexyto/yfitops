import React, { useState } from 'react';
import useMusicStore from '../store/MusicStore';
import { pcLogin } from '../api';
import { useT } from '../i18n';
import logo from '../../public/logo.png';

export default function LoginScreen() {
  const login = useMusicStore(s => s.login);
  const t = useT();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e?.preventDefault();
    if (!username.trim() || !password.trim()) { setError(t('login.errorEmpty')); return; }
    setLoading(true); setError('');
    try {
      const data = await pcLogin(username.trim(), password.trim());
      await login(data.token, data.username);
    } catch (err) {
      setError(err.message || t('login.errorConnection'));
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
              placeholder={t('login.username')}
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
              placeholder={t('login.password')}
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
            {loading ? t('login.signingIn') : t('login.signIn')}
          </button>
        </form>
      </div>
    </div>
  );
}

const styles = {
  bg: { width: '100vw', height: '100vh', background: 'var(--bg0)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  card: { width: 360, background: 'var(--bg2)', borderRadius: 20, padding: '40px 36px', border: '1px solid var(--border)' },
  logoWrap: { display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 36 },
  logoCircle: { width: 90, height: 90, borderRadius: '50%', overflow: 'hidden', border: '2px solid #1ed76055', marginBottom: 14 },
  logoImg: { width: '100%', height: '100%', objectFit: 'cover' },
  appName: { fontSize: 30, fontWeight: 800, color: 'var(--text)', letterSpacing: -1 },
  form: { display: 'flex', flexDirection: 'column', gap: 12 },
  inputWrap: { display: 'flex', alignItems: 'center', background: 'var(--bg3)', borderRadius: 10, border: '1px solid var(--border-strong)', padding: '0 14px' },
  inputIcon: { fontSize: 16, marginRight: 10, flexShrink: 0 },
  input: { flex: 1, background: 'none', border: 'none', outline: 'none', color: 'var(--text)', fontSize: 15, padding: '14px 0' },
  eyeBtn: { background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, padding: 6 },
  error: { color: '#ff5555', fontSize: 13, textAlign: 'center' },
  loginBtn: { background: '#1ed760', border: 'none', borderRadius: 10, padding: '14px 0', color: '#000', fontWeight: 800, fontSize: 16, cursor: 'pointer', marginTop: 6 },
};