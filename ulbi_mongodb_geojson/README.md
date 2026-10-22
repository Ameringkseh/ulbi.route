# ULBI GeoJSON → MongoDB

Paket ini mengimpor setiap GeoJSON Feature sebagai satu MongoDB document, membuat index `2dsphere`, dan menjalankan contoh geospatial query.

## Isi data sumber
File `ulbi_lengkap.geojson` berisi 134 Feature:
- `Polygon`: 26
- `MultiPolygon`: 3
- `LineString`: 83
- `MultiLineString`: 1
- `Point`: 21

Jadi data sumber sudah memenuhi minimal 20 polygon (termasuk MultiPolygon), 20 polyline (termasuk MultiLineString), dan 20 point. Setiap Feature disimpan sebagai satu document.

## Prasyarat
1. Node.js terpasang.
2. MongoDB Server berjalan (bukan hanya Compass).
3. MongoDB Compass terpasang untuk melihat hasil.

## Cara menjalankan di Windows
1. Ekstrak ZIP ini ke sebuah folder.
2. Buka folder tersebut di VS Code.
3. Buka terminal pada folder yang sama.
4. Jalankan `npm install`.
5. Pastikan MongoDB lokal berjalan dan Compass bisa connect ke `mongodb://127.0.0.1:27017`.
6. Jalankan `npm run import`.
7. Jalankan `npm run query`.

Jika menggunakan MongoDB Atlas, atur environment variable `MONGODB_URI` ke connection string Atlas terlebih dahulu. Jangan bagikan connection string yang berisi password.

## Melihat di Compass
- Connect ke `mongodb://127.0.0.1:27017`
- Buka database `ulbi_geo`
- Buka collection `geojson_objects`
- Tab **Documents**: setiap Feature menjadi satu document
- Tab **Indexes**: pastikan ada `geometry_2dsphere` dengan key `geometry: 2dsphere`

## Struktur document
Setiap document memiliki `_id`, `type: "Feature"`, `geometry`, dan `properties`. Index spasial dibuat pada `geometry`.

## Geospatial query
`queries.js` menjalankan:
- `$geoIntersects` untuk mencari objek yang beririsan dengan polygon area kampus.
- `$near` untuk mencari Point terdekat dalam radius 1.000 meter.
- Agregasi jumlah geometry.

Koordinat GeoJSON menggunakan urutan `[longitude, latitude]`. Script import menghapus isi collection target sebelum memasukkan data dari file agar eksekusi ulang tidak menggandakan data. Pastikan collection `ulbi_geo.geojson_objects` memang boleh diganti isinya.
