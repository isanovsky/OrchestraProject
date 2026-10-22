// Cadangan tanpa kamera: keyboard (tombol 1 sampai 8) dan pad sentuh di layar.
//
// Prinsip diadaptasi dari src/input/keyboardSource.ts di "Gesture Synth Weld"
// karya rainbow686 (MIT): masukan keyboard diterjemahkan menjadi "jumlah jari"
// yang sama persis dengan hasil kamera, lalu dikirim lewat callback yang sama.
// Jadi modul permainan tidak perlu tahu sumbernya kamera atau keyboard.
// Lihat THIRD_PARTY_NOTICES.md.
//
// Perilaku: tekan = jumlah jari tersebut (note-on), lepas = 0 (note-off).

const MAX_KEY = 8;

export class KeyboardInput {
    // onGestureChange(fingerCount, atMs): callback yang sama dengan HandTracker.
    constructor({ onGestureChange }) {
        this.onGestureChange = onGestureChange;
        this.enabled = false;
        this.heldKey = null;    // tombol keyboard yang sedang ditahan ('1'..'8')
        this.heldPad = null;    // pointerId yang sedang menekan pad
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
        if (this.heldKey !== null || this.heldPad !== null) {
            this.heldKey = null;
            this.heldPad = null;
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

    // Buat tombol pad di dalam container.
    // buttons: [{ count: 3, label: 'Mi' }, ...]
    // Pointer events dipakai supaya satu kode berlaku untuk mouse dan sentuhan.
    renderPad(container, buttons, color) {
        container.innerHTML = '';
        container.style.setProperty('--pad-color', color);
        for (const { count, label } of buttons) {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'pad-button';
            for (const [className, text] of [['pad-count', String(count)], ['pad-label', label]]) {
                const span = document.createElement('span');
                span.className = className;
                span.textContent = text;
                button.appendChild(span);
            }

            button.addEventListener('pointerdown', (event) => {
                event.preventDefault();
                button.setPointerCapture(event.pointerId);
                this.heldPad = event.pointerId;
                button.classList.add('is-down');
                this.emit(count, event.timeStamp);
            });
            const up = (event) => {
                button.classList.remove('is-down');
                if (this.heldPad === event.pointerId) {
                    this.heldPad = null;
                    this.emit(0, event.timeStamp);
                }
            };
            button.addEventListener('pointerup', up);
            button.addEventListener('pointercancel', up);
            // Mencegah menu konteks saat pad ditekan lama di ponsel.
            button.addEventListener('contextmenu', (event) => event.preventDefault());
            container.appendChild(button);
        }
    }
}
