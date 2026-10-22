<?php
// Penilaian permainan. Semua fungsi di sini MURNI: hanya menerima array dan
// mengembalikan array, tanpa database atau session. Karena itu mudah diuji
// (lihat tests/scoring_test.php) dan mudah dijelaskan.

// Jendela toleransi: nada dianggap kena bila dimainkan paling cepat 250 ms
// sebelum atau paling lambat 250 ms sesudah waktu yang seharusnya.
const SCORE_TOLERANCE_MS = 250;

// Lama satu ketukan dalam milidetik. Contoh: 80 bpm -> 750 ms.
function beat_ms(int $bpm): float
{
    return 60000 / $bpm;
}

// Ubah partitur (start_beat dalam ketukan) menjadi daftar waktu dalam milidetik.
// Masukan : [['sound_id' => 1, 'start_beat' => '2.000'], ...]
// Keluaran: [['sound_id' => 1, 't_ms' => 1500], ...] terurut dari yang paling awal.
function notes_to_ms(array $notes, int $bpm): array
{
    $result = [];
    foreach ($notes as $note) {
        $result[] = [
            'sound_id' => (int) $note['sound_id'],
            't_ms'     => (int) round((float) $note['start_beat'] * beat_ms($bpm)),
        ];
    }
    usort($result, fn(array $a, array $b) => $a['t_ms'] <=> $b['t_ms']);
    return $result;
}

// Cocokkan nada yang diharapkan dengan event yang dimainkan pemain.
//
// Aturan:
// - Nada dianggap kena bila ada event dengan sound_id sama dan selisih
//   waktunya paling banyak $toleranceMs.
// - Bila ada beberapa event yang cocok, dipilih yang selisihnya paling kecil.
// - Setiap event hanya boleh dipakai satu kali, jadi menahan atau
//   mengulang satu gestur tidak bisa "menghabiskan" banyak nada.
// - Nada diperiksa berurutan dari yang paling awal.
//
// Masukan : $expected dan $events sama-sama [['sound_id' => int, 't_ms' => int], ...]
// Keluaran: ['total_notes', 'hits', 'misses', 'accuracy'] dengan accuracy 0 sampai 100.
function match_performance(array $expected, array $events, int $toleranceMs = SCORE_TOLERANCE_MS): array
{
    $used = [];   // indeks event yang sudah dipakai => true
    $hits = 0;

    foreach ($expected as $note) {
        $bestIndex = null;
        $bestDiff = null;

        foreach ($events as $i => $event) {
            if (isset($used[$i]) || $event['sound_id'] !== $note['sound_id']) {
                continue;
            }
            $diff = abs($event['t_ms'] - $note['t_ms']);
            if ($diff <= $toleranceMs && ($bestDiff === null || $diff < $bestDiff)) {
                $bestIndex = $i;
                $bestDiff = $diff;
            }
        }

        if ($bestIndex !== null) {
            $used[$bestIndex] = true;
            $hits++;
        }
    }

    $total = count($expected);

    return [
        'total_notes' => $total,
        'hits'        => $hits,
        'misses'      => $total - $hits,
        'accuracy'    => $total === 0 ? 0.0 : round($hits / $total * 100, 2),
    ];
}
