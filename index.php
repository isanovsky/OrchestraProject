<?php
// Landing page publik.
// Fase 1: versi sementara. Isi lengkap (instrumen, cara main, tombol main)
// dibuat di Fase 3.

require __DIR__ . '/includes/bootstrap.php';

$pageTitle = 'Beranda';
require __DIR__ . '/includes/layout_header.php';
?>
<section class="intro">
    <div class="intro-text">
        <p class="label-tag">Orkestra mini, 1 sampai 4 pemain</p>
        <h1 class="wavy">Angkat jari, panggungnya bunyi.</h1>
        <p>Kamera membaca berapa jari yang kamu angkat. Tiga jari? Piano berbunyi Mi.
            Lima jari di depan drum? Crash! Ajak sampai tiga teman, pilih instrumen
            masing-masing, lalu mainkan satu lagu bareng.</p>
        <p class="muted">Panggungnya sedang dirakit. Mode main solo dan main bersama segera hadir.</p>
    </div>
    <img class="intro-mascot" src="<?= e(url('assets/img/mascot-wave.svg')) ?>" alt="Maskot tangan kecil yang melambai" width="200" height="233">
</section>
<?php require __DIR__ . '/includes/layout_footer.php'; ?>
