// Deteksi tangan lewat kamera, hitung jari, dan debounce.
//
// Sumber: sebagian diadaptasi dari "Gesture Synth Weld" karya rainbow686
// (https://github.com/rainbow686/gesture-synth-weld), lisensi MIT.
// Yang diadaptasi: cara memuat HandLandmarker (GPU lalu cadangan CPU,
// numHands 2, mode VIDEO, ambang keyakinan 0.5) dari src/handTracker.ts,
// daftar sambungan kerangka tangan HAND_CONNECTIONS, dan pola loop deteksi
// per frame video. Lihat THIRD_PARTY_NOTICES.md.
//
// Modul lain cukup memakai callback onGestureChange(jumlahJari, waktu),
// tanpa perlu tahu apa pun tentang MediaPipe.

// Versi di-pin sama dengan mediapipe-version.json di repo referensi.
// File .wasm MediaPipe lebih dari 10 MB (batas InfinityFree), jadi tidak
// disimpan di repo ini, melainkan dimuat dari CDN.
const MEDIAPIPE_VERSION = '1.0.1';
const VISION_BUNDLE_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/vision_bundle.mjs`;
const WASM_BASE_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/wasm`;
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

// Nomor titik (landmark) MediaPipe untuk satu tangan:
// 0 pergelangan; ibu jari 1-4; telunjuk 5-8; tengah 9-12; manis 13-16; kelingking 17-20.
// Untuk setiap jari: [ujung, sendi tengah (PIP), pangkal (MCP)].
const FINGERS = [
    [8, 6, 5],    // telunjuk
    [12, 10, 9],  // tengah
    [16, 14, 13], // manis
    [20, 18, 17], // kelingking
];

// Garis kerangka tangan (pasangan titik). Dari gesture-synth-weld, src/handTracker.ts.
export const HAND_CONNECTIONS = [
    [0, 1], [1, 2], [2, 3], [3, 4],
    [0, 5], [5, 6], [6, 7], [7, 8],
    [0, 9], [9, 10], [10, 11], [11, 12],
    [0, 13], [13, 14], [14, 15], [15, 16],
    [0, 17], [17, 18], [18, 19], [19, 20],
    [5, 9], [9, 13], [13, 17],
];

function distance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
}

// Hitung jari terangkat pada SATU tangan (0 sampai 5).
//
// Perbandingan dua pendekatan dari repo referensi:
// - gesture-synth-weld: jari terangkat bila ujung jari lebih TINGGI (nilai y
//   lebih kecil) dari sendinya; ibu jari dilihat dari arah kiri/kanan
//   berdasarkan label tangan dari MediaPipe. Cepat, tetapi salah bila tangan
//   dimiringkan, dan label kiri/kanan MediaPipe kadang tertukar sehingga
//   hitungan ibu jari ikut berubah-ubah.
// - piano (Rangga-Ari): jari terangkat bila ujungnya cukup JAUH dari
//   pergelangan dibanding sendinya; ibu jari terangkat bila ujungnya jauh
//   dari pangkal telunjuk. Hanya memakai jarak, jadi tetap benar walaupun
//   tangan miring dan tidak bergantung pada label kiri/kanan.
// Dipilih pendekatan jarak (piano) karena lebih stabil untuk pemain yang
// tangannya tidak tegak lurus. Getaran sisa diredam oleh GestureDebouncer.
export function countFingers(points) {
    const wrist = points[0];
    let count = 0;

    for (const [tip, pip, mcp] of FINGERS) {
        const tipToWrist = distance(points[tip], wrist);
        const pipToWrist = distance(points[pip], wrist);
        const segment = distance(points[mcp], points[pip]);
        // Ujung harus lebih jauh dari sendi, dengan selisih minimal 30% panjang ruas.
        if (tipToWrist > pipToWrist + segment * 0.3) {
            count++;
        }
    }

    // Ibu jari: ujungnya harus jauh dari pangkal telunjuk (1,35 kali jarak sendinya).
    const indexBase = points[5];
    if (distance(points[4], indexBase) > distance(points[3], indexBase) * 1.35) {
        count++;
    }

    return count;
}

// Debounce: jumlah jari baru dianggap berubah setelah nilai itu terlihat terus-
// menerus selama minimal stableMs DAN minimal minFrames frame berturut-turut.
// Tanpa ini, satu frame yang salah baca langsung membunyikan nada acak.
export class GestureDebouncer {
    constructor(stableMs = 100, minFrames = 2) {
        this.stableMs = stableMs;
        this.minFrames = minFrames;
        this.reset();
    }

    reset() {
        this.current = 0;          // nilai stabil yang sedang berlaku
        this.candidate = 0;        // nilai baru yang sedang "diuji"
        this.candidateSince = 0;   // kapan kandidat pertama kali terlihat
        this.candidateFrames = 0;  // sudah berapa frame kandidat terlihat
    }

    // Masukkan nilai mentah satu frame beserta waktunya (ms).
    // Mengembalikan { value, at } saat nilai stabil berubah; selain itu null.
    // "at" = waktu kandidat PERTAMA terlihat, sehingga jeda debounce tidak
    // membuat pemain dinilai terlambat.
    push(raw, nowMs) {
        if (raw === this.current) {
            // Kembali ke nilai lama: kedipan sesaat dibatalkan.
            this.candidate = raw;
            this.candidateFrames = 0;
            return null;
        }
        if (raw !== this.candidate || this.candidateFrames === 0) {
            // Nilai baru mulai diuji dari frame ini.
            this.candidate = raw;
            this.candidateSince = nowMs;
            this.candidateFrames = 0;
        }
        this.candidateFrames++;
        if (nowMs - this.candidateSince >= this.stableMs && this.candidateFrames >= this.minFrames) {
            this.current = raw;
            this.candidateFrames = 0;
            return { value: raw, at: this.candidateSince };
        }
        return null;
    }
}

// Model hanya dimuat sekali per halaman, walaupun start() dipanggil berkali-kali.
let landmarkerPromise = null;

function loadLandmarker() {
    if (landmarkerPromise === null) {
        landmarkerPromise = (async () => {
            const { FilesetResolver, HandLandmarker } = await import(VISION_BUNDLE_URL);
            const vision = await FilesetResolver.forVisionTasks(WASM_BASE_URL);
            const options = (delegate) => ({
                baseOptions: { modelAssetPath: MODEL_URL, delegate },
                runningMode: 'VIDEO',
                numHands: 2,
                minHandDetectionConfidence: 0.5,
                minHandPresenceConfidence: 0.5,
                minTrackingConfidence: 0.5,
            });
            // GPU lebih ringan untuk prosesor; bila tidak tersedia, pakai CPU.
            try {
                return await HandLandmarker.createFromOptions(vision, options('GPU'));
            } catch (gpuError) {
                return await HandLandmarker.createFromOptions(vision, options('CPU'));
            }
        })();
        // Bila gagal (misalnya internet putus), izinkan mencoba lagi.
        landmarkerPromise.catch(() => {
            landmarkerPromise = null;
        });
    }
    return landmarkerPromise;
}

// Ubah error kamera dari browser menjadi pesan yang bisa dipahami pemain.
function cameraErrorMessage(error) {
    if (!window.isSecureContext) {
        return 'Kamera hanya bisa dipakai lewat https:// atau http://localhost.';
    }
    switch (error && error.name) {
        case 'NotAllowedError':
            return 'Izin kamera ditolak. Klik ikon kamera di bilah alamat, izinkan, lalu coba lagi.';
        case 'NotFoundError':
            return 'Kamera tidak ditemukan. Pakai mode keyboard saja.';
        case 'NotReadableError':
            return 'Kamera sedang dipakai aplikasi lain. Tutup aplikasi itu, lalu coba lagi.';
        default:
            return 'Kamera tidak bisa dinyalakan. Pakai mode keyboard saja.';
    }
}

export class HandTracker {
    // video, canvas : elemen <video> dan <canvas> (keduanya dicerminkan lewat CSS)
    // stableMs      : lama debounce dalam ms
    // onGestureChange(fingerCount, atMs) : dipanggil saat jumlah jari stabil berubah
    // onFrame({ hands, rawTotal, stableTotal }) : opsional, untuk tampilan uji kamera
    // onStatus(teks) : opsional, untuk menampilkan tahap memuat
    constructor({ video, canvas, stableMs = 100, onGestureChange, onFrame, onStatus }) {
        this.video = video;
        this.canvas = canvas;
        this.ctx = canvas ? canvas.getContext('2d') : null;
        this.debouncer = new GestureDebouncer(stableMs);
        this.onGestureChange = onGestureChange || (() => {});
        this.onFrame = onFrame || (() => {});
        this.onStatus = onStatus || (() => {});
        this.landmarker = null;
        this.stream = null;
        this.running = false;
        this.lastVideoTime = -1;
        this.loop = this.loop.bind(this);
    }

    // Nyalakan kamera dan muat model. Melempar Error berisi pesan Bahasa Indonesia.
    async start() {
        if (this.running) {
            return;
        }
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error(cameraErrorMessage(null));
        }

        this.onStatus('Meminta izin kamera...');
        try {
            this.stream = await navigator.mediaDevices.getUserMedia({
                video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
                audio: false,
            });
        } catch (error) {
            throw new Error(cameraErrorMessage(error));
        }
        this.video.srcObject = this.stream;
        await this.video.play();

        this.onStatus('Memuat model pendeteksi tangan (sekitar 20 MB, hanya sekali)...');
        try {
            this.landmarker = await loadLandmarker();
        } catch (error) {
            this.stop();
            throw new Error('Model pendeteksi tangan gagal dimuat. Periksa koneksi internet, lalu coba lagi.');
        }

        this.debouncer.reset();
        this.running = true;
        this.lastVideoTime = -1;
        this.onStatus('Kamera siap. Angkat tanganmu!');
        requestAnimationFrame(this.loop);
    }

    stop() {
        this.running = false;
        if (this.stream) {
            this.stream.getTracks().forEach((track) => track.stop());
            this.stream = null;
        }
        if (this.video) {
            this.video.srcObject = null;
        }
        if (this.ctx) {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        }
        // Tangan dianggap turun supaya nada yang ditahan berhenti.
        if (this.debouncer.current !== 0) {
            this.debouncer.reset();
            this.onGestureChange(0, performance.now());
        }
    }

    loop() {
        if (!this.running) {
            return;
        }
        const video = this.video;

        // Deteksi hanya bila video punya frame baru.
        if (video.readyState >= 2 && video.currentTime !== this.lastVideoTime) {
            this.lastVideoTime = video.currentTime;
            const now = performance.now();
            const result = this.landmarker.detectForVideo(video, now);
            const landmarks = result.landmarks || [];

            const hands = landmarks.map((points) => ({
                // Tampilan dicerminkan, jadi posisi di layar = 1 - x.
                screenX: 1 - points[0].x,
                count: countFingers(points),
                points,
            }));
            hands.sort((a, b) => a.screenX - b.screenX);

            const rawTotal = hands.reduce((sum, hand) => sum + hand.count, 0);
            const change = this.debouncer.push(rawTotal, now);
            if (change !== null) {
                this.onGestureChange(change.value, change.at);
            }

            this.draw(hands);
            this.onFrame({
                hands: hands.map((hand) => ({ side: hand.screenX < 0.5 ? 'kiri' : 'kanan', count: hand.count })),
                rawTotal,
                stableTotal: this.debouncer.current,
            });
        }

        requestAnimationFrame(this.loop);
    }

    // Gambar kerangka tangan di atas video, bergaya spidol: garis krem tebal lalu garis cokelat.
    draw(hands) {
        if (!this.ctx) {
            return;
        }
        const { canvas, ctx, video } = this;
        if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
        }
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        for (const hand of hands) {
            const p = hand.points.map((pt) => ({ x: pt.x * canvas.width, y: pt.y * canvas.height }));

            for (const [width, color] of [[9, '#FFFAF1'], [4, '#3B2A1E']]) {
                ctx.strokeStyle = color;
                ctx.lineWidth = width;
                ctx.beginPath();
                for (const [a, b] of HAND_CONNECTIONS) {
                    ctx.moveTo(p[a].x, p[a].y);
                    ctx.lineTo(p[b].x, p[b].y);
                }
                ctx.stroke();
            }

            ctx.fillStyle = '#E9A23B';
            ctx.strokeStyle = '#3B2A1E';
            ctx.lineWidth = 2;
            for (const point of p) {
                ctx.beginPath();
                ctx.arc(point.x, point.y, 5, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
            }
        }
    }
}
