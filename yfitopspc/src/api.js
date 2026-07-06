const SERVER_URL = 'https://yfitops.duckdns.org';

export { SERVER_URL };

function headers(token) {
  const authToken = typeof token === 'string' ? token.trim() : '';
  const headers = { 'Content-Type': 'application/json' };
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
    console.log('🔐 Authorization header:', `Bearer ${authToken.substring(0, 20)}...`);
  }
  return headers;
}

// ─── Auth ────────────────────────────────────────────────────────────────────

export async function pcLogin(username, password) {
  const r = await fetch(`${SERVER_URL}/pc/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || 'Credenciales incorrectas');
  return {
    token: data.token || data.accessToken || data.access_token || data.authToken || data.auth_token,
    username: data.username || data.user || data.name || '',
    ...data,
  };
}

export async function pcVerify(token) {
  const r = await fetch(`${SERVER_URL}/pc/verify`, { headers: headers(token) });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || 'Token inválido');
  return data; // { valid, username, id }
}

// ─── Versión / Changelog ─────────────────────────────────────────────────────

export async function pcVersion(token) {
  const r = await fetch(`${SERVER_URL}/pc/version`, { headers: headers(token) });
  if (!r.ok) return null;
  return r.json(); // { version, exeUrl }
}

export async function pcChangelog(token) {
  const r = await fetch(`${SERVER_URL}/pc/changelog`, { headers: headers(token) });
  if (!r.ok) return null;
  return r.json(); // { version, notes }
}

// ─── Canciones ───────────────────────────────────────────────────────────────

export async function pcFetchSongs(token, search = '') {
  const url = search
    ? `${SERVER_URL}/pc/songs?search=${encodeURIComponent(search)}`
    : `${SERVER_URL}/pc/songs`;
  console.log('📀 Fetching songs from:', url);
  const r = await fetch(url, { headers: headers(token) });
  if (!r.ok) {
    console.error('❌ Error cargando canciones:', r.status, r.statusText);
    throw new Error('Error cargando canciones');
  }
  const data = await r.json();
  console.log('✅ Canciones cargadas:', data.length);
  return data; // Song[]
}

export async function pcFetchMySongs(token) {
  const r = await fetch(`${SERVER_URL}/pc/mysongs`, { headers: headers(token) });
  if (!r.ok) return [];
  return r.json(); // Song[]
}

// ─── Favoritos ───────────────────────────────────────────────────────────────

export async function pcFetchFavorites(token) {
  console.log('❤️ Fetching favorites from:', `${SERVER_URL}/pc/favorites`);
  const r = await fetch(`${SERVER_URL}/pc/favorites`, { headers: headers(token) });
  if (!r.ok) {
    console.error('❌ Error cargando favoritos:', r.status, r.statusText);
    return [];
  }
  const data = await r.json();
  console.log('✅ Favoritos cargados:', data.length);
  return data; // string[] de IDs
}

export async function pcToggleFavorite(token, songId, isFav) {
  await fetch(`${SERVER_URL}/pc/favorites/${songId}`, {
    method: isFav ? 'DELETE' : 'POST',
    headers: headers(token),
  });
  return pcFetchFavorites(token);
}

// ─── Playlists ───────────────────────────────────────────────────────────────

export async function pcFetchPlaylists(token) {
  console.log('📋 Fetching playlists from:', `${SERVER_URL}/pc/playlists`);
  const r = await fetch(`${SERVER_URL}/pc/playlists`, { headers: headers(token) });
  if (!r.ok) {
    console.error('❌ Error cargando playlists:', r.status, r.statusText);
    return [];
  }
  const data = await r.json();
  console.log('✅ Playlists cargadas:', data.length);
  return data;
}

export async function pcFetchFolderPlaylists(token) {
  console.log('📂 Fetching folderPlaylists from:', `${SERVER_URL}/pc/folderplaylists`);
  const r = await fetch(`${SERVER_URL}/pc/folderplaylists`, { headers: headers(token) });
  if (!r.ok) {
    console.error('❌ Error cargando folderPlaylists:', r.status, r.statusText);
    return [];
  }
  const data = await r.json();
  console.log('✅ FolderPlaylists cargadas:', data.length);
  return data;
}

export async function pcCreatePlaylist(token, name, songs = [], coverColor = '#1DB954') {
  const r = await fetch(`${SERVER_URL}/pc/playlists`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({ name, songs, coverColor }),
  });
  return r.json();
}

export async function pcUpdatePlaylist(token, playlistId, updates) {
  const r = await fetch(`${SERVER_URL}/pc/playlists/${playlistId}`, {
    method: 'PUT',
    headers: headers(token),
    body: JSON.stringify(updates),
  });
  return r.json();
}

export async function pcDeletePlaylist(token, playlistId) {
  const r = await fetch(`${SERVER_URL}/pc/playlists/${playlistId}`, {
    method: 'DELETE',
    headers: headers(token),
  });
  return r.json(); // { success: true }
}

// ─── Telemetría ──────────────────────────────────────────────────────────────

export async function pcHeartbeat(token, { songId = null, isPlaying, elapsedMs = 0 } = {}) {
  const r = await fetch(`${SERVER_URL}/pc/heartbeat`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({ songId, isPlaying, elapsedMs }),
  });
  if (!r.ok) return { activeListeners: 0 };
  return r.json(); // { activeListeners: number }
}

export async function pcSendLatency(token, latencyMs) {
  await fetch(`${SERVER_URL}/pc/latency`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({ latencyMs }),
  });
}

export async function pcFetchListeners(token) {
  const status = await pcFetchStatus(token);
  return status?.activeListeners ?? 0;
}

export async function pcUpdateSong(token, songId, updates) {
  const r = await fetch(`${SERVER_URL}/pc/songs/${songId}`, {
    method: 'PUT',
    headers: headers(token),
    body: JSON.stringify(updates),
  });
  if (!r.ok) throw new Error('Error actualizando canción');
  return r.json();
}

export async function pcUploadCover(token, songId, file) {
  const form = new FormData();
  form.append('cover', file);
  const r = await fetch(`${SERVER_URL}/pc/songs/${songId}/cover`, {
    method: 'POST',
    headers: headers(token),
    body: form,
  });
  if (!r.ok) throw new Error('Error subiendo portada');
  return r.json();
}

// ─── Estado / Conectividad ───────────────────────────────────────────────────

export async function pcFetchStatus(token) {
  const r = await fetch(`${SERVER_URL}/pc/status`, { headers: headers(token) });
  if (!r.ok) return null;
  return r.json(); // { songs, playlists, users, activeListeners, status }
}

export async function pcPing(token) {
  const r = await fetch(`${SERVER_URL}/pc/ping`, { headers: headers(token) });
  if (!r.ok) return null;
  return r.json(); // { pong: timestamp }
}