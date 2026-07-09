import React, { useState, useRef } from 'react';
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

  const userRef = useRef(null);
  const passRef = useRef(null);

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

  // En la TV, el teclado virtual del mando manda un "Enter" cada vez que
  // confirmas una letra o lo cierras — NO solo cuando quieres enviar el
  // formulario. Si dejamos que ese Enter burbujee hasta el <form>, se
  // intenta iniciar sesión con cada pulsación (justo el bug que había).
  // Por eso aquí cada campo decide explícitamente qué hacer con Enter, y
  // frenamos la propagación para que nunca llegue a disparar el submit
  // nativo del formulario por accidente.
  const handleUserKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      passRef.current?.focus(); // Enter en "usuario" → salta a "contraseña"
    }
  };

  const handlePassKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      handleLogin(); // Enter en "contraseña" → intenta iniciar sesión
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
          <span style={styles.hint}>{t('login.tvHint')}</span>
        </div>

        {/* onSubmit sigue aquí solo por si algún día se añade un <button type="submit">
            extra; el envío real siempre pasa por handleLogin(), nunca por un Enter suelto. */}
        <form onSubmit={handleLogin} style={styles.form}>
          <div style={styles.inputWrap}>
            <span style={styles.inputIcon}>👤</span>
            <input
              ref={userRef}
              style={styles.input}
              type="text"
              placeholder={t('login.username')}
              value={username}
              onChange={e => setUsername(e.target.value)}
              onKeyDown={handleUserKeyDown}
              autoComplete="username"
              autoFocus
            />
          </div>

          <div style={styles.inputWrap}>
            <span style={styles.inputIcon}>🔒</span>
            <input
              ref={passRef}
              style={styles.input}
              type={showPass ? 'text' : 'password'}
              placeholder={t('login.password')}
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={handlePassKeyDown}
              autoComplete="current-password"
            />
          </div>

          {/* Fila propia para mostrar/ocultar contraseña: con el mando, mientras
              el campo de texto tiene el foco las flechas ← → mueven el CURSOR
              del teclado a propósito (para poder corregir una letra), así que
              nunca se podía "salir" del campo hacia un botón a su lado. Al ser
              una fila aparte, se llega con un simple ↓ / ↑ desde cualquier campo. */}
          <button
            type="button"
            style={styles.showPassRow}
            onClick={() => setShowPass(v => !v)}
          >
            <span style={styles.showPassIcon}>{showPass ? '🙈' : '👁'}</span>
            <span>{showPass ? t('login.hidePassword') : t('login.showPassword')}</span>
          </button>

          {error && <p style={styles.error}>{error}</p>}

          <button
            type="submit"
            style={{ ...styles.loginBtn, opacity: loading ? 0.6 : 1 }}
            disabled={loading}
          >
            {loading ? t('login.signingIn') : t('login.signIn')}
          </button>
        </form>
      </div>
    </div>
  );
}

const styles = {
  bg: { width: '100vw', height: '100vh', background: 'var(--bg0)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  card: { width: 560, background: 'var(--bg2)', borderRadius: 28, padding: '58px 52px', border: '1px solid var(--border)' },
  logoWrap: { display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 46 },
  logoCircle: { width: 128, height: 128, borderRadius: '50%', overflow: 'hidden', border: '3px solid #1ed76055', marginBottom: 20 },
  logoImg: { width: '100%', height: '100%', objectFit: 'cover' },
  appName: { fontSize: 42, fontWeight: 800, color: 'var(--text)', letterSpacing: -1 },
  hint: { marginTop: 12, fontSize: 16, color: 'var(--text-dim)', fontWeight: 600, textAlign: 'center' },
  form: { display: 'flex', flexDirection: 'column', gap: 20 },
  inputWrap: { display: 'flex', alignItems: 'center', background: 'var(--bg3)', borderRadius: 14, border: '1px solid var(--border-strong)', padding: '0 22px' },
  inputIcon: { fontSize: 23, marginRight: 14, flexShrink: 0 },
  input: { flex: 1, background: 'none', border: 'none', outline: 'none', color: 'var(--text)', fontSize: 22, padding: '22px 0' },
  showPassRow: {
    display: 'flex', alignItems: 'center', gap: 12,
    background: 'none', border: '1px dashed var(--border-strong)', borderRadius: 12,
    padding: '13px 18px', color: 'var(--text-muted)', fontSize: 17, fontWeight: 600,
    cursor: 'pointer', alignSelf: 'flex-start',
  },
  showPassIcon: { fontSize: 19 },
  error: { color: '#ff5555', fontSize: 17, textAlign: 'center' },
  loginBtn: { background: '#1ed760', border: 'none', borderRadius: 14, padding: '22px 0', color: '#000', fontWeight: 800, fontSize: 22, cursor: 'pointer', marginTop: 10 },
};
