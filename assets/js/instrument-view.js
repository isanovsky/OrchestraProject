// Visual instrumen di bawah layar kamera, sekaligus pad untuk mode keyboard/sentuh.
//
//   Piano  : keyboard mini C3 sampai G5 (bergeser mengikuti transpose).
//   Strings: deretan nada yang dimiliki strings di database.
//   Drum   : ilustrasi set drum (SVG dari includes/drum_kit.php).
//
// Tuts/bagian yang sedang berbunyi menyala dengan warna instrumen lalu memudar.
// Saat bermain lagu, nada atau akor berikutnya diberi tanda tipis.
// Di mode melodi, tuts yang punya bunyi bisa ditekan; di mode akor, muncul
// deretan tombol akor (C, Dm, Em, F, G, Am, Bdim).
//
// Komponen ini tidak membunyikan apa pun sendiri: tekanan diteruskan sebagai
// "jumlah jari" lewat onPress/onRelease, sama seperti kamera dan keyboard.

import { codeToMidi, codeToDegree, chordName, instrumentDoOctave } from './music.js';

const PIANO_LOW = 48;    // C3
const PIANO_HIGH = 79;   // G5
const BLACK_KEYS = [1, 3, 6, 8, 10];    // posisi tuts hitam dalam satu oktaf
const FLASH_MS = 350;

const isBlack = (midi) => BLACK_KEYS.includes(((midi % 12) + 12) % 12);

export class InstrumentView {
    // container   : elemen tempat visual digambar
    // instrumentData: hasil api/instrument.php
    // onPress(fingerCount, atMs), onRelease(atMs): diteruskan sebagai gestur
    constructor({ container, instrumentData, onPress, onRelease }) {
        this.container = container;
        this.data = instrumentData;
        this.type = instrumentData.instrument.type;
        this.onPress = onPress;
        this.onRelease = onRelease;
        this.transpose = 0;
        this.style = 'notes';
        this.interactive = false;
        this.held = new Set();          // elemen yang menyala karena nada ditahan
        this.timers = new Map();        // elemen -> timer padam
        this.doOctave = instrumentDoOctave(instrumentData.sounds, instrumentData.gestures);
        this.container.style.setProperty('--inst-color', instrumentData.instrument.color);

        // Bunyi per jumlah jari, untuk label dan tombol.
        const soundById = new Map(instrumentData.sounds.map((s) => [s.id, s]));
        this.gestures = instrumentData.gestures
            .map((g) => ({ count: g.finger_count, sound: soundById.get(g.sound_id) }))
            .filter((g) => g.sound)
            .sort((a, b) => a.count - b.count);
    }

    setTranspose(semitones) {
        this.transpose = semitones;
        this.render();
    }

    setStyle(style) {
        this.style = style;
        this.render();
    }

    // Di mode kamera, visual hanya menampilkan; di mode keyboard, bisa ditekan.
    setInteractive(interactive) {
        this.interactive = interactive;
        this.container.classList.toggle('is-interactive', interactive);
    }

    // ------------------------------------------------------------------
    // Menggambar
    // ------------------------------------------------------------------
    render() {
        this.held.clear();
        this.keys = new Map();          // MIDI -> elemen tuts/sel
        if (this.type === 'drum') {
            this.bindDrum();
            return;
        }
        this.container.replaceChildren();
        if (this.style === 'chords') {
            this.container.appendChild(this.chordButtons());
        }
        this.container.appendChild(this.type === 'piano' ? this.pianoKeyboard() : this.noteRow());
    }

    // Keyboard C3-G5, digeser sebesar transpose lalu dibulatkan ke tuts putih.
    pianoKeyboard() {
        let low = PIANO_LOW + this.transpose;
        let high = PIANO_HIGH + this.transpose;
        while (isBlack(low)) low--;
        while (isBlack(high)) high++;

        const playable = this.style === 'notes' ? this.playableMap() : new Map();
        const keyboard = document.createElement('div');
        keyboard.className = 'piano';
        const whites = [];
        for (let midi = low; midi <= high; midi++) {
            if (!isBlack(midi)) {
                whites.push(midi);
            }
        }
        const whiteWidth = 100 / whites.length;

        for (let midi = low; midi <= high; midi++) {
            const key = document.createElement('span');
            const black = isBlack(midi);
            key.className = black ? 'piano-key is-black' : 'piano-key';
            if (black) {
                // Tuts hitam berada di batas dua tuts putih.
                const whitesBefore = whites.filter((w) => w < midi).length;
                key.style.left = `calc(${whitesBefore * whiteWidth}% - ${whiteWidth * 0.3}%)`;
                key.style.width = `${whiteWidth * 0.6}%`;
            }
            if (midi % 12 === 0) {
                key.dataset.label = 'C' + (Math.floor(midi / 12) - 1);
            }
            // Mode akor: tuts hanya menampilkan nada akor, tidak diredupkan.
            if (this.style === 'notes') {
                this.attachPress(key, playable.get(midi));
            }
            keyboard.appendChild(key);
            this.keys.set(midi, key);
        }
        return keyboard;
    }

    // Strings: satu sel per bunyi, urut dari nada terendah.
    noteRow() {
        const row = document.createElement('div');
        row.className = 'note-row';
        const sounds = this.data.sounds
            .map((sound) => ({ sound, midi: codeToMidi(sound.code) }))
            .filter((item) => item.midi !== null)
            .sort((a, b) => a.midi - b.midi);
        const countBySound = new Map(this.gestures.map((g) => [g.sound.id, g.count]));

        for (const { sound, midi } of sounds) {
            const cell = document.createElement('span');
            cell.className = 'note-cell';
            const count = countBySound.get(sound.id);
            const name = document.createElement('strong');
            name.textContent = sound.name;
            const finger = document.createElement('small');
            finger.textContent = count === undefined ? '' : count + ' jari';
            cell.append(name, finger);
            if (this.style === 'notes') {
                this.attachPress(cell, count);
            }
            row.appendChild(cell);
            this.keys.set(midi + this.transpose, cell);
        }
        return row;
    }

    // Deretan tombol akor untuk 1 sampai 7 jari.
    chordButtons() {
        const row = document.createElement('div');
        row.className = 'chord-buttons';
        for (const { count, sound } of this.gestures.filter((g) => g.count <= 7)) {
            const degree = this.doOctave === null ? null : codeToDegree(sound.code, this.doOctave);
            if (!degree) {
                continue;
            }
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'chord-button';
            button.textContent = chordName(degree.degree, this.transpose);
            button.title = count + ' jari';
            this.attachPress(button, count);
            row.appendChild(button);
        }
        return row;
    }

    // Drum: SVG sudah ada di halaman; cukup sambungkan bagian-bagiannya.
    bindDrum() {
        if (this.drumBound) {
            return;
        }
        this.drumBound = true;
        const countByCode = new Map(this.gestures.map((g) => [g.sound.code, g.count]));
        this.container.querySelectorAll('[data-code]').forEach((part) => {
            this.attachPress(part, countByCode.get(part.dataset.code));
        });
    }

    // Peta MIDI (setelah transpose) -> jumlah jari, untuk tuts yang punya bunyi.
    playableMap() {
        const map = new Map();
        for (const { count, sound } of this.gestures) {
            const midi = codeToMidi(sound.code);
            if (midi !== null && !map.has(midi + this.transpose)) {
                map.set(midi + this.transpose, count);
            }
        }
        return map;
    }

    // Tekan = jumlah jari tersebut, lepas = 0. Pointer events: mouse dan sentuhan.
    attachPress(el, count) {
        if (count === undefined) {
            el.classList.add('is-dim');
            return;
        }
        el.classList.add('is-playable');
        el.dataset.finger = String(count);
        el.addEventListener('pointerdown', (event) => {
            if (!this.interactive) {
                return;
            }
            event.preventDefault();
            // Tangkap pointer supaya "lepas" tetap terdeteksi walau jari bergeser keluar tuts.
            try {
                el.setPointerCapture(event.pointerId);
            } catch (error) {
                // Pointer sudah tidak aktif; tekanan tetap diproses.
            }
            this.pressing = event.pointerId;
            this.onPress(count, event.timeStamp);
        });
        const up = (event) => {
            if (this.interactive && this.pressing === event.pointerId) {
                this.pressing = null;
                this.onRelease(event.timeStamp);
            }
        };
        el.addEventListener('pointerup', up);
        el.addEventListener('pointercancel', up);
        el.addEventListener('contextmenu', (event) => event.preventDefault());
    }

    // ------------------------------------------------------------------
    // Menyala
    // ------------------------------------------------------------------
    // midis: nada yang berbunyi (sudah ditranspose). hold: menyala sampai release().
    light(midis, hold) {
        for (const midi of midis) {
            const el = this.keys && this.keys.get(midi);
            if (el) {
                this.turnOn(el, hold ? null : FLASH_MS);
            }
        }
    }

    // Drum: nyalakan bagian set drum berdasarkan kode bunyi.
    hitDrum(code) {
        const el = this.container.querySelector(`[data-code="${code}"]`);
        if (el) {
            this.turnOn(el, code === 'CYMBAL' || code === 'CRASH' ? 600 : 200);
        }
    }

    turnOn(el, durationMs) {
        clearTimeout(this.timers.get(el));
        el.classList.remove('is-on');
        void el.getBoundingClientRect();   // ulang animasi bila tuts yang sama
        el.classList.add('is-on');
        if (durationMs === null) {
            this.held.add(el);
        } else {
            this.timers.set(el, setTimeout(() => el.classList.remove('is-on'), durationMs));
        }
    }

    // Lepas nada yang ditahan (strings).
    release() {
        this.held.forEach((el) => el.classList.remove('is-on'));
        this.held.clear();
    }

    // Tanda tipis untuk nada/akor berikutnya. midis: array MIDI, atau kode drum.
    markNext(target) {
        this.container.querySelectorAll('.is-next').forEach((el) => el.classList.remove('is-next'));
        if (target === null) {
            return;
        }
        if (typeof target === 'string') {
            const el = this.container.querySelector(`[data-code="${target}"]`);
            el && el.classList.add('is-next');
            return;
        }
        for (const midi of target) {
            const el = this.keys && this.keys.get(midi);
            el && el.classList.add('is-next');
        }
    }
}
