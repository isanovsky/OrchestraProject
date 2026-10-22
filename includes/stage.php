<?php
// Markup panggung bermain, dipakai play.php (dan room.php di Fase 4).
// Wajib sebelum include: $instrument (dari fetch_active_instruments()),
// $song (dari fetch_published_songs(), atau null untuk main bebas).
// Semua elemen dengan id di bawah dipakai oleh assets/js/solo.js.
?>
<section class="stage" id="stage"
         style="--inst-color: <?= e($instrument['color']) ?>"
         data-instrument-slug="<?= e($instrument['slug']) ?>"
         data-song-id="<?= $song === null ? 0 : (int) $song['id'] ?>">

    <div class="stage-head">
        <span id="inst-icon" class="stage-icon"><?= instrument_icon($instrument['type'], $instrument['color']) ?></span>
        <div>
            <h1><?= e($instrument['name']) ?><?= $song !== null ? ': ' . e($song['title']) : ', main bebas' ?></h1>
            <p class="muted">
                <?php if ($song !== null): ?>
                    <?= e($song['bpm']) ?> bpm, <?= e(format_duration($song['length_seconds'])) ?>. Ikuti angka di balok lajur.
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
                <p>Tahan tombol <kbd>1</kbd> sampai <kbd>8</kbd> di keyboard, atau tekan pad di bawah. Lepas = diam.</p>
                <div class="pad" id="pad"></div>
            </div>
        </div>

        <aside class="stage-side">
            <p class="now-playing" id="now" aria-live="polite">Diam</p>

            <label for="volume" class="test-label">Volume</label>
            <input type="range" id="volume" min="0" max="100" value="80">

            <p class="test-label">Contekan jari</p>
            <ul class="cheat">
                <?php foreach ($instrument['gestures'] as $gesture): ?>
                    <li><span class="finger-count"><?= e($gesture['finger_count']) ?></span> <?= e($gesture['sound_name']) ?></li>
                <?php endforeach; ?>
            </ul>
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
