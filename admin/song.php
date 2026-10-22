<?php
// Detail lagu: status tayang dan daftar part (satu part per instrumen).
// Partitur tiap part diedit di admin/part_notes.php.

require __DIR__ . '/../includes/bootstrap.php';
require __DIR__ . '/../includes/content.php';
$user = require_role('admin');

$id = (int) ($_GET['id'] ?? 0);
$song = fetch_row_or_404('SELECT * FROM songs WHERE id = ?', [$id], 'Lagu tidak ditemukan');

// Part yang sudah ada, dengan jumlah nada dan panjangnya (ketukan terakhir).
$stmt = db()->prepare(
    'SELECT p.id, i.name AS instrument_name, i.color, i.is_active,
        COUNT(n.id) AS note_count,
        COALESCE(MAX(n.start_beat + n.duration_beats), 0) AS length_beats
     FROM song_parts p
     JOIN instruments i ON i.id = p.instrument_id
     LEFT JOIN song_notes n ON n.song_part_id = p.id
     WHERE p.song_id = ?
     GROUP BY p.id, i.name, i.color, i.is_active
     ORDER BY i.id'
);
$stmt->execute([$id]);
$parts = $stmt->fetchAll();

// Instrumen yang belum punya part di lagu ini, untuk pilihan "tambah part".
$stmt = db()->prepare(
    'SELECT id, name FROM instruments
     WHERE id NOT IN (SELECT instrument_id FROM song_parts WHERE song_id = ?)
     ORDER BY id'
);
$stmt->execute([$id]);
$freeInstruments = $stmt->fetchAll();

// Panjang lagu = part terpanjang. Detik = ketukan x (60 / bpm).
$songBeats = $parts === [] ? 0 : max(array_map(fn($p) => (float) $p['length_beats'], $parts));
$songSeconds = $songBeats * 60 / (int) $song['bpm'];

$pageTitle = $song['title'];
$activeNav = 'songs';
require __DIR__ . '/../includes/admin_header.php';
?>
<p class="crumb"><a href="<?= e(url('admin/songs.php')) ?>">Lagu</a> / <?= e($song['title']) ?></p>
<div class="page-head">
    <h1 class="wavy"><?= e($song['title']) ?></h1>
    <a class="btn" href="<?= e(url('admin/song_form.php?id=' . $id)) ?>">Ubah data lagu</a>
</div>

<div class="song-facts">
    <span class="label-tag"><?= e($song['bpm']) ?> bpm</span>
    <span><?= e($song['beats_per_bar']) ?> ketukan per birama</span>
    <span><?= e(DIFFICULTIES[$song['difficulty']] ?? $song['difficulty']) ?></span>
    <span>Panjang <?= e(format_beat($songBeats)) ?> ketukan (sekitar <?= e(number_format($songSeconds, 1, ',', '')) ?> detik)</span>
</div>

<form method="post" action="<?= e(url('admin/song_publish.php')) ?>" class="publish-box">
    <?= csrf_field() ?>
    <input type="hidden" name="id" value="<?= $id ?>">
    <input type="hidden" name="back" value="song">
    <?php if ((int) $song['is_published'] === 1): ?>
        <span class="badge badge-on">Tayang</span> Lagu ini tampil di halaman publik dan bisa dipilih pemain.
        <button type="submit" name="publish" value="0" class="btn btn-small">Sembunyikan</button>
    <?php else: ?>
        <span class="badge badge-off">Draf</span> Lagu ini belum terlihat oleh pemain.
        <button type="submit" name="publish" value="1" class="btn btn-small btn-primary">Tayangkan</button>
    <?php endif; ?>
</form>

<section class="section-block">
    <h2>Part per instrumen</h2>

    <?php if ($parts === []): ?>
        <p class="empty">Belum ada part. Pilih instrumen di bawah untuk mulai menulis partitur.</p>
    <?php else: ?>
        <div class="table-wrap">
            <table class="table table-cards">
                <thead>
                <tr>
                    <th>Instrumen</th>
                    <th>Nada</th>
                    <th>Panjang</th>
                    <th><span class="sr-only">Aksi</span></th>
                </tr>
                </thead>
                <tbody>
                <?php foreach ($parts as $part): ?>
                    <tr>
                        <td data-label="Instrumen">
                            <?= color_swatch($part['color']) ?> <strong><?= e($part['instrument_name']) ?></strong>
                            <?php if ((int) $part['is_active'] !== 1): ?><span class="badge badge-off">Instrumen nonaktif</span><?php endif; ?>
                        </td>
                        <td data-label="Nada"><?= e($part['note_count']) ?></td>
                        <td data-label="Panjang"><?= e(format_beat($part['length_beats'])) ?> ketukan</td>
                        <td class="row-actions">
                            <a class="btn btn-small btn-primary" href="<?= e(url('admin/part_notes.php?part_id=' . (int) $part['id'])) ?>">Edit partitur</a>
                            <form method="post" action="<?= e(url('admin/part_delete.php')) ?>"
                                  onsubmit="return confirm('Hapus part ini beserta semua nadanya?');">
                                <?= csrf_field() ?>
                                <input type="hidden" name="id" value="<?= (int) $part['id'] ?>">
                                <button type="submit" class="btn btn-small btn-danger">Hapus part</button>
                            </form>
                        </td>
                    </tr>
                <?php endforeach; ?>
                </tbody>
            </table>
        </div>
    <?php endif; ?>

    <?php if ($freeInstruments !== []): ?>
        <form method="post" action="<?= e(url('admin/part_add.php')) ?>" class="form form-inline">
            <?= csrf_field() ?>
            <input type="hidden" name="song_id" value="<?= $id ?>">
            <label for="instrument_id">Tambah part untuk</label>
            <select id="instrument_id" name="instrument_id">
                <?php foreach ($freeInstruments as $inst): ?>
                    <option value="<?= (int) $inst['id'] ?>"><?= e($inst['name']) ?></option>
                <?php endforeach; ?>
            </select>
            <button type="submit" class="btn btn-primary">Tambah part</button>
        </form>
    <?php else: ?>
        <p class="muted">Semua instrumen sudah punya part di lagu ini.</p>
    <?php endif; ?>
</section>
<?php require __DIR__ . '/../includes/admin_footer.php'; ?>
