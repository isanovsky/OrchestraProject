<?php
// Main bersama (multiplayer). Dibangun di Fase 4: buat room, join, lobby,
// sinkronisasi jam, dan mulai bersama. Untuk sementara halaman ini hanya
// memberi tahu pemain dan mengarahkan ke mode solo.

require __DIR__ . '/includes/bootstrap.php';

$pageTitle = 'Main bersama';
require __DIR__ . '/includes/layout_header.php';
?>
<section class="error-box">
    <img class="error-mascot" src="<?= e(url('assets/img/mascot-wave.svg')) ?>" alt="" width="160" height="186">
    <div>
        <p class="label-tag">Segera hadir</p>
        <h1 class="wavy">Panggung bersama sedang dirakit</h1>
        <p>Sebentar lagi kamu bisa membuat room, membagikan kodenya ke tiga teman, lalu mulai satu lagu bersamaan.
            Sambil menunggu, latihan dulu di mode solo.</p>
        <p><a class="btn btn-primary" href="<?= e(url('play.php')) ?>">Latihan solo</a></p>
    </div>
</section>
<?php require __DIR__ . '/includes/layout_footer.php'; ?>
