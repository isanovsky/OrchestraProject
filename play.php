<?php
// Mode solo.
// Tanpa parameter: form pilih instrumen dan lagu.
// Dengan ?instrument=slug&song=id&tempo=persen (song=0 berarti main bebas): panggung bermain.
// Bagian A revisi musik: yang dimainkan di sini part melodi ('notes').
// Pilihan Melodi/Akor ditambahkan di Bagian B.
// Logika bermain ada di assets/js/solo.js dan assets/js/player.js.

require __DIR__ . '/includes/bootstrap.php';
require __DIR__ . '/includes/content.php';
require __DIR__ . '/includes/icons.php';
require __DIR__ . '/includes/scoring.php';

$instruments = fetch_active_instruments();
$songs = fetch_published_songs();

$slug = is_string($_GET['instrument'] ?? null) ? $_GET['instrument'] : '';
$songParam = is_string($_GET['song'] ?? null) ? $_GET['song'] : '';
$tempo = (int) ($_GET['tempo'] ?? 100);
if (!in_array($tempo, TEMPO_OPTIONS, true)) {
    $tempo = 100;
}

$instrument = null;
foreach ($instruments as $candidate) {
    if ($candidate['slug'] === $slug) {
        $instrument = $candidate;
    }
}

$song = null;
foreach ($songs as $candidate) {
    if ((string) $candidate['id'] === $songParam) {
        $song = $candidate;
    }
}

// Siap main bila instrumen valid dan (main bebas, atau lagu punya part instrumen itu).
$error = '';
$isFree = $songParam === '0';
$ready = false;
if ($slug !== '' || $songParam !== '') {
    if ($instrument === null) {
        $error = 'Pilih salah satu instrumen dulu.';
    } elseif (!$isFree && $song === null) {
        $error = 'Pilih lagu, atau pilih main bebas.';
    } elseif (!$isFree && !song_has_part($song, (int) $instrument['id'], 'notes')) {
        $error = 'Lagu ' . $song['title'] . ' belum punya part melodi untuk ' . $instrument['name'] . '. Pilih instrumen atau lagu lain.';
    } elseif ($instrument['gestures'] === []) {
        $error = $instrument['name'] . ' belum punya pemetaan jari, jadi belum bisa dimainkan.';
    } else {
        $ready = true;
    }
}

// Nama instrumen per id, untuk label pilihan lagu.
$instrumentNames = array_column($instruments, 'name', 'id');

$pageTitle = $ready ? 'Main ' . $instrument['name'] : 'Main solo';
$bodyClass = 'page-play';
if ($ready) {
    $pageScripts = ['assets/js/solo.js'];
}
require __DIR__ . '/includes/layout_header.php';
?>
<?php if (!$ready): ?>
    <h1 class="wavy">Main solo</h1>
    <p class="lead">Pilih instrumen, lalu lagu yang mau dimainkan. Main bebas cocok untuk pemanasan.</p>

    <?php if ($error !== ''): ?>
        <p class="alert alert-error" role="alert"><?= e($error) ?></p>
    <?php endif; ?>

    <form method="get" action="<?= e(url('play.php')) ?>" class="pick-form">
        <fieldset>
            <legend>1. Instrumen</legend>
            <div class="pick-row">
                <?php foreach ($instruments as $i => $option): ?>
                    <label class="pick-card" style="--inst-color: <?= e($option['color']) ?>">
                        <input type="radio" name="instrument" value="<?= e($option['slug']) ?>"
                            <?= $option['slug'] === $slug || ($slug === '' && $i === 0) ? 'checked' : '' ?>>
                        <?= instrument_icon($option['type'], $option['color']) ?>
                        <span><?= e($option['name']) ?></span>
                    </label>
                <?php endforeach; ?>
            </div>
        </fieldset>

        <fieldset>
            <legend>2. Lagu</legend>
            <select name="song" aria-label="Lagu">
                <option value="0"<?= $isFree ? ' selected' : '' ?>>Main bebas, tanpa lagu</option>
                <?php foreach ($songs as $option): ?>
                    <?php
                    // Hanya part melodi yang bisa dimainkan di halaman ini (akor menyusul).
                    $melodyParts = array_filter($option['parts'], fn($p) => $p['style'] === 'notes');
                    $partNames = array_map(fn($p) => $instrumentNames[$p['instrument_id']] ?? '', $melodyParts);
                    ?>
                    <option value="<?= (int) $option['id'] ?>"<?= (string) $option['id'] === $songParam ? ' selected' : '' ?>>
                        <?= e($option['title']) ?> (part: <?= e(implode(', ', $partNames)) ?>)
                    </option>
                <?php endforeach; ?>
            </select>
        </fieldset>

        <fieldset>
            <legend>3. Tempo latihan</legend>
            <select name="tempo" aria-label="Tempo latihan">
                <?php foreach (array_reverse(TEMPO_OPTIONS) as $option): ?>
                    <option value="<?= $option ?>"<?= $option === $tempo ? ' selected' : '' ?>>
                        <?= $option ?>%<?= $option === 100 ? ' (tempo asli, masuk papan skor utama)' : ' (latihan)' ?>
                    </option>
                <?php endforeach; ?>
            </select>
        </fieldset>

        <button type="submit" class="btn btn-primary btn-big">Ke panggung</button>
    </form>
<?php else: ?>
    <?php require __DIR__ . '/includes/stage.php'; ?>
<?php endif; ?>
<?php require __DIR__ . '/includes/layout_footer.php'; ?>
