<?php
// Daftar instrumen aktif dan tabel pemetaan jari -> bunyi (dari database).

require __DIR__ . '/includes/bootstrap.php';
require __DIR__ . '/includes/content.php';
require __DIR__ . '/includes/icons.php';
require_once __DIR__ . '/includes/music.php';

// Tabel jari -> akor untuk mode Akor (Do = C). Akor disusun diatonis dari
// nada dasar bunyi gestur; derajatnya dihitung dari kode bunyi relatif
// terhadap Do instrumen (bunyi C di gestur 1 jari), bukan dari sort_order.
function chord_rows(array $gestures): array
{
    // Bentuk ulang data gestur supaya bisa dipakai instrument_do_octave().
    $sounds = [];
    $links = [];
    foreach ($gestures as $gesture) {
        $sounds[] = ['id' => (int) $gesture['finger_count'], 'code' => $gesture['sound_code']];
        $links[] = ['finger_count' => (int) $gesture['finger_count'], 'sound_id' => (int) $gesture['finger_count']];
    }
    $doOctave = instrument_do_octave($sounds, $links);
    $rows = [];
    foreach ($gestures as $gesture) {
        $degree = $doOctave === null ? null : code_to_degree($gesture['sound_code'], $doOctave);
        if ($degree === null) {
            continue;
        }
        $note = '';
        if ($degree['octave_shift'] > 0) {
            $note = 'oktaf tinggi';
        } elseif ($degree['octave_shift'] < 0) {
            $note = 'oktaf rendah';
        }
        $rows[] = ['finger_count' => $gesture['finger_count'], 'chord' => chord_name($degree['degree'], 0), 'note' => $note];
    }
    return $rows;
}

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

            <?php $chords = $instrument['type'] === 'drum' ? [] : chord_rows($instrument['gestures']); ?>
            <?php if ($chords !== []): ?>
                <h3 class="chord-title">Kalau main mode Akor (lagu Do = C)</h3>
                <ul class="finger-map chord-map">
                    <?php foreach ($chords as $row): ?>
                        <li>
                            <span class="finger-count"><?= e($row['finger_count']) ?></span>
                            <span><strong><?= e($row['chord']) ?></strong><?= $row['note'] !== '' ? ' <span class="muted">(' . e($row['note']) . ')</span>' : '' ?></span>
                        </li>
                    <?php endforeach; ?>
                </ul>
                <p class="muted small">Di lagu dengan nada dasar lain, nama akornya ikut bergeser (misalnya Do = G: 1 jari = G, 5 jari = D).</p>
            <?php endif; ?>
        <?php endif; ?>
    </section>
<?php endforeach; ?>
<?php require __DIR__ . '/includes/layout_footer.php'; ?>
