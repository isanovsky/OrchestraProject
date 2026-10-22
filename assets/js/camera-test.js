// Halaman uji kamera (camera-test.php): tampilkan jumlah jari per tangan,
// angka mentah, dan angka setelah debounce secara langsung.

import { HandTracker } from './hand-tracker.js';

const $ = (id) => document.getElementById(id);

const tracker = new HandTracker({
    video: $('cam'),
    canvas: $('cam-overlay'),
    stableMs: 100,
    onStatus: (text) => {
        $('status').textContent = text;
    },
    onGestureChange: (count) => {
        const el = $('stable-total');
        el.textContent = count;
        el.classList.remove('is-pulse');
        void el.offsetWidth;
        el.classList.add('is-pulse');
    },
    onFrame: ({ hands, rawTotal }) => {
        $('raw-total').textContent = rawTotal;
        const list = $('hand-list');
        list.replaceChildren();
        if (hands.length === 0) {
            const item = document.createElement('li');
            item.className = 'muted';
            item.textContent = 'Belum ada tangan terlihat.';
            list.appendChild(item);
            return;
        }
        for (const hand of hands) {
            const item = document.createElement('li');
            item.textContent = `Tangan di ${hand.side} layar: ${hand.count} jari`;
            list.appendChild(item);
        }
    },
});

$('btn-camera').addEventListener('click', async () => {
    const button = $('btn-camera');
    button.disabled = true;
    try {
        await tracker.start();
        $('camera-gate').hidden = true;
    } catch (error) {
        $('status').textContent = error.message;
        button.disabled = false;
    }
});

// Ubah lama debounce secara langsung supaya efeknya bisa dibandingkan.
$('stable-ms').addEventListener('input', (event) => {
    const value = Number(event.target.value);
    tracker.debouncer.stableMs = value;
    // 0 ms berarti tanpa debounce: cukup satu frame.
    tracker.debouncer.minFrames = value === 0 ? 1 : 2;
    $('stable-ms-value').textContent = value;
});
