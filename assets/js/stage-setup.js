// Menyiapkan panggung bermain (includes/stage.php). Dipakai bersama oleh
// mode solo (solo.js) dan main bersama (lobby.js), supaya keduanya memakai
// kode yang sama untuk audio, kamera, keyboard, visual instrumen, dan panel.

import { getJson, baseUrl } from './api.js';
import { AudioEngine } from './audio-engine.js';
import { HandTracker } from './hand-tracker.js';
import { KeyboardInput } from './keyboard-input.js';
import { GamePlayer } from './player.js';
import { InstrumentView } from './instrument-view.js';
import { keyName, MIN_TRANSPOSE, MAX_TRANSPOSE } from './music.js';

const $ = (id) => document.getElementById(id);

export class Stage {
    // root            : elemen #stage
    // partStyle       : 'notes' atau 'chords'
    // tempoPercent    : 50 sampai 100
    // transpose       : nada dasar awal (semitone)
    // transposeLocked : true di mode room (nada dasar diatur host)
    // onFinish(events): dipanggil saat lagu selesai
    constructor({ root, partStyle, tempoPercent, transpose, transposeLocked = false, onFinish }) {
        this.root = root;
        this.slug = root.dataset.instrumentSlug;
        this.songId = Number(root.dataset.songId);
        this.freeBpm = Number(root.dataset.freeBpm);
        this.partStyle = partStyle;
        this.tempoPercent = tempoPercent;
        this.transpose = transpose;
        this.transposeLocked = transposeLocked;
        this.onFinish = onFinish;

        this.audio = new AudioEngine({ baseUrl: baseUrl() });
        this.mode = null;          // 'camera' atau 'keys'
        this.player = null;
        this.songData = null;
        this.baseBpm = 0;          // bpm asli lagu, sebelum tempo latihan

        document.querySelectorAll('[data-mode]').forEach((btn) => {
            btn.addEventListener('click', () => this.setMode(btn.dataset.mode));
        });
        $('btn-fullscreen').addEventListener('click', () => this.toggleFullscreen());
        document.addEventListener('fullscreenchange', () => {
            $('btn-fullscreen').textContent = document.fullscreenElement ? 'Keluar mode panggung' : 'Mode panggung';
        });
        window.addEventListener('pagehide', () => this.stop());
    }

    // Semua gestur (kamera, keyboard, dan visual) masuk lewat satu pintu ini.
    gesture(count, atMs) {
        if (this.player) {
            this.player.handleGesture(count, atMs);
        }
    }

    // Dipanggil dari klik tombol "Siapkan instrumen" (browser mewajibkan klik
    // sebelum suara dan kamera boleh dinyalakan). setStatus(teks) untuk progres.
    async prepare(setStatus) {
        setStatus('Menyalakan suara...');
        await this.audio.unlock();

        setStatus('Mengambil data instrumen...');
        const instrumentData = await getJson('api/instrument.php?slug=' + encodeURIComponent(this.slug));
        this.instrumentData = instrumentData;
        await this.audio.loadSamples(instrumentData.sounds);

        let notes = [];
        if (this.songId > 0) {
            setStatus('Mengambil partitur...');
            this.songData = await getJson('api/song.php?id=' + this.songId);
            const part = this.songData.parts.find((p) => p.instrument_id === instrumentData.instrument.id && p.style === this.partStyle);
            if (!part) {
                throw new Error('Lagu ini tidak punya part ' + (this.partStyle === 'chords' ? 'akor' : 'melodi') + ' untuk instrumen ini.');
            }
            notes = part.notes;
            this.baseBpm = this.songData.song.bpm;
            // Tempo latihan: GamePlayer cukup diberi bpm efektif, sisanya ikut.
            this.songData.song.bpm = this.baseBpm * this.tempoPercent / 100;
        }

        // Visual instrumen juga berfungsi sebagai pad, tetapi hanya di mode keyboard
        // (di mode kamera, tekanan diabaikan supaya tidak bentrok dengan gestur).
        this.view = new InstrumentView({
            container: $('inst-view'),
            instrumentData,
            onPress: (count, atMs) => this.mode === 'keys' && this.gesture(count, atMs),
            onRelease: (atMs) => this.mode === 'keys' && this.gesture(0, atMs),
        });
        this.view.style = this.partStyle;

        this.player = new GamePlayer({
            instrumentData,
            song: this.songData ? this.songData.song : null,
            notes,
            style: this.partStyle,
            freeBpm: this.freeBpm,
            audio: this.audio,
            els: {
                lane: $('lane'),
                track: $('lane-track'),
                hint: $('hint'),
                beat: $('beat'),
                icon: $('inst-icon'),
                now: $('now'),
            },
            view: this.view,
            onFinish: (events) => this.onFinish && this.onFinish(events),
        });

        this.keyboard = new KeyboardInput({ onGestureChange: (count, atMs) => this.gesture(count, atMs) });
        this.tracker = new HandTracker({
            video: $('cam'),
            canvas: $('cam-overlay'),
            onGestureChange: (count, atMs) => this.gesture(count, atMs),
            onStatus: (text) => {
                $('camera-status').textContent = text;
            },
        });

        this.setupSettings();
        this.applyTranspose(this.transpose);

        $('start-gate').hidden = true;
        $('stage-main').hidden = false;
        $('mode-switch').hidden = false;
        if (document.fullscreenEnabled) {
            $('btn-fullscreen').hidden = false;
        }
        this.player.updateHint(true);

        // Layar sentuh: mulai dengan pad. Laptop: mulai dengan kamera.
        const touchFirst = window.matchMedia('(pointer: coarse)').matches;
        await this.setMode(touchFirst ? 'keys' : 'camera');
    }

    // Tata letak satu layar penuh (header situs disembunyikan, lihat app.css).
    goLive() {
        this.root.classList.add('is-live');
        document.body.classList.add('stage-live');
    }

    // ------------------------------------------------------------------
    // Panel pengaturan
    // ------------------------------------------------------------------
    setupSettings() {
        $('volume').addEventListener('input', (event) => this.audio.setVolume(Number(event.target.value) / 100));
        $('reverb').addEventListener('input', (event) => this.audio.setReverb(Number(event.target.value) / 100));

        if ($('transpose-down')) {
            $('transpose-down').addEventListener('click', () => this.applyTranspose(this.transpose - 1));
            $('transpose-up').addEventListener('click', () => this.applyTranspose(this.transpose + 1));
        }

        // Gaya main (hanya di mode bebas; saat bermain lagu, gaya dipilih sebelum masuk panggung).
        document.querySelectorAll('[data-style]').forEach((btn) => {
            btn.addEventListener('click', () => {
                this.player.setStyle(btn.dataset.style);
                this.refreshStyleUi();
            });
        });

        if ($('bass')) {
            $('bass').addEventListener('change', (event) => this.player.setOption('bass', Number(event.target.value)));
            $('rhythm').addEventListener('change', (event) => this.player.setOption('rhythm', event.target.value));
        }
        if ($('auto-hihat')) {
            $('auto-hihat').addEventListener('change', (event) => this.player.setOption('autoHihat', event.target.checked));
        }
        this.refreshStyleUi();
        this.lockSettings(false);
    }

    // Nada dasar: -6 sampai 6 semitone, tampil sebagai "Do = D".
    applyTranspose(value) {
        this.transpose = Math.min(MAX_TRANSPOSE, Math.max(MIN_TRANSPOSE, value));
        this.view.setTranspose(this.transpose);    // gambar ulang keyboard dulu, baru tanda nada berikutnya
        this.player.setTranspose(this.transpose);
        if ($('transpose-label')) {
            $('transpose-label').textContent = 'Do = ' + keyName(this.transpose) + (this.transposeLocked ? ' (diatur host)' : '');
        }
        this.renderCheat();
    }

    // Tempo latihan diubah (mode room: host mengganti tempo di lobby).
    setTempo(percent) {
        this.tempoPercent = percent;
        if (this.player && this.player.song) {
            this.player.setSongBpm(this.baseBpm * percent / 100);
        }
    }

    refreshStyleUi() {
        document.querySelectorAll('[data-style]').forEach((btn) => {
            btn.classList.toggle('is-active', btn.dataset.style === this.player.style);
            btn.setAttribute('aria-pressed', btn.dataset.style === this.player.style ? 'true' : 'false');
        });
        if ($('chord-options')) {
            $('chord-options').hidden = this.player.style !== 'chords';
        }
        this.view.setStyle(this.player.style);
        this.player.updateHint(true);
        this.renderCheat();
    }

    // Contekan mengikuti gaya (nada atau akor) dan nada dasar.
    renderCheat() {
        const gestures = this.instrumentData.gestures.slice().sort((a, b) => a.finger_count - b.finger_count);
        const cheat = $('cheat');
        cheat.replaceChildren();
        for (const gesture of gestures) {
            const sound = this.instrumentData.sounds.find((s) => s.id === gesture.sound_id);
            const item = document.createElement('li');
            const badge = document.createElement('span');
            badge.className = 'finger-count';
            badge.textContent = String(gesture.finger_count);
            item.append(badge, ' ' + (sound ? this.player.soundLabel(sound) : ''));
            cheat.appendChild(item);
        }
    }

    // Selama lagu berjalan (atau di room, karena diatur host), nada dasar tidak boleh diganti.
    lockSettings(locked) {
        ['transpose-down', 'transpose-up'].forEach((id) => {
            if ($(id)) {
                $(id).disabled = locked || this.transposeLocked;
            }
        });
    }

    // ------------------------------------------------------------------
    // Kamera <-> keyboard kapan saja
    // ------------------------------------------------------------------
    async setMode(newMode) {
        if (newMode === this.mode || !this.player) {
            return;
        }
        this.mode = newMode;
        document.querySelectorAll('[data-mode]').forEach((btn) => {
            btn.classList.toggle('is-active', btn.dataset.mode === newMode);
            btn.setAttribute('aria-pressed', btn.dataset.mode === newMode ? 'true' : 'false');
        });
        $('camera-box').hidden = newMode !== 'camera';
        $('keys-box').hidden = newMode !== 'keys';
        this.view.setInteractive(newMode === 'keys');

        if (newMode === 'keys') {
            this.tracker.stop();
            this.keyboard.setEnabled(true);
            return;
        }

        this.keyboard.setEnabled(false);
        try {
            await this.tracker.start();
        } catch (error) {
            // Kamera gagal: beri tahu, lalu otomatis pindah ke keyboard supaya tetap bisa main.
            $('now').textContent = error.message;
            await this.setMode('keys');
        }
    }

    // Mode panggung: layar penuh untuk demo di proyektor (Fullscreen API).
    async toggleFullscreen() {
        try {
            if (document.fullscreenElement) {
                await document.exitFullscreen();
            } else {
                await this.root.requestFullscreen();
            }
        } catch (error) {
            $('now').textContent = 'Layar penuh ditolak browser.';
        }
    }

    // Tinggalkan halaman: matikan kamera dan suara.
    stop() {
        if (this.tracker) this.tracker.stop();
        if (this.player) this.player.destroy();
        this.audio.stopAll();
    }
}

// Kalimat penyemangat dan maskot untuk kartu hasil (dipakai solo dan room).
export function praise(accuracy) {
    if (accuracy >= 90) return 'Rapi sekali, siap manggung!';
    if (accuracy >= 70) return 'Mantap, tinggal sedikit lagi.';
    if (accuracy >= 40) return 'Lumayan. Coba lagi dengan tempo di kepala.';
    return 'Pemanasan dulu. Cek contekan jari di samping.';
}

export function mascotFor(accuracy) {
    if (accuracy >= 80) return 'mascot-cheer.svg';
    if (accuracy >= 40) return 'mascot-wave.svg';
    return 'mascot-oops.svg';
}
