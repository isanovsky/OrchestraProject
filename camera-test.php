<?php
// Uji kamera: video, kerangka tangan, dan jumlah jari terdeteksi secara langsung.
// Tidak butuh database; semua deteksi berjalan di browser.

require __DIR__ . '/includes/bootstrap.php';

$pageTitle = 'Uji kamera';
$activeNav = 'camera';
$bodyClass = 'page-play';
$pageScripts = ['assets/js/camera-test.js'];
require __DIR__ . '/includes/layout_header.php';
?>
<h1 class="wavy">Uji kamera</h1>
<p class="lead">Cek dulu sebelum main: apakah kamera melihat tanganmu dan menghitung jarinya dengan benar?</p>

<?php require __DIR__ . '/includes/laptop_notice.php'; ?>

<div class="test-grid">
    <div class="camera-box" id="camera-box">
        <video id="cam" playsinline muted></video>
        <canvas id="cam-overlay"></canvas>
        <div class="camera-gate" id="camera-gate">
            <button type="button" class="btn btn-primary btn-big" id="btn-camera">Nyalakan kamera</button>
            <p class="status" id="status" role="status">Kamera belum menyala.</p>
        </div>
    </div>

    <aside class="test-panel paper">
        <p class="test-label">Jumlah jari (setelah debounce)</p>
        <p class="big-count" id="stable-total">0</p>
        <p class="muted small">Angka mentah per frame: <strong id="raw-total">0</strong></p>

        <ul class="hand-list" id="hand-list">
            <li class="muted">Belum ada tangan terlihat.</li>
        </ul>

        <label for="stable-ms" class="test-label">Lama debounce: <strong id="stable-ms-value">100</strong> ms</label>
        <input type="range" id="stable-ms" min="0" max="400" step="20" value="100">
        <p class="muted small">Makin besar, makin tenang tetapi makin lambat bereaksi. 0 = tanpa debounce, coba lihat bedanya.</p>
    </aside>
</div>

<section class="tips">
    <h2>Kalau hitungannya meleset</h2>
    <ul>
        <li>Duduk sekitar satu lengan dari kamera, seluruh telapak tangan masuk layar.</li>
        <li>Hadapkan telapak ke kamera dan buka jari lebar-lebar.</li>
        <li>Hindari cahaya terang dari belakang (jendela di belakang badan).</li>
        <li>Untuk 6 sampai 10 jari, angkat kedua tangan dan beri jarak di antara keduanya.</li>
    </ul>
</section>
<?php require __DIR__ . '/includes/layout_footer.php'; ?>
