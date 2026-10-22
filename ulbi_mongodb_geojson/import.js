const fs = require("fs");
const { MongoClient } = require("mongodb");

const URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017";
const DB_NAME = "ulbi_geo";
const COLLECTION_NAME = "geojson_objects";

async function main() {
  const raw = JSON.parse(fs.readFileSync("./ulbi_lengkap.geojson", "utf8"));
  if (raw.type !== "FeatureCollection" || !Array.isArray(raw.features)) {
    throw new Error("File harus berupa GeoJSON FeatureCollection.");
  }

  // Satu GeoJSON Feature menjadi satu MongoDB document.
  // geometry disimpan sebagai GeoJSON agar index 2dsphere dapat digunakan.
  const docs = raw.features.map((feature, i) => {
    if (!feature.geometry || !feature.geometry.type || !feature.geometry.coordinates) {
      throw new Error(`Feature ke-${i} tidak memiliki geometry yang valid.`);
    }
    const properties = feature.properties || {};
    return {
      _id: String(properties.id || `feature-${i + 1}`),
      type: "Feature",
      geometry: feature.geometry,
      properties
    };
  });

  const client = new MongoClient(URI);
  try {
    await client.connect();
    const collection = client.db(DB_NAME).collection(COLLECTION_NAME);

    // Idempotent untuk demo: data lama diganti oleh isi file saat script dijalankan ulang.
    await collection.deleteMany({});
    if (docs.length) await collection.insertMany(docs);

    // Index spasial aktif pada field GeoJSON "geometry".
    await collection.createIndex({ geometry: "2dsphere" }, { name: "geometry_2dsphere" });

    const counts = await collection.aggregate([
      { $group: { _id: "$geometry.type", jumlah: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]).toArray();

    console.log(`Berhasil mengimpor ${docs.length} GeoJSON Feature.`);
    console.log(`Database: ${DB_NAME}; Collection: ${COLLECTION_NAME}`);
    console.log("Jumlah berdasarkan geometry:", counts);
    console.log("Index:", await collection.indexes());
  } finally {
    await client.close();
  }
}

main().catch(err => {
  console.error("Import gagal:", err.message);
  process.exitCode = 1;
});
