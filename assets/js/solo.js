// Halaman mode solo (play.php): menghubungkan kamera/keyboard, audio,
// dan GamePlayer, lalu mengirim hasil ke server di akhir lagu.

import { baseUrl, getJson, postJson } from './api.js';
import { AudioEngine } from './audio-engine.js';
import { HandTracker } from './hand-tracker.js';
import { KeyboardInput } from './keyboard-input.js';
import { GamePlayer } from './player.js';

const $ = (id) => document.getElementById(id);
const stage = $('stage');
const slug = stage.dataset.instrumentSlug;
const songId = Number(stage.dataset.songId);

const audio = new AudioEngine({ baseUrl: baseUrl() });
let instrumentData = null;
let songData = null;
let player = null;
let tracker = null;
let keyboard = null;
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
            notes = songData.parts[instrumentData.instrument.id] || [];
            if (notes.length === 0) {
                throw new Error('Lagu ini tidak punya part untuk instrumen ini.');
            }
        }

        player = new GamePlayer({
            instrumentData,
            song: songData ? songData.song : null,
            notes,
            audio,
            els: {
                lane: $('lane'),
                track: $('lane-track'),
                hint: $('hint'),
                beat: $('beat'),
                icon: $('inst-icon'),
                now: $('now'),
            },
            onFinish: finishSong,
        });

        keyboard = new KeyboardInput({ onGestureChange: onGesture });
        const padButtons = instrumentData.gestures
            .filter((gesture) => gesture.finger_count <= 8)
            .map((gesture) => ({
                count: gesture.finger_count,
                label: instrumentData.sounds.find((sound) => sound.id === gesture.sound_id)?.name || '',
            }));
        keyboard.renderPad($('pad'), padButtons, instrumentData.instrument.color);

        tracker = new HandTracker({
            video: $('cam'),
            canvas: $('cam-overlay'),
            onGestureChange: onGesture,
            onStatus: (text) => {
                $('camera-status').textContent = text;
            },
        });

        $('start-gate').hidden = true;
        $('stage-main').hidden = false;
        if ($('song-area')) {
            $('song-area').hidden = false;
        }

        // Layar sentuh: mulai dengan pad. Laptop: mulai dengan kamera.
        const touchFirst = window.matchMedia('(pointer: coarse)').matches;
        await setMode(touchFirst ? 'keys' : 'camera');
    } catch (error) {
        setStatus(error.message);
        button.disabled = false;
    }
});

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

$('volume').addEventListener('input', (event) => {
    audio.setVolume(Number(event.target.value) / 100);
});

// ------------------------------------------------------------------
// Lagu: mulai, selesai, nilai, simpan
// ------------------------------------------------------------------
if (songId > 0) {
    $('btn-play-song').addEventListener('click', () => {
        $('btn-play-song').hidden = true;
        $('result').hidden = true;
        // Hitung mundur satu birama ditambah satu detik, lalu lagu mulai.
        const beatMs = 60000 / songData.song.bpm;
        const countInMs = songData.song.beats_per_bar * beatMs + 1000;
        player.startAt(performance.now() + countInMs);
    });

    $('btn-again').addEventListener('click', () => {
        $('result').hidden = true;
        $('btn-play-song').hidden = false;
        $('hint').textContent = 'Tekan Mulai lagu kalau sudah siap.';
        $('song-area').scrollIntoView({ behavior: 'smooth', block: 'center' });
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
        nickname,
        events: lastEvents,
    };
}

// Dipanggil GamePlayer saat lagu selesai: kirim event ke server untuk dinilai.
async function finishSong(events) {
    lastEvents = events;
    $('result').hidden = false;
    $('save-form').hidden = true;
    $('save-message').textContent = '';
    $('result-accuracy').textContent = '...';
    $('result-detail').textContent = 'Menghitung nilai di server...';
    $('result').scrollIntoView({ behavior: 'smooth', block: 'center' });

    try {
        const result = await postJson('api/submit_performance.php', buildPayload(''));
        $('result-accuracy').textContent = String(result.accuracy).replace('.', ',');
        $('result-detail').textContent = `${result.hits} dari ${result.total_notes} nada kena. ${praise(result.accuracy)}`;
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
    audio.stopAll();
});
