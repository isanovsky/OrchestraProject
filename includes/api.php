<?php
// Helper untuk endpoint JSON di folder api/.
// Setiap endpoint: require bootstrap.php, lalu require file ini.

// Error yang tidak tertangkap di endpoint API dibalas JSON, bukan halaman HTML.
set_exception_handler(function (Throwable $e): void {
    error_log('[GestureOrchestra API] ' . get_class($e) . ': ' . $e->getMessage()
        . ' di ' . $e->getFile() . ':' . $e->getLine());
    json_error(APP_DEBUG ? $e->getMessage() : 'Server sedang bermasalah. Coba lagi sebentar lagi.', 500);
});

// Kirim data sebagai JSON lalu hentikan script.
function json_response(array $data, int $status = 200): never
{
    while (ob_get_level() > 0) {
        ob_end_clean();
    }
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function json_error(string $message, int $status): never
{
    json_response(['ok' => false, 'error' => $message], $status);
}

// Tolak request yang metodenya tidak sesuai (misalnya GET ke endpoint POST).
function require_method(string $method): void
{
    if ($_SERVER['REQUEST_METHOD'] !== $method) {
        header('Allow: ' . $method);
        json_error('Metode harus ' . $method . '.', 405);
    }
}

// Baca body request berformat JSON. Body rusak atau terlalu besar ditolak.
function read_json_body(int $maxBytes = 65536): array
{
    $raw = file_get_contents('php://input', false, null, 0, $maxBytes + 1);
    if ($raw === false || strlen($raw) > $maxBytes) {
        json_error('Data yang dikirim terlalu besar.', 413);
    }
    $data = json_decode($raw, true);
    if (!is_array($data)) {
        json_error('Data harus berupa JSON yang valid.', 400);
    }
    return $data;
}

// Ambil bilangan bulat dari data JSON atau query string.
// Menerima angka (5) atau teks angka ("5"); selain itu null.
function int_or_null(mixed $value): ?int
{
    if (is_int($value)) {
        return $value;
    }
    if (is_string($value) && preg_match('/^-?\d{1,9}$/', $value)) {
        return (int) $value;
    }
    return null;
}
