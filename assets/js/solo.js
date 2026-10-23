// Halaman mode solo (play.php): menghubungkan kamera/keyboard, audio,
// panel pengaturan, dan GamePlayer, lalu mengirim hasil ke server di akhir lagu.

import { baseUrl, getJson, postJson } from './api.js';
import { AudioEngine } from './audio-engine.js';
import { HandTracker } from './hand-tracker.js';
import { KeyboardInput } from './keyboard-input.js';
import { GamePlayer } from './player.js';
import { InstrumentView } from './instrument-view.js';
import { keyName, MIN_TRANSPOSE, MAX_TRANSPOSE } from './music.js';

const $ = (id) => document.getElementById(id);
const stage = $('stage');
const slug = stage.dataset.instrumentSlug;
const songId = Number(stage.dataset.songId);
const partStyle = stage.dataset.partStyle;                  // 'notes' atau 'chords'
const tempoPercent = Number(stage.dataset.tempo);           // 50 sampai 100
const freeBpm = Number(stage.dataset.freeBpm);
let transpose = Number(stage.dataset.defaultTranspose);     // nada dasar awal dari lagu

const audio = new AudioEngine({ baseUrl: baseUrl() });
let instrumentData = null;
let songData = null;
let player = null;
let tracker = null;
let keyboard = null;
let view = null;          // keyboard piano / deretan nada / set drum
let mode = null;          // 'camera' atau 'keys'
let lastEvents = [];      // event lagu terakhir, dikirim ulang saat menyimpan

// Semua gestur (kamera maupun keyboard) masuk lewat satu pintu ini.
function onGesture(count, atMs) {
    if (player) {
        player.handleGesture(count, atMs);
    }
}

function setStatus(text) {
    $('status').textContent = text;
}

// ------------------------------------------------------------------
// Langkah 1: tombol "Siapkan instrumen"
// ------------------------------------------------------------------
$('btn-start').addEventListener('click', async () => {
    const button = $('btn-start');
    button.disabled = true;
    try {
        setStatus('Menyalakan suara...');
        await audio.unlock();

        setStatus('Mengambil data instrumen...');
        instrumentData = await getJson('api/instrument.php?slug=' + encodeURIComponent(slug));
        await audio.loadSamples(instrumentData.sounds);

        let notes = [];
        if (songId > 0) {
            setStatus('Mengambil partitur...');
            songData = await getJson('api/song.php?id=' + songId);
            const part = songData.parts.find((p) => p.instrument_id === instrumentData.instrument.id && p.style === partStyle);
            if (!part) {
                throw new Error('Lagu ini tidak punya part ' + (partStyle === 'chords' ? 'akor' : 'melodi') + ' untuk instrumen ini.');
            }
            notes = part.notes;
            // Tempo latihan: GamePlayer cukup diberi bpm efektif, sisanya ikut.
            songData.song.bpm = songData.song.bpm * tempoPercent / 100;
        }

        // Visual instrumen juga berfungsi sebagai pad, tetapi hanya di mode keyboard
        // (di mode kamera, tekanan diabaikan supaya tidak bentrok dengan gestur).
        view = new InstrumentView({
            container: $('inst-view'),
            instrumentData,
            onPress: (count, atMs) => mode === 'keys' && onGesture(count, atMs),
            onRelease: (atMs) => mode === 'keys' && onGesture(0, atMs),
        });
        view.style = partStyle;

        player = new GamePlayer({
            instrumentData,
            song: songData ? songData.song : null,
            notes,
            style: partStyle,
            freeBpm,
            audio,
            els: {
                lane: $('lane'),
                track: $('lane-track'),
                hint: $('hint'),
                beat: $('beat'),
                icon: $('inst-icon'),
                now: $('now'),
            },
            view,
            onFinish: finishSong,
        });

        keyboard = new KeyboardInput({ onGestureChange: onGesture });

        tracker = new HandTracker({
            video: $('cam'),
            canvas: $('cam-overlay'),
            onGestureChange: onGesture,
            onStatus: (text) => {
                $('camera-status').textContent = text;
            },
        });

        setupSettings();
        applyTranspose(transpose);

        $('start-gate').hidden = true;
        $('stage-main').hidden = false;
        $('mode-switch').hidden = false;
        // Tata letak satu layar penuh (header situs disembunyikan, lihat app.css).
        stage.classList.add('is-live');
        document.body.classList.add('stage-live');
        if (document.fullscreenEnabled) {
            $('btn-fullscreen').hidden = false;
        }
        player.updateHint(true);

        // Layar sentuh: mulai dengan pad. Laptop: mulai dengan kamera.
        const touchFirst = window.matchMedia('(pointer: coarse)').matches;
        await setMode(touchFirst ? 'keys' : 'camera');
    } catch (error) {
        setStatus(error.message);
        button.disabled = false;
    }
});

// ------------------------------------------------------------------
// Panel pengaturan
// ------------------------------------------------------------------
function setupSettings() {
    $('volume').addEventListener('input', (event) => audio.setVolume(Number(event.target.value) / 100));
    $('reverb').addEventListener('input', (event) => audio.setReverb(Number(event.target.value) / 100));

    if ($('transpose-down')) {
        $('transpose-down').addEventListener('click', () => applyTranspose(transpose - 1));
        $('transpose-up').addEventListener('click', () => applyTranspose(transpose + 1));
    }

    // Gaya main (hanya di mode bebas; saat bermain lagu, gaya dipilih sebelum masuk panggung).
    document.querySelectorAll('[data-style]').forEach((btn) => {
        btn.addEventListener('click', () => {
            player.setStyle(btn.dataset.style);
            refreshStyleUi();
        });
    });

    if ($('bass')) {
        $('bass').addEventListener('change', (event) => player.setOption('bass', Number(event.target.value)));
        $('rhythm').addEventListener('change', (event) => player.setOption('rhythm', event.target.value));
    }
    if ($('auto-hihat')) {
        $('auto-hihat').addEventListener('change', (event) => player.setOption('autoHihat', event.target.checked));
    }
    refreshStyleUi();
}

// Nada dasar: -6 sampai 6 semitone, tampil sebagai "Do = D".
function applyTranspose(value) {
    transpose = Math.min(MAX_TRANSPOSE, Math.max(MIN_TRANSPOSE, value));
    view.setTranspose(transpose);       // gambar ulang keyboard dulu, baru tanda nada berikutnya
    player.setTranspose(transpose);
    if ($('transpose-label')) {
        $('transpose-label').textContent = 'Do = ' + keyName(transpose);
    }
    renderCheat();
}

function refreshStyleUi() {
    document.querySelectorAll('[data-style]').forEach((btn) => {
        btn.classList.toggle('is-active', btn.dataset.style === player.style);
        btn.setAttribute('aria-pressed', btn.dataset.style === player.style ? 'true' : 'false');
    });
    if ($('chord-options')) {
        $('chord-options').hidden = player.style !== 'chords';
    }
    view.setStyle(player.style);
    player.updateHint(true);
    renderCheat();
}

// Contekan mengikuti gaya (nada atau akor) dan nada dasar.
function renderCheat() {
    const gestures = instrumentData.gestures.slice().sort((a, b) => a.finger_count - b.finger_count);
    const soundOf = (gesture) => instrumentData.sounds.find((sound) => sound.id === gesture.sound_id);

    const cheat = $('cheat');
    cheat.replaceChildren();
    for (const gesture of gestures) {
        const sound = soundOf(gesture);
        const item = document.createElement('li');
        const badge = document.createElement('span');
        badge.className = 'finger-count';
        badge.textContent = String(gesture.finger_count);
        item.append(badge, ' ' + (sound ? player.soundLabel(sound) : ''));
        cheat.appendChild(item);
    }
}

// ------------------------------------------------------------------
// Mode panggung: layar penuh untuk demo di proyektor (Fullscreen API)
// ------------------------------------------------------------------
$('btn-fullscreen').addEventListener('click', async () => {
    try {
        if (document.fullscreenElement) {
            await document.exitFullscreen();
        } else {
            await stage.requestFullscreen();
        }
    } catch (error) {
        $('now').textContent = 'Layar penuh ditolak browser.';
    }
});
document.addEventListener('fullscreenchange', () => {
    $('btn-fullscreen').textContent = document.fullscreenElement ? 'Keluar mode panggung' : 'Mode panggung';
});

// Selama lagu berjalan, nada dasar tidak boleh diganti.
function lockSettings(locked) {
    ['transpose-down', 'transpose-up'].forEach((id) => {
        if ($(id)) {
            $(id).disabled = locked;
        }
    });
}

// ------------------------------------------------------------------
// Beralih kamera <-> keyboard kapan saja
// ------------------------------------------------------------------
async function setMode(newMode) {
    if (newMode === mode) {
        return;
    }
    mode = newMode;
    document.querySelectorAll('[data-mode]').forEach((btn) => {
        btn.classList.toggle('is-active', btn.dataset.mode === mode);
        btn.setAttribute('aria-pressed', btn.dataset.mode === mode ? 'true' : 'false');
    });
    $('camera-box').hidden = mode !== 'camera';
    $('keys-box').hidden = mode !== 'keys';
    view.setInteractive(mode === 'keys');

    if (mode === 'keys') {
        tracker.stop();
        keyboard.setEnabled(true);
        return;
    }

    keyboard.setEnabled(false);
    try {
        await tracker.start();
    } catch (error) {
        // Kamera gagal: beri tahu, lalu otomatis pindah ke keyboard supaya tetap bisa main.
        $('now').textContent = error.message;
        await setMode('keys');
    }
}

document.querySelectorAll('[data-mode]').forEach((btn) => {
    btn.addEventListener('click', () => setMode(btn.dataset.mode));
});

// ------------------------------------------------------------------
// Lagu: mulai, selesai, nilai, simpan
// ------------------------------------------------------------------
if (songId > 0) {
    $('btn-play-song').addEventListener('click', () => {
        $('btn-play-song').hidden = true;
        $('result').hidden = true;
        lockSettings(true);
        // Hitung mundur satu birama (berbunyi klik) ditambah satu detik, lalu lagu mulai.
        const beatMs = 60000 / songData.song.bpm;
        const countInMs = songData.song.beats_per_bar * beatMs + 1000;
        player.startAt(performance.now() + countInMs);
    });

    $('btn-again').addEventListener('click', () => {
        $('result').hidden = true;
        $('btn-play-song').hidden = false;
        $('hint').textContent = 'Tekan Mulai lagu kalau sudah siap.';
    });

    $('save-form').addEventListener('submit', async (event) => {
        event.preventDefault();
        const nickname = $('nickname').value.trim();
        const button = event.submitter;
        button.disabled = true;
        try {
            const result = await postJson('api/submit_performance.php', buildPayload(nickname));
            $('save-message').textContent = `Tersimpan! ${result.nickname} ada di peringkat ${result.rank}.`;
            $('save-form').hidden = true;
        } catch (error) {
            $('save-message').textContent = error.message;
            button.disabled = false;
        }
    });
}

function buildPayload(nickname) {
    return {
        mode: 'solo',
        song_id: songId,
        instrument_id: instrumentData.instrument.id,
        part_style: partStyle,
        tempo_percent: tempoPercent,
        nickname,
        events: lastEvents,
    };
}

// Dipanggil GamePlayer saat lagu selesai: kirim event ke server untuk dinilai.
async function finishSong(events) {
    lastEvents = events;
    lockSettings(false);
    $('result').hidden = false;
    $('save-form').hidden = true;
    $('save-message').textContent = '';
    $('result-accuracy').textContent = '...';
    $('result-detail').textContent = 'Menghitung nilai di server...';

    try {
        const result = await postJson('api/submit_performance.php', buildPayload(''));
        const unit = partStyle === 'chords' ? 'akor' : 'nada';
        $('result-accuracy').textContent = String(result.accuracy).replace('.', ',');
        $('result-detail').textContent = `${result.hits} dari ${result.total_notes} ${unit} kena. ${praise(result.accuracy)}`;
        $('result-mascot').src = baseUrl() + '/assets/img/' + mascotFor(result.accuracy);
        $('save-form').hidden = false;
        $('save-form').querySelector('button').disabled = false;
    } catch (error) {
        $('result-accuracy').textContent = '-';
        $('result-detail').textContent = error.message;
    }
    $('btn-play-song').hidden = true;
}

function praise(accuracy) {
    if (accuracy >= 90) return 'Rapi sekali, siap manggung!';
    if (accuracy >= 70) return 'Mantap, tinggal sedikit lagi.';
    if (accuracy >= 40) return 'Lumayan. Coba lagi dengan tempo di kepala.';
    return 'Pemanasan dulu. Cek contekan jari di samping.';
}

function mascotFor(accuracy) {
    if (accuracy >= 80) return 'mascot-cheer.svg';
    if (accuracy >= 40) return 'mascot-wave.svg';
    return 'mascot-oops.svg';
}

// Tinggalkan halaman: matikan kamera dan suara.
window.addEventListener('pagehide', () => {
    if (tracker) tracker.stop();
    if (player) player.destroy();
    audio.stopAll();
});
