// Helper kecil untuk memanggil endpoint di folder api/.
// BASE_URL dari config.php dicetak PHP ke <body data-base-url="...">.

export function baseUrl() {
    return document.body.dataset.baseUrl || '';
}

// Ambil JSON. Bila server membalas error, lempar Error berisi pesan dari server.
async function request(path, options) {
    let response;
    try {
        response = await fetch(baseUrl() + '/' + path, options);
    } catch (error) {
        throw new Error('Tidak bisa menghubungi server. Periksa koneksi internet.');
    }
    let data = null;
    try {
        data = await response.json();
    } catch (error) {
        // Balasan bukan JSON (misalnya halaman error dari hosting).
    }
    if (!response.ok || data === null || data.ok !== true) {
        throw new Error((data && data.error) || 'Server membalas dengan error ' + response.status + '.');
    }
    return data;
}

export function getJson(path) {
    return request(path, { headers: { Accept: 'application/json' } });
}

export function postJson(path, body) {
    return request(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(body),
    });
}
