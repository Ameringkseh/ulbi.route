# Rute Kampus ULBI

Website rute jalan kaki terpendek antar gedung di kampus ULBI. Dibuat hanya dengan **CrootJS**
(`map.js`, `mapmarker.js`, `mapcontrol.js`, `georoute.js`, `element.js`, `toast.js`), tanpa Leaflet
atau library peta lain. Rute dihitung langsung di browser dari data GeoJSON.

## Struktur

```
index.html              halaman (tanpa inline style/script)
style.css               tampilan
app.js                  logika peta dan rute (ES module)
data/ulbi_lengkap.geojson   gedung, kanopi, jaringan jalan, dan pintu gedung
```

## Deploy ke GitHub Pages

1. Buat repo baru di GitHub, misalnya `ulbi-rute`.
2. Upload semua isi folder ini ke root repo.
3. Buka **Settings > Pages**, pilih **Deploy from a branch**, branch `main`, folder `/ (root)`.
4. Tunggu satu sampai dua menit, lalu buka `https://<username>.github.io/ulbi-rute/`.

## Coba di komputer sendiri

Data dimuat lewat `fetch`, jadi jangan buka `index.html` dengan klik dua kali (`file://`). Jalankan server lokal:

```
python -m http.server 8000
```

lalu buka http://localhost:8000.

## Cara kerja rute

`findRoute(asal, tujuan, geojson)` dari `georoute.js` memakai algoritma Dijkstra pada ruas-ruas
`LineString` di data. Ruas hanya dianggap tersambung kalau berbagi koordinat yang sama. Titik asal dan tujuan
yang tidak tepat di jalan akan dipindah ke titik terdekat pada jalan.

## Data jalan: status estimasi

Jaringan jalan (`jenis: "jalan"`) **belum hasil survei**. Jalan dibuat otomatis dari ruang kosong di antara gedung
(medial axis), lalu tiap gedung bernama disambungkan ke jalan lewat ruas `tipe: "akses"` dan titik `jenis: "pintu"`.
Sebelum dipakai sebagai acuan, bandingkan dengan citra satelit (pilih "Citra satelit" di panel) dan koreksi.

Cara mengoreksi:

1. Buka `data/ulbi_lengkap.geojson` di https://geojson.io.
2. Geser, hapus, atau gambar ulang garis `jenis: "jalan"`.
3. Pastikan pertemuan dua jalan memakai **koordinat yang sama persis** di ujung garis. Kalau tidak, rute tidak menyambung.
4. Simpan, lalu ganti file di repo.

Gedung bernama dikenali lewat properti `nama`. Ada 9 fitur yang belum bernama (`perlu_verifikasi: true`).
Isi `nama`-nya supaya muncul di daftar gedung (dan tambahkan titik `pintu` untuk fitur tersebut).

## Versi CrootJS

Semua import dipin ke tag `0.0.16` dan memakai varian `.min.js` dari jsDelivr. Kalau salah satu modul gagal dimuat,
cek tag terbaru di https://github.com/crootjs/lib/tags dan ganti angka versi pada 6 baris import di `app.js`.

## Atribusi

- Peta dasar OpenStreetMap: © kontributor OpenStreetMap.
- Citra satelit: Esri, Maxar, Earthstar Geographics, dan komunitas pengguna GIS.
