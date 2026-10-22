<?php
// Daftar instrumen aktif dan tabel pemetaan jari -> bunyi (dari database).

require __DIR__ . '/includes/bootstrap.php';
require __DIR__ . '/includes/content.php';
require __DIR__ . '/includes/icons.php';

$instruments = fetch_active_instruments();

// Penjelasan singkat mode main untuk pemain.
$modeHelp = [
    'decay'   => 'Bunyi sekali lalu pelan-pelan hilang, seperti tuts piano dipencet.',
    'sustain' => 'Bunyi terus selama jarimu tetap terangkat. Kepalkan tangan untuk berhenti.',
    'hit'     => 'Pukulan pendek. Ganti jumlah jari untuk memukul lagi.',
];

$pageTitle = 'Instrumen';
$activeNav = 'instruments';
require __DIR__ . '/includes/layout_header.php';
?>
<h1 class="wavy">Instrumen dan jarinya</h1>
<p class="lead">Jumlah jari dihitung dari kedua tangan. Satu tangan untuk 1 sampai 5, dua tangan untuk 6 sampai 10.
    Kepalan tangan (0 jari) berarti diam.</p>

<?php if ($instruments === []): ?>
    <div class="empty-state paper">
        <img src="<?= e(url('assets/img/mascot-oops.svg')) ?>" alt="" width="90" height="105">
        <p>Belum ada instrumen aktif. Admin sedang menyetemnya.</p>
    </div>
<?php endif; ?>

<?php foreach ($instruments as $instrument): ?>
    <section class="inst-block" style="--inst-color: <?= e($instrument['color']) ?>" id="<?= e($instrument['slug']) ?>">
        <div class="inst-head">
            <?= instrument_icon($instrument['type'], $instrument['color'], 'inst-icon inst-icon-big') ?>
            <div>
                <h2><?= e($instrument['name']) ?></h2>
                <p class="muted"><?= e($modeHelp[$instrument['play_mode']] ?? '') ?></p>
            </div>
            <a class="btn btn-primary" href="<?= e(url('play.php?instrument=' . $instrument['slug'])) ?>">Coba main</a>
        </div>

        <?php if ($instrument['gestures'] === []): ?>
            <p class="empty">Belum ada pemetaan jari untuk instrumen ini.</p>
        <?php else: ?>
            <ul class="finger-map">
                <?php foreach ($instrument['gestures'] as $gesture): ?>
                    <li>
                        <span class="finger-count"><?= e($gesture['finger_count']) ?></span>
                        <span><strong><?= e($gesture['sound_name']) ?></strong> <code><?= e($gesture['sound_code']) ?></code></span>
                    </li>
                <?php endforeach; ?>
            </ul>
        <?php endif; ?>
    </section>
<?php endforeach; ?>
<?php require __DIR__ . '/includes/layout_footer.php'; ?>
