import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles.css';

export default function LoginPage({ onLogin }: any) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      const res = await fetch('/web/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      if (!res.ok) {
        setError('Usuario o contraseña incorrectos');
        return;
      }

      const me = await fetch('/web/me').then(r => r.json());

      onLogin(me);
      navigate('/home');

    } catch (err) {
      setError('Error de conexión con el servidor');
    }
  };

  return (
    <div className="login-page">
      <form onSubmit={handleLogin} className="login-card">
        <h1 className="title">YFitops</h1>

        <input
          className="input"
          placeholder="Usuario"
          value={username}
          onChange={e => setUsername(e.target.value)}
        />

        <input
          className="input"
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={e => setPassword(e.target.value)}
        />

        {error && <div className="error">{error}</div>}

        <button className="button" type="submit">
          Entrar
        </button>
      </form>
    </div>
  );
}