import fs from 'fs/promises';
import path from 'path';
import { CANCIONES_DIR, AUDIO_EXTS } from './config.js';
import { readData, writeData } from './storage.js';
import { processAudioFile } from './audio.js';

export async function scanSongsOnStartup() {
  const files = await fs.readdir(CANCIONES_DIR);
  const audioFiles = new Set(files.filter(f => AUDIO_EXTS.includes(path.extname(f).toLowerCase())));
  const data = await readData();
  const before = data.songs.length;
  data.songs = data.songs.filter(s => audioFiles.has(s.filename));
  const removed = before - data.songs.length;

  let added = 0;
  for (const filename of audioFiles) {
    if (!data.songs.some(s => s.filename === filename)) {
      data.songs.push(await processAudioFile(filename));
      added++;
    }
  }

  if (added > 0 || removed > 0) {
    await writeData(data);
  }

  console.log(`[STARTUP] +${added} -${removed} = ${data.songs.length} canciones`);
}
