<?php
// Markup panggung bermain, dipakai play.php (dan room.php di Fase 4).
// Wajib sebelum include: $instrument (dari fetch_active_instruments()),
// $song (dari fetch_published_songs(), atau null untuk main bebas),
// $tempo (persen tempo latihan, 50 sampai 100), $style ('notes' atau 'chords').
// Semua elemen dengan id di bawah dipakai oleh assets/js/solo.js.
?>
<section class="stage" id="stage"
         style="--inst-color: <?= e($instrument['color']) ?>"
         data-instrument-slug="<?= e($instrument['slug']) ?>"
         data-song-id="<?= $song === null ? 0 : (int) $song['id'] ?>"
         data-part-style="<?= e($style) ?>"
         data-instrument-type="<?= e($instrument['type']) ?>"
         data-default-transpose="<?= $song === null ? 0 : (int) $song['default_transpose'] ?>"
         data-free-bpm="<?= (int) round(FREE_MODE_BPM * $tempo / 100) ?>"
         data-tempo="<?= (int) $tempo ?>">

    <div class="stage-head">
        <span id="inst-icon" class="stage-icon"><?= instrument_icon($instrument['type'], $instrument['color']) ?></span>
        <div>
            <h1><?= e($instrument['name']) ?><?= $style === 'chords' ? ' (akor)' : '' ?><?= $song !== null ? ': ' . e($song['title']) : ', main bebas' ?></h1>
            <p class="muted">
                <?php if ($song !== null): ?>
                    <?php $effectiveBpm = $song['bpm'] * $tempo / 100; ?>
                    <?= e(round($effectiveBpm)) ?> bpm<?= $tempo !== 100 ? ' (tempo latihan ' . $tempo . '% dari ' . e($song['bpm']) . ')' : '' ?>,
                    <?= e(format_duration($song['length_seconds'] * 100 / $tempo)) ?>. Ikuti angka di balok lajur.
                <?php else: ?>
                    Tanpa lagu dan tanpa nilai. Bebas bereksperimen.
                <?php endif; ?>
            </p>
        </div>
        <a class="btn btn-small btn-ghost" href="<?= e(url('play.php')) ?>">Ganti pilihan</a>
    </div>

    <?php require __DIR__ . '/laptop_notice.php'; ?>

    <!-- Gerbang: browser hanya mengizinkan suara dan kamera setelah diklik. -->
    <div class="start-gate paper" id="start-gate">
        <button type="button" class="btn btn-primary btn-big" id="btn-start">Siapkan instrumen</button>
        <p class="status" id="status" role="status">Klik tombol di atas untuk menyalakan suara dan memilih cara main.</p>
    </div>

    <div class="stage-grid" id="stage-main" hidden>
        <div class="stage-input">
            <div class="mode-switch" role="group" aria-label="Cara main">
                <button type="button" class="btn btn-small" data-mode="camera">Kamera</button>
                <button type="button" class="btn btn-small" data-mode="keys">Keyboard / pad</button>
            </div>

            <div class="camera-box" id="camera-box">
                <video id="cam" playsinline muted></video>
                <canvas id="cam-overlay"></canvas>
                <p class="camera-status" id="camera-status"></p>
            </div>

            <div class="keys-box paper" id="keys-box" hidden>
                <p>Tahan tombol <kbd>1</kbd> sampai <kbd>9</kbd> di keyboard, atau tekan pad di bawah. Lepas = diam.</p>
                <div class="pad" id="pad"></div>
            </div>
        </div>

        <aside class="stage-side">
            <p class="now-playing" id="now" aria-live="polite">Diam</p>

            <?php $isPitched = $instrument['type'] !== 'drum'; ?>
            <?php if ($isPitched): ?>
                <div class="setting">
                    <span class="test-label" id="transpose-title">Nada dasar</span>
                    <div class="stepper" role="group" aria-labelledby="transpose-title">
                        <button type="button" class="btn btn-small" id="transpose-down" aria-label="Turunkan nada dasar">-</button>
                        <output id="transpose-label">Do = C</output>
                        <button type="button" class="btn btn-small" id="transpose-up" aria-label="Naikkan nada dasar">+</button>
                    </div>
                </div>
            <?php endif; ?>

            <?php if ($isPitched && $song === null): ?>
                <div class="setting">
                    <span class="test-label">Gaya main</span>
                    <div class="mode-switch" role="group" aria-label="Gaya main">
                        <button type="button" class="btn btn-small" data-style="notes">Melodi</button>
                        <button type="button" class="btn btn-small" data-style="chords">Akor</button>
                    </div>
                </div>
            <?php endif; ?>

            <?php if ($instrument['play_mode'] === 'decay'): ?>
                <div class="setting" id="chord-options" hidden>
                    <label for="bass" class="test-label">Bass otomatis</label>
                    <select id="bass" class="setting-select">
                        <option value="0">Mati</option>
                        <option value="1" selected>Satu oktaf di bawah</option>
                        <option value="2">Dua oktaf di bawah</option>
                    </select>
                    <p class="setting-note">Bass dua oktaf hampir tidak terdengar dari speaker laptop. Pakai headphone atau speaker luar.</p>

                    <label for="rhythm" class="test-label">Ritme akor</label>
                    <select id="rhythm" class="setting-select">
                        <option value="change">Hanya saat ganti akor</option>
                        <option value="half">Ketukan 1 dan 3</option>
                        <option value="beat">Setiap ketukan</option>
                    </select>
                </div>
            <?php endif; ?>

            <?php if ($instrument['type'] === 'drum' && $song !== null): ?>
                <label class="check-line">
                    <input type="checkbox" id="auto-hihat" checked>
                    Hi-hat otomatis tiap setengah ketuk (tidak dinilai)
                </label>
            <?php endif; ?>

            <label for="volume" class="test-label">Volume</label>
            <input type="range" id="volume" min="0" max="100" value="80">

            <label for="reverb" class="test-label">Gema</label>
            <input type="range" id="reverb" min="0" max="100" value="25">

            <p class="test-label">Contekan jari</p>
            <ul class="cheat" id="cheat">
                <?php foreach ($instrument['gestures'] as $gesture): ?>
                    <li><span class="finger-count"><?= e($gesture['finger_count']) ?></span> <?= e($gesture['sound_name']) ?></li>
                <?php endforeach; ?>
            </ul>
            <?php if ($isPitched): ?>
                <ul class="cheat-notes">
                    <li>Untuk mengulang nada yang sama, kepalkan tangan dulu.</li>
                    <li>Akor yang sama di birama berikutnya cukup ditahan.</li>
                </ul>
            <?php endif; ?>
        </aside>
    </div>

    <?php if ($song !== null): ?>
        <div class="song-area" id="song-area" hidden>
            <div class="song-bar">
                <span class="beat-dot" id="beat" aria-live="off">-</span>
                <p class="hint" id="hint">Tekan Mulai lagu kalau sudah siap.</p>
                <button type="button" class="btn btn-primary" id="btn-play-song">Mulai lagu</button>
            </div>
            <div class="play-lane" id="lane">
                <span class="lane-hitline" aria-hidden="true"></span>
                <div class="lane-track" id="lane-track"></div>
            </div>
        </div>

        <section class="result paper" id="result" hidden aria-live="polite">
            <img class="result-mascot" id="result-mascot" src="<?= e(url('assets/img/mascot-wave.svg')) ?>" alt="" width="120" height="140">
            <div class="result-body">
                <p class="label-tag">Hasil</p>
                <p class="result-score"><span id="result-accuracy">0</span>%</p>
                <p id="result-detail" class="muted">Menghitung nilai di server...</p>

                <form class="form form-inline" id="save-form" hidden>
                    <label for="nickname">Nickname</label>
                    <input type="text" id="nickname" maxlength="30" autocomplete="nickname" required placeholder="misalnya Rina">
                    <button type="submit" class="btn btn-primary">Simpan ke papan skor</button>
                </form>
                <p id="save-message" class="save-message" role="status"></p>

                <div class="form-actions">
                    <button type="button" class="btn" id="btn-again">Main lagi</button>
                    <a class="btn btn-ghost" href="<?= e(url('leaderboard.php?song=' . (int) $song['id'])) ?>">Lihat papan skor</a>
                </div>
            </div>
        </section>
    <?php endif; ?>
</section>
