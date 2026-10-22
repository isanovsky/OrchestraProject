// Logika permainan yang dipakai bersama oleh mode solo (play.php) dan
// main bersama (room.php).
//
// Alur satu gestur:
//   HandTracker / KeyboardInput -> handleGesture(jumlahJari, waktu)
//   -> cari bunyi lewat pemetaan gestur -> AudioEngine.noteOn/noteOff
//   -> bila lagu sedang berjalan, catat event { t_ms, sound_id }
// Di akhir lagu, daftar event dikirim ke server untuk dinilai. Penandaan
// "kena" di layar hanya hiasan; nilai resmi tetap dihitung server.

// Sama dengan SCORE_TOLERANCE_MS di includes/scoring.php.
export const TOLERANCE_MS = 250;
// Event masih dicatat sampai 2 detik setelah lagu selesai (sama dengan server).
const LATE_GRACE_MS = 2000;
const PX_PER_BEAT = 90;

// Susun peta dari data api/instrument.php:
//   byCount     : jumlah jari -> bunyi
//   countBySound: id bunyi -> jumlah jari (untuk petunjuk "angkat 3 jari")
export function buildGestureMap(instrumentData) {
    const soundsById = new Map(instrumentData.sounds.map((sound) => [sound.id, sound]));
    const byCount = new Map();
    const countBySound = new Map();
    for (const gesture of instrumentData.gestures) {
        const sound = soundsById.get(gesture.sound_id);
        if (sound) {
            byCount.set(gesture.finger_count, sound);
            if (!countBySound.has(sound.id)) {
                countBySound.set(sound.id, gesture.finger_count);
            }
        }
    }
    return { soundsById, byCount, countBySound };
}

export class GamePlayer {
    // instrumentData : hasil api/instrument.php
    // song           : objek song dari api/song.php, atau null untuk main bebas
    // notes          : partitur instrumen ini (song.parts[instrument_id]), [] bila bebas
    // audio          : AudioEngine yang sudah di-unlock
    // els            : { lane, track, hint, beat, icon, now } elemen tampilan (boleh null)
    // onFinish(events): dipanggil sekali saat lagu selesai
    constructor({ instrumentData, song, notes, audio, els, onFinish }) {
        this.instrument = instrumentData.instrument;
        this.map = buildGestureMap(instrumentData);
        this.song = song;
        this.notes = (notes || []).map((note) => ({ ...note, hit: false, missed: false, el: null }));
        this.audio = audio;
        this.els = els;
        this.onFinish = onFinish || (() => {});

        this.state = 'idle';     // idle -> countdown -> playing -> done
        this.events = [];
        this.songStart = 0;      // performance.now() saat ketukan 0
        this.lastBeatShown = null;
        this.frame = this.frame.bind(this);

        if (song) {
            this.beatMs = 60000 / song.bpm;
            this.lengthMs = song.length_beats * this.beatMs;
        }
    }

    // Dipanggil setiap jumlah jari (stabil) berubah, dari kamera maupun keyboard.
    handleGesture(count, atMs) {
        if (count === 0) {
            this.audio.noteOff();
            this.showNow('Diam');
            return;
        }
        const sound = this.map.byCount.get(count);
        if (!sound) {
            this.audio.noteOff();
            this.showNow(count + ' jari: belum ada bunyinya');
            return;
        }

        this.audio.noteOn(sound, this.instrument.play_mode);
        this.showNow(count + ' jari: ' + sound.name);
        this.bounceIcon();

        if (this.state === 'playing') {
            const tMs = Math.round(atMs - this.songStart);
            if (tMs >= 0 && tMs <= this.lengthMs + LATE_GRACE_MS) {
                this.events.push({ t_ms: tMs, sound_id: sound.id });
                this.markHit(sound.id, tMs);
            }
        }
    }

    // Mulai lagu tepat pada songStartMs (waktu performance.now()). Sebelum itu
    // tampil hitung mundur. Di mode room, waktu ini berasal dari jam server.
    startAt(songStartMs) {
        if (!this.song) {
            return;
        }
        this.songStart = songStartMs;
        this.events = [];
        this.notes.forEach((note) => {
            note.t_ms = note.start_beat * this.beatMs;
            note.hit = false;
            note.missed = false;
        });
        this.buildLane();
        this.state = 'countdown';
        requestAnimationFrame(this.frame);
    }

    stop() {
        this.state = 'idle';
        this.audio.noteOff();
    }

    // ------------------------------------------------------------------
    // Loop tampilan, sekitar 60 kali per detik
    // ------------------------------------------------------------------
    frame() {
        if (this.state !== 'countdown' && this.state !== 'playing') {
            return;
        }
        const elapsed = performance.now() - this.songStart;

        if (elapsed < 0) {
            // Hitung mundur dalam ketukan bila tinggal satu birama, selain itu dalam detik.
            const beatsLeft = Math.ceil(-elapsed / this.beatMs);
            const text = beatsLeft <= this.song.beats_per_bar ? String(beatsLeft) : Math.ceil(-elapsed / 1000) + ' dtk';
            this.showBeat(text, 'countdown-' + beatsLeft);
        } else {
            this.state = 'playing';
            const beat = Math.floor(elapsed / this.beatMs);
            const bar = Math.floor(beat / this.song.beats_per_bar) + 1;
            const beatInBar = (beat % this.song.beats_per_bar) + 1;
            this.showBeat(beatInBar === 1 ? 'Birama ' + bar : String(beatInBar), 'beat-' + beat);
        }

        // Geser lajur: ketukan saat ini selalu berada di garis main.
        if (this.els.track) {
            const currentBeat = elapsed / this.beatMs;
            this.els.track.style.transform = `translateX(${this.hitX - currentBeat * PX_PER_BEAT}px)`;
        }

        // Nada yang sudah lewat jendela toleransi tanpa dimainkan = meleset.
        for (const note of this.notes) {
            if (!note.hit && !note.missed && elapsed > note.t_ms + TOLERANCE_MS) {
                note.missed = true;
                note.el && note.el.classList.add('is-missed');
            }
        }
        this.updateHint();

        // Lagu selesai satu ketukan setelah nada terakhir.
        if (elapsed >= this.lengthMs + this.beatMs) {
            this.state = 'done';
            this.audio.noteOff();
            this.showBeat('Selesai!', 'done');
            if (this.els.hint) {
                this.els.hint.textContent = 'Lagu selesai. Nilaimu sedang dihitung server...';
            }
            this.onFinish(this.events.slice());
            return;
        }
        requestAnimationFrame(this.frame);
    }

    buildLane() {
        const { lane, track } = this.els;
        if (!lane || !track) {
            return;
        }
        track.replaceChildren();
        lane.style.setProperty('--lane-color', this.instrument.color);
        this.hitX = lane.clientWidth * 0.2;

        // Garis ketukan; garis birama lebih tebal.
        for (let b = 0; b <= Math.ceil(this.song.length_beats); b++) {
            const line = document.createElement('span');
            line.className = b % this.song.beats_per_bar === 0 ? 'lane-grid is-bar' : 'lane-grid';
            line.style.left = b * PX_PER_BEAT + 'px';
            track.appendChild(line);
        }

        for (const note of this.notes) {
            const sound = this.map.soundsById.get(note.sound_id);
            const count = this.map.countBySound.get(note.sound_id);
            const el = document.createElement('span');
            el.className = 'lane-block';
            el.style.left = note.start_beat * PX_PER_BEAT + 'px';
            el.style.width = Math.max(note.duration_beats * PX_PER_BEAT - 6, 28) + 'px';

            const fingers = document.createElement('strong');
            fingers.textContent = count === undefined ? '?' : String(count);
            const name = document.createElement('small');
            name.textContent = sound ? sound.name : '';
            el.append(fingers, name);

            track.appendChild(el);
            note.el = el;
        }
    }

    // Tandai nada terdekat yang cocok sebagai kena (hanya tampilan).
    markHit(soundId, tMs) {
        let best = null;
        for (const note of this.notes) {
            const diff = Math.abs(note.t_ms - tMs);
            if (!note.hit && note.sound_id === soundId && diff <= TOLERANCE_MS && (best === null || diff < Math.abs(best.t_ms - tMs))) {
                best = note;
            }
        }
        if (best) {
            best.hit = true;
            best.missed = false;
            best.el && best.el.classList.add('is-hit');
            best.el && best.el.classList.remove('is-missed');
        }
    }

    // Petunjuk nada berikutnya, misalnya "Berikutnya: angkat 3 jari, bunyilah Mi".
    updateHint() {
        if (!this.els.hint) {
            return;
        }
        const next = this.notes.find((note) => !note.hit && !note.missed);
        let text = 'Tinggal menunggu lagu selesai...';
        if (next) {
            const sound = this.map.soundsById.get(next.sound_id);
            const count = this.map.countBySound.get(next.sound_id);
            const name = sound ? sound.name : 'bunyi #' + next.sound_id;
            text = count === undefined
                ? `Berikutnya: ${name} (belum punya gestur)`
                : `Berikutnya: angkat ${count} jari, bunyilah ${name}`;
        }
        if (this.els.hint.textContent !== text) {
            this.els.hint.textContent = text;
        }
    }

    // Metronom visual: elemen berdenyut setiap kali ketukan berganti.
    showBeat(text, key) {
        const el = this.els.beat;
        if (!el || key === this.lastBeatShown) {
            return;
        }
        this.lastBeatShown = key;
        el.textContent = text;
        el.classList.remove('is-pulse');
        void el.offsetWidth;   // paksa browser mengulang animasi
        el.classList.add('is-pulse');
    }

    showNow(text) {
        if (this.els.now) {
            this.els.now.textContent = text;
        }
    }

    // Ikon instrumen melompat kecil setiap nada dibunyikan.
    bounceIcon() {
        const icon = this.els.icon;
        if (!icon) {
            return;
        }
        icon.classList.remove('is-bouncing');
        void icon.offsetWidth;
        icon.classList.add('is-bouncing');
    }
}
