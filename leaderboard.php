<?php
// Papan skor: 10 nilai tertinggi per lagu dan instrumen.

require __DIR__ . '/includes/bootstrap.php';
require __DIR__ . '/includes/content.php';
require __DIR__ . '/includes/icons.php';

const LEADERBOARD_SIZE = 10;

$songs = fetch_published_songs();

// Lagu terpilih dari ?song=, default lagu pertama.
$songId = (int) ($_GET['song'] ?? 0);
$song = null;
foreach ($songs as $candidate) {
    if ((int) $candidate['id'] === $songId) {
        $song = $candidate;
    }
}
if ($song === null && $songs !== []) {
    $song = $songs[0];
}

// Satu tabel per instrumen yang punya part di lagu ini.
$boards = [];
if ($song !== null) {
    $stmt = db()->prepare(
        'SELECT nickname, accuracy, hits, total_notes, mode, played_at
         FROM performances
         WHERE song_id = ? AND instrument_id = ?
         ORDER BY accuracy DESC, hits DESC, played_at ASC
         LIMIT ' . LEADERBOARD_SIZE
    );
    foreach (fetch_active_instruments() as $instrument) {
        if (!in_array((int) $instrument['id'], $song['instrument_ids'], true)) {
            continue;
        }
        $stmt->execute([(int) $song['id'], (int) $instrument['id']]);
        $boards[] = ['instrument' => $instrument, 'rows' => $stmt->fetchAll()];
    }
}

$pageTitle = 'Papan skor';
$activeNav = 'leaderboard';
require __DIR__ . '/includes/layout_header.php';
?>
<h1 class="wavy">Papan skor</h1>

<?php if ($song === null): ?>
    <div class="empty-state paper">
        <img src="<?= e(url('assets/img/mascot-oops.svg')) ?>" alt="" width="90" height="105">
        <p>Belum ada lagu yang tayang, jadi papan skornya masih kosong melompong.</p>
    </div>
<?php else: ?>
    <form method="get" action="<?= e(url('leaderboard.php')) ?>" class="form form-inline">
        <label for="song">Lagu</label>
        <select id="song" name="song">
            <?php foreach ($songs as $option): ?>
                <option value="<?= (int) $option['id'] ?>"<?= (int) $option['id'] === (int) $song['id'] ? ' selected' : '' ?>><?= e($option['title']) ?></option>
            <?php endforeach; ?>
        </select>
        <button type="submit" class="btn">Lihat</button>
    </form>

    <div class="board-grid">
        <?php foreach ($boards as $board): ?>
            <?php $instrument = $board['instrument']; ?>
            <section class="board" style="--inst-color: <?= e($instrument['color']) ?>">
                <h2><?= instrument_icon($instrument['type'], $instrument['color'], 'inst-icon inst-icon-small') ?> <?= e($instrument['name']) ?></h2>
                <?php if ($board['rows'] === []): ?>
                    <p class="empty">Belum ada yang main lagu ini dengan <?= e($instrument['name']) ?>. Jadi yang pertama?</p>
                    <a class="btn btn-small btn-primary" href="<?= e(url('play.php?instrument=' . $instrument['slug'] . '&song=' . (int) $song['id'])) ?>">Main sekarang</a>
                <?php else: ?>
                    <ol class="board-list">
                        <?php foreach ($board['rows'] as $rank => $row): ?>
                            <li>
                                <span class="board-rank"><?= $rank + 1 ?></span>
                                <span class="board-name">
                                    <?= e($row['nickname']) ?>
                                    <small class="muted"><?= e($row['hits']) ?>/<?= e($row['total_notes']) ?> nada, <?= $row['mode'] === 'room' ? 'main bersama' : 'solo' ?>, <?= e(format_datetime($row['played_at'])) ?></small>
                                </span>
                                <span class="board-score"><?= e(number_format((float) $row['accuracy'], 1, ',', '')) ?>%</span>
                            </li>
                        <?php endforeach; ?>
                    </ol>
                <?php endif; ?>
            </section>
        <?php endforeach; ?>
    </div>
<?php endif; ?>
<?php require __DIR__ . '/includes/layout_footer.php'; ?>
