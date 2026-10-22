<?php
// Daftar pilihan (enum) dan helper kecil untuk halaman pengelolaan konten.
// Kunci array = nilai di database, isi array = label yang tampil di layar.

const INSTRUMENT_TYPES = [
    'piano' => 'Piano (bernada)',
    'synth' => 'Synth (bernada)',
    'drum'  => 'Drum (tanpa nada)',
];

const PLAY_MODES = [
    'decay'   => 'Decay: bunyi sekali lalu meluruh',
    'sustain' => 'Sustain: bunyi selama gestur ditahan',
    'hit'     => 'Hit: pukulan pendek',
];

const DIFFICULTIES = [
    'easy'   => 'Mudah',
    'medium' => 'Sedang',
    'hard'   => 'Sulit',
];

const PERFORMANCE_MODES = [
    'solo' => 'Solo',
    'room' => 'Room',
];

// Ubah teks angka desimal dari form menjadi string siap simpan.
// Menerima koma atau titik ("1,5" atau "1.5"), maksimal $decimals angka
// di belakang koma. Hasil null berarti formatnya salah.
function parse_decimal(string $text, int $decimals): ?string
{
    $text = str_replace(',', '.', trim($text));
    if (!preg_match('/^\d{1,6}(\.\d{1,' . $decimals . '})?$/', $text)) {
        return null;
    }
    return $text;
}

// Tampilkan angka ketukan tanpa nol berlebih: "4.000" -> "4", "1.500" -> "1.5".
function format_beat(string|float|null $value): string
{
    if ($value === null || $value === '') {
        return '-';
    }
    return rtrim(rtrim(number_format((float) $value, 3, '.', ''), '0'), '.');
}

// Kotak warna kecil untuk menandai instrumen.
function color_swatch(string $hex): string
{
    return '<span class="swatch" style="background:' . e($hex) . '"></span>';
}

// Lagu yang sudah tayang tapi tidak punya nada lagi (setelah nada atau part
// dihapus) otomatis disembunyikan, supaya pemain tidak memilih lagu kosong.
// Mengembalikan true bila lagu baru saja disembunyikan.
function unpublish_if_empty(int $songId): bool
{
    $stmt = db()->prepare(
        'UPDATE songs SET is_published = 0
         WHERE id = ? AND is_published = 1
           AND NOT EXISTS (
               SELECT 1 FROM song_notes n JOIN song_parts p ON p.id = n.song_part_id WHERE p.song_id = ?
           )'
    );
    $stmt->execute([$songId, $songId]);
    return $stmt->rowCount() === 1;
}
