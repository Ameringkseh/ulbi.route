const { MongoClient } = require("mongodb");

const URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017";

async function main() {
  const client = new MongoClient(URI);
  try {
    await client.connect();
    const col = client.db("ulbi_geo").collection("geojson_objects");

    // 1) Pastikan index 2dsphere ada.
    console.log("Index:", await col.indexes());

    // 2) Geospatial query: cari objek yang berada/beririsan dengan area sekitar kampus.
    // Polygon harus berupa ring tertutup dan koordinat [longitude, latitude].
    const areaKampus = {
      type: "Polygon",
      coordinates: [[
        [107.570, -6.880],
        [107.590, -6.880],
        [107.590, -6.860],
        [107.570, -6.860],
        [107.570, -6.880]
      ]]
    };
    const dalamArea = await col.find({
      geometry: { $geoIntersects: { $geometry: areaKampus } }
    }).project({ _id: 1, "properties.nama": 1, "geometry.type": 1 }).toArray();
    console.log(`\nObjek yang beririsan dengan area: ${dalamArea.length}`);
    console.log(dalamArea.slice(0, 10));

    // 3) Contoh $near untuk mencari Point terdekat dari titik contoh.
    // $near memerlukan index 2dsphere. Koordinat urutannya [longitude, latitude].
    const titik = { type: "Point", coordinates: [107.576029, -6.873283] };
    const terdekat = await col.find({
      "geometry.type": "Point",
      geometry: {
        $near: {
          $geometry: titik,
          $maxDistance: 1000
        }
      }
    }).limit(10).project({ _id: 1, "properties.nama": 1, geometry: 1 }).toArray();
    console.log("\nPoint terdekat dalam radius 1 km:", terdekat);

    // 4) Ringkasan jumlah geometry.
    const ringkasan = await col.aggregate([
      { $group: { _id: "$geometry.type", jumlah: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]).toArray();
    console.log("\nRingkasan geometry:", ringkasan);
  } finally {
    await client.close();
  }
}

main().catch(err => {
  console.error("Query gagal:", err.message);
  process.exitCode = 1;
});
