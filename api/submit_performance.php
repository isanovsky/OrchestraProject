<?php
// POST api/submit_performance.php  (body JSON)
//
// Klien mengirim apa yang DIMAINKAN, bukan nilainya:
// {
//   "mode": "solo",
//   "song_id": 1,
//   "instrument_id": 1,
//   "nickname": "Rina",          // opsional: kosong = hanya hitung nilai, tidak disimpan
//   "events": [ { "t_ms": 0, "sound_id": 1 }, { "t_ms": 760, "sound_id": 1 }, ... ]
// }
// t_ms = milidetik sejak lagu mulai. Server mengambil partitur dari database,
// lalu menghitung nilai dengan match_performance() di includes/scoring.php.
//
// Mode solo memakai alur dua langkah: kirim tanpa nickname untuk melihat nilai,
// lalu kirim lagi dengan nickname bila pemain mau menyimpannya. Nilai selalu
// dihitung ulang dari event, jadi klien tidak pernah bisa mengirim nilai sendiri.

require __DIR__ . '/../includes/bootstrap.php';
require __DIR__ . '/../includes/api.php';
require __DIR__ . '/../includes/scoring.php';

require_method('POST');

// Batas penyimpanan per session supaya papan skor tidak dibanjiri.
const MAX_SAVES_PER_WINDOW = 10;
const SAVE_WINDOW_SECONDS = 600;
// Event yang masih diterima setelah lagu selesai.
const LATE_GRACE_MS = 2000;
// Jumlah event maksimal = 4 x jumlah nada di partitur.
const MAX_EVENTS_PER_NOTE = 4;

$body = read_json_body();

// --- Validasi field dasar ---
$mode = $body['mode'] ?? '';
if ($mode !== 'solo') {
    // Mode room dikerjakan di Fase 4.
    json_error('Mode harus "solo".', 400);
}

$songId = int_or_null($body['song_id'] ?? null);
$instrumentId = int_or_null($body['instrument_id'] ?? null);
if ($songId === null || $songId < 1 || $instrumentId === null || $instrumentId < 1) {
    json_error('song_id dan instrument_id wajib berupa angka positif.', 400);
}

$nickname = $body['nickname'] ?? '';
if (!is_string($nickname)) {
    json_error('Nickname harus berupa teks.', 400);
}
$nickname = trim(preg_replace('/\s+/u', ' ', $nickname));
if ($nickname !== '' && !preg_match('/^[\p{L}\p{N} ._-]{2,30}$/u', $nickname)) {
    json_error('Nickname 2 sampai 30 karakter: huruf, angka, spasi, titik, minus, atau garis bawah.', 422);
}

$events = $body['events'] ?? null;
if (!is_array($events) || !array_is_list($events)) {
    json_error('events harus berupa daftar.', 400);
}

// --- Data lagu dan partitur dari database ---
$stmt = db()->prepare('SELECT id, bpm FROM songs WHERE id = ? AND is_published = 1');
$stmt->execute([$songId]);
$song = $stmt->fetch();
if ($song === false) {
    json_error('Lagu tidak ditemukan atau belum tayang.', 404);
}

$stmt = db()->prepare('SELECT id FROM instruments WHERE id = ? AND is_active = 1');
$stmt->execute([$instrumentId]);
if ($stmt->fetch() === false) {
    json_error('Instrumen tidak ditemukan atau sedang nonaktif.', 404);
}

$stmt = db()->prepare(
    'SELECT n.sound_id, n.start_beat
     FROM song_notes n JOIN song_parts p ON p.id = n.song_part_id
     WHERE p.song_id = ? AND p.instrument_id = ?'
);
$stmt->execute([$songId, $instrumentId]);
$partNotes = $stmt->fetchAll();
if ($partNotes === []) {
    json_error('Lagu ini tidak punya part untuk instrumen tersebut.', 404);
}

// Panjang lagu dihitung dari semua part (sama dengan api/song.php).
$stmt = db()->prepare(
    'SELECT COALESCE(MAX(n.start_beat + n.duration_beats), 0)
     FROM song_notes n JOIN song_parts p ON p.id = n.song_part_id
     WHERE p.song_id = ?'
);
$stmt->execute([$songId]);
$songLengthMs = (float) $stmt->fetchColumn() * beat_ms((int) $song['bpm']);
$maxTimeMs = (int) ceil($songLengthMs) + LATE_GRACE_MS;

// Bunyi yang sah = bunyi milik instrumen ini.
$stmt = db()->prepare('SELECT id FROM sounds WHERE instrument_id = ?');
$stmt->execute([$instrumentId]);
$validSoundIds = array_flip(array_map('intval', $stmt->fetchAll(PDO::FETCH_COLUMN)));

// --- Validasi setiap event ---
$maxEvents = count($partNotes) * MAX_EVENTS_PER_NOTE;
if (count($events) > $maxEvents) {
    json_error("Terlalu banyak event: maksimal {$maxEvents} untuk lagu ini.", 422);
}

$cleanEvents = [];
foreach ($events as $index => $event) {
    $tMs = is_array($event) ? int_or_null($event['t_ms'] ?? null) : null;
    $soundId = is_array($event) ? int_or_null($event['sound_id'] ?? null) : null;

    if ($tMs === null || $soundId === null) {
        json_error("Event ke-{$index} harus berisi t_ms dan sound_id berupa angka.", 422);
    }
    if ($tMs < 0 || $tMs > $maxTimeMs) {
        json_error("Event ke-{$index} di luar durasi lagu.", 422);
    }
    if (!isset($validSoundIds[$soundId])) {
        json_error("Event ke-{$index} memakai bunyi yang bukan milik instrumen ini.", 422);
    }
    $cleanEvents[] = ['t_ms' => $tMs, 'sound_id' => $soundId];
}

// --- Hitung nilai ---
$result = match_performance(notes_to_ms($partNotes, (int) $song['bpm']), $cleanEvents);

if ($nickname === '') {
    json_response(['ok' => true, 'saved' => false] + $result);
}

// --- Simpan ke papan skor ---
$now = time();
$saves = array_values(array_filter(
    $_SESSION['performance_saves'] ?? [],
    fn(int $t) => $now - $t < SAVE_WINDOW_SECONDS
));
if (count($saves) >= MAX_SAVES_PER_WINDOW) {
    json_error('Kamu sudah menyimpan banyak nilai barusan. Istirahat sebentar, lalu coba lagi.', 429);
}

$stmt = db()->prepare(
    "INSERT INTO performances (room_id, song_id, instrument_id, nickname, mode, total_notes, hits, misses, accuracy)
     VALUES (NULL, ?, ?, ?, 'solo', ?, ?, ?, ?)"
);
$stmt->execute([
    $songId, $instrumentId, $nickname,
    $result['total_notes'], $result['hits'], $result['misses'], $result['accuracy'],
]);

$saves[] = $now;
$_SESSION['performance_saves'] = $saves;

// Peringkat = 1 + jumlah nilai yang lebih tinggi di lagu dan instrumen yang sama.
$stmt = db()->prepare(
    'SELECT COUNT(*) + 1 FROM performances WHERE song_id = ? AND instrument_id = ? AND accuracy > ?'
);
$stmt->execute([$songId, $instrumentId, $result['accuracy']]);
$rank = (int) $stmt->fetchColumn();

json_response(['ok' => true, 'saved' => true, 'rank' => $rank, 'nickname' => $nickname] + $result);
