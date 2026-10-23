// Cadangan tanpa kamera: keyboard (tombol 1 sampai 9) dan pad sentuh di layar.
// Tombol 9 ditambahkan untuk Sol rendah (gestur 9 jari).
//
// Prinsip diadaptasi dari src/input/keyboardSource.ts di "Gesture Synth Weld"
// karya rainbow686 (MIT): masukan keyboard diterjemahkan menjadi "jumlah jari"
// yang sama persis dengan hasil kamera, lalu dikirim lewat callback yang sama.
// Jadi modul permainan tidak perlu tahu sumbernya kamera atau keyboard.
// Lihat THIRD_PARTY_NOTICES.md.
//
// Perilaku: tekan = jumlah jari tersebut (note-on), lepas = 0 (note-off).
// Pad sentuh di layar ada di instrument-view.js (tuts piano, nada strings,
// atau bagian drum), dengan perilaku yang sama.

const MAX_KEY = 9;

export class KeyboardInput {
    // onGestureChange(fingerCount, atMs): callback yang sama dengan HandTracker.
    constructor({ onGestureChange }) {
        this.onGestureChange = onGestureChange;
        this.enabled = false;
        this.heldKey = null;    // tombol keyboard yang sedang ditahan ('1'..'8')
        this.onKeyDown = this.onKeyDown.bind(this);
        this.onKeyUp = this.onKeyUp.bind(this);
        window.addEventListener('keydown', this.onKeyDown);
        window.addEventListener('keyup', this.onKeyUp);
        // Jendela kehilangan fokus saat tombol ditahan: anggap dilepas.
        window.addEventListener('blur', () => this.release());
    }

    // Saat dinonaktifkan (pemain beralih ke kamera), nada yang ditahan dilepas.
    setEnabled(enabled) {
        if (!enabled) {
            this.release();
        }
        this.enabled = enabled;
    }

    release() {
        if (this.heldKey !== null) {
            this.heldKey = null;
            this.emit(0, performance.now());
        }
    }

    emit(count, atMs) {
        if (this.enabled) {
            this.onGestureChange(count, atMs);
        }
    }

    onKeyDown(event) {
        if (!this.enabled || event.repeat || event.ctrlKey || event.metaKey || event.altKey) {
            return;
        }
        // Jangan ganggu pemain yang sedang mengetik di kolom isian (misalnya nickname).
        if (event.target.closest && event.target.closest('input, textarea, select')) {
            return;
        }
        const count = Number(event.key);
        if (Number.isInteger(count) && count >= 1 && count <= MAX_KEY) {
            event.preventDefault();
            this.heldKey = event.key;
            // event.timeStamp memakai jam yang sama dengan performance.now().
            this.emit(count, event.timeStamp);
        }
    }

    onKeyUp(event) {
        // Hanya tombol yang terakhir ditekan yang menghentikan nada.
        if (event.key === this.heldKey) {
            this.heldKey = null;
            this.emit(0, event.timeStamp);
        }
    }
}
