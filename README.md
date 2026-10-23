# GestureOrchestra

Web app orkestra mini yang dimainkan dengan gestur tangan lewat kamera, untuk
1 sampai 4 pemain, dengan tiga instrumen: piano, strings, dan drum.
Tugas ETS: website PHP native + database.

> README lengkap (pembagian peran PHP dan JavaScript, deploy InfinityFree,
> alur data) disusun di Fase 5. Bagian di bawah sudah final.

## Database

Database baru disusun dari `schema.sql`, lalu file migrasi **sesuai urutan
nomor, masing-masing satu kali**:

1. Buat database kosong (XAMPP: phpMyAdmin, InfinityFree: menu MySQL Databases).
2. Pilih database itu di phpMyAdmin, tab **Import**, lalu impor berurutan:
   1. `database/schema.sql`
   2. `database/migrations/002_revisi_musik.sql`
   3. `database/migrations/003_lagu_tambahan.sql`

Catatan:

- `schema.sql` menghapus semua tabel lalu membuat ulang. Jangan diimpor ke
  database yang datanya masih dipakai.
- File migrasi **tidak boleh dijalankan dua kali**. Migrasi 002 menambah kolom
  dan migrasi 003 menambah lagu; menjalankan ulang akan gagal atau membuat
  lagu ganda.
- Database yang sudah berjalan cukup menjalankan migrasi yang belum pernah
  dijalankan, sesuai urutan nomor.

## Uji otomatis (dari terminal, tidak butuh server)

```
php tests/scoring_and_import_test.php
node --test tests/js/*.test.mjs
```
