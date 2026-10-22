<?php
// Tambah part (satu instrumen) ke sebuah lagu. POST: song_id, instrument_id.

require __DIR__ . '/../includes/bootstrap.php';
$user = require_role('admin');

if (!is_post()) {
    redirect('admin/songs.php');
}
csrf_verify();

$songId = (int) ($_POST['song_id'] ?? 0);
$instrumentId = (int) ($_POST['instrument_id'] ?? 0);

fetch_row_or_404('SELECT id FROM songs WHERE id = ?', [$songId], 'Lagu tidak ditemukan');
$instrument = fetch_row_or_404('SELECT id, name FROM instruments WHERE id = ?', [$instrumentId], 'Instrumen tidak ditemukan');

try {
    $stmt = db()->prepare('INSERT INTO song_parts (song_id, instrument_id) VALUES (?, ?)');
    $stmt->execute([$songId, $instrumentId]);
    $partId = (int) db()->lastInsertId();
    flash('success', 'Part ' . $instrument['name'] . ' dibuat. Tambahkan nada pertamanya.');
    redirect('admin/part_notes.php?part_id=' . $partId);
} catch (PDOException $e) {
    // 1062: lagu ini sudah punya part untuk instrumen tersebut (UNIQUE song_id + instrument_id).
    if (db_error_number($e) !== 1062) {
        throw $e;
    }
    flash('error', 'Lagu ini sudah punya part ' . $instrument['name'] . '.');
    redirect('admin/song.php?id=' . $songId);
}
