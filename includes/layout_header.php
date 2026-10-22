<?php
// Kepala halaman publik.
// Variabel opsional sebelum include: $pageTitle, $bodyClass.
// Sengaja tidak memanggil database, supaya halaman error tetap bisa
// tampil walaupun database sedang bermasalah.

$pageTitle = $pageTitle ?? 'GestureOrchestra';
$bodyClass = $bodyClass ?? '';
$loggedInRole = $_SESSION['role'] ?? null;
?>
<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title><?= e($pageTitle) ?> - GestureOrchestra</title>
    <link rel="icon" href="<?= e(url('assets/img/favicon.svg')) ?>" type="image/svg+xml">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:ital,wght@0,400;0,700;1,400&family=Fraunces:opsz,wght@9..144,600;9..144,800&display=swap">
    <link rel="stylesheet" href="<?= e(url('assets/css/app.css')) ?>">
</head>
<body class="<?= e($bodyClass) ?>">
<a class="skip-link" href="#main">Langsung ke isi</a>
<header class="site-header">
    <a class="brand" href="<?= e(url('index.php')) ?>">
        <img src="<?= e(url('assets/img/logo-note.svg')) ?>" alt="" width="34" height="34">
        <span>Gesture<em>Orchestra</em></span>
    </a>
    <nav class="site-nav" aria-label="Menu utama">
        <a href="<?= e(url('index.php')) ?>">Beranda</a>
        <?php if ($loggedInRole !== null): ?>
            <a class="nav-sticker" href="<?= e(url(dashboard_path($loggedInRole))) ?>">Dashboard</a>
        <?php else: ?>
            <a class="nav-sticker" href="<?= e(url('login.php')) ?>">Masuk</a>
        <?php endif; ?>
    </nav>
</header>
<main id="main" class="site-main">
<?php foreach (take_flashes() as $flash): ?>
    <p class="alert alert-<?= e($flash['type']) ?>" role="status"><?= e($flash['message']) ?></p>
<?php endforeach; ?>
