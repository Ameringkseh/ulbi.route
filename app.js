// Rute Kampus ULBI - hanya memakai CrootJS (tanpa Leaflet atau library peta lain).
// Versi dipin ke satu tag (0.0.16). Kalau perlu ganti versi, ubah angka itu di 6 baris import di bawah.
import { createMap, removeMap, addGeoJSON, fitMap, onMapClick, closePopup, getGeoJSON }
    from "https://cdn.jsdelivr.net/gh/crootjs/lib@0.0.16/map.min.js";
import { addMarker }
    from "https://cdn.jsdelivr.net/gh/crootjs/lib@0.0.16/mapmarker.min.js";
import { addScaleBar }
    from "https://cdn.jsdelivr.net/gh/crootjs/lib@0.0.16/mapcontrol.min.js";
import { findRoute, getDistance }
    from "https://cdn.jsdelivr.net/gh/crootjs/lib@0.0.16/georoute.min.js";
import { onClick, onChange, getValue, setInnerText }
    from "https://cdn.jsdelivr.net/gh/crootjs/lib@0.0.16/element.min.js";
import { toastWarning, toastError, toastInfo }
    from "https://cdn.jsdelivr.net/gh/crootjs/lib@0.0.16/toast.min.js";

const DATA_URL = "data/ulbi_lengkap.geojson";
const PETA_ID = "map";
const KECEPATAN_JALAN = 1.4; // m/detik, kira-kira 5 km/jam

const PETA = {
    osm: { maxZoom: 19 },
    satelit: {
        maxZoom: 19,
        tiles: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        attribution: "Tiles \u00a9 Esri, Maxar, Earthstar Geographics, dan komunitas pengguna GIS",
    },
    kosong: { maxZoom: 21, tiles: false },
};
const WARNA_PIN = { A: "#16a34a", B: "#dc2626" };
const NAMA_JENIS = { gedung: "Gedung", fasilitas: "Fasilitas", belum_diklasifikasi: "Belum diklasifikasi" };

// ---------- state ----------
const data = { semua: null, area: null, batas: null, kanopi: null, jalan: null };
const pintu = {};                    // bangunan_id -> { nama, pos }
const titik = { A: null, B: null };  // { pos: [lng, lat], id: bangunan_id | null }
const marker = { A: null, B: null };
let lapisanJalan = null;             // fungsi remove() layer jalan
let lapisanRute = [];                // fungsi remove() garis rute
let petaAktif = "osm";

// ---------- util ----------
const el = (id) => document.getElementById(id);
const fmtJarak = (m) => (m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(2)} km`);
const kumpulan = (features) => ({ type: "FeatureCollection", features });
const jenisDari = (f) => (f.properties && f.properties.jenis) || "";

function pisahkanData(fc) {
    const fs = fc.features;
    data.semua = fc;
    data.area = kumpulan(fs.filter((f) => f.geometry && /Polygon/.test(f.geometry.type)));
    data.kanopi = kumpulan(fs.filter((f) => jenisDari(f) === "jalur"));
    data.batas = kumpulan(fs.filter((f) => jenisDari(f) === "belum_diklasifikasi" && /LineString/.test(f.geometry.type)));
    data.jalan = kumpulan(fs.filter((f) => jenisDari(f) === "jalan"));
    fs.filter((f) => jenisDari(f) === "pintu").forEach((f) => {
        pintu[f.properties.bangunan_id] = { nama: f.properties.nama, pos: f.geometry.coordinates };
    });
}

// ---------- dropdown ----------
function isiDropdown() {
    const daftar = Object.entries(pintu).sort((a, b) => a[1].nama.localeCompare(b[1].nama, "id"));
    ["asal", "tujuan"].forEach((id) => {
        const sel = el(id);
        sel.textContent = "";
        const kosong = document.createElement("option");
        kosong.value = "";
        kosong.textContent = "Pilih gedung atau fasilitas...";
        sel.append(kosong);
        daftar.forEach(([bid, p]) => {
            const o = document.createElement("option");
            o.value = bid;
            o.textContent = p.nama;
            sel.append(o);
        });
        sel.disabled = false;
    });
}

function setSelect(which, id) {
    el(which === "A" ? "asal" : "tujuan").value = id || "";
}

// ---------- layer peta ----------
function popupBangunan(feature) {
    const p = feature.properties;
    if (!p.nama || !pintu[p.id]) return null;
    const kotak = document.createElement("div");
    kotak.className = "popup";
    const judul = document.createElement("strong");
    judul.textContent = p.nama;
    const info = document.createElement("span");
    info.textContent = `${NAMA_JENIS[p.jenis] || p.jenis} \u00b7 ${Math.round(p.luas_m2)} m\u00b2`;
    const aksi = document.createElement("div");
    aksi.className = "popup-aksi";
    [["Dari sini", "A"], ["Ke sini", "B"]].forEach(([teks, which]) => {
        const b = document.createElement("button");
        b.type = "button";
        b.textContent = teks;
        b.addEventListener("click", () => {
            closePopup(PETA_ID);
            pilihGedung(which, p.id, true);
        });
        aksi.append(b);
    });
    kotak.append(judul, info, aksi);
    return kotak;
}

function gambarLapisan() {
    addGeoJSON(PETA_ID, data.area, {
        style: (f) => ({
            stroke: "#ffffff",
            strokeWidth: 1,
            strokeOpacity: 0.9,
            fill: f.properties.fill || "#c9a24b",
            fillOpacity: Math.min(f.properties["fill-opacity"] || 0.6, 0.6),
        }),
        popup: popupBangunan,
    });
    addGeoJSON(PETA_ID, data.batas, { style: { stroke: "#9aa5af", strokeWidth: 2, strokeOpacity: 0.8 }, popup: false });
    addGeoJSON(PETA_ID, data.kanopi, { style: { stroke: "#3fb8af", strokeWidth: 4, strokeOpacity: 0.95 }, popup: false });
    lapisanJalan = null;
    aturLapisanJalan();
}

function aturLapisanJalan() {
    if (lapisanJalan) { lapisanJalan(); lapisanJalan = null; }
    if (el("toggleJalan").checked) {
        lapisanJalan = addGeoJSON(PETA_ID, data.jalan, {
            style: { stroke: "#e76f51", strokeWidth: 2.5, strokeOpacity: 0.8 },
            popup: false,
        });
    }
}

function bangunPeta(kunci) {
    // lepas semua yang menempel pada peta lama
    hapusGarisRute();
    ["A", "B"].forEach((w) => { if (marker[w]) { marker[w].remove(); marker[w] = null; } });
    if (lapisanJalan) { lapisanJalan = null; }
    try { removeMap(PETA_ID); } catch (e) { /* peta belum ada */ }

    const opsi = { zoom: 17, ...PETA[kunci] };
    createMap(PETA_ID, opsi);
    addScaleBar(PETA_ID);
    gambarLapisan();
    fitMap(PETA_ID, data.semua, 30);
    onMapClick(PETA_ID, klikPeta);
    petaAktif = kunci;

    ["A", "B"].forEach(pasangMarker);
    hitungRute(false);
}

// ---------- titik asal dan tujuan ----------
function pasangMarker(which) {
    const t = titik[which];
    if (!t) return;
    if (marker[which]) { marker[which].setPosition(t.pos); return; }
    marker[which] = addMarker(PETA_ID, t.pos, {
        color: WARNA_PIN[which],
        label: which,
        title: which === "A" ? "Titik berangkat" : "Titik tujuan",
        draggable: true,
        onDragEnd: (pos) => {
            titik[which] = { pos, id: null };
            setSelect(which, "");
            hitungRute(false);
        },
    });
}

function setTitik(which, pos, id, fit) {
    titik[which] = { pos, id };
    setSelect(which, id);
    pasangMarker(which);
    hitungRute(fit);
}

function pilihGedung(which, id, fit) {
    if (!pintu[id]) return;
    setTitik(which, pintu[id].pos, id, fit);
}

function klikPeta(position, feature) {
    const jenis = feature && feature.properties ? feature.properties.jenis : "";
    // klik pada gedung membuka popup; klik di tempat lain atau di jalan menaruh pin
    if (feature && jenis !== "jalan" && jenis !== "belum_diklasifikasi") return;
    if (!titik.A) setTitik("A", position, null, false);
    else if (!titik.B) setTitik("B", position, null, false);
    else toastInfo("Geser pin A atau B untuk mengubah titik, atau tekan Reset.");
}

// ---------- rute ----------
function hapusGarisRute() {
    lapisanRute.forEach((hapus) => hapus());
    lapisanRute = [];
}

function tampilkanHasil(tampil) {
    el("hasil").classList.toggle("sembunyi", !tampil);
}

function hitungRute(fit) {
    hapusGarisRute();
    if (!titik.A || !titik.B) { tampilkanHasil(false); return; }

    const rute = findRoute(titik.A.pos, titik.B.pos, data.jalan);
    if (!rute) {
        tampilkanHasil(false);
        toastWarning("Rute tidak ditemukan. Titik mungkin tidak terhubung ke jaringan jalan.");
        return;
    }

    // garis putih sebagai pinggiran, lalu garis biru di atasnya
    lapisanRute.push(addGeoJSON(PETA_ID, rute, { style: { stroke: "#ffffff", strokeWidth: 10, strokeOpacity: 0.9 }, popup: false }));
    lapisanRute.push(addGeoJSON(PETA_ID, rute, { style: { stroke: "#2f6bff", strokeWidth: 5, strokeOpacity: 1 }, popup: false }));

    const koord = rute.geometry.coordinates;
    const jalan = rute.properties.distance;
    const ekorA = getDistance(titik.A.pos, koord[0]);
    const ekorB = getDistance(titik.B.pos, koord[koord.length - 1]);
    const total = jalan + ekorA + ekorB;
    const menit = Math.max(1, Math.round(total / KECEPATAN_JALAN / 60));

    setInnerText("jarakTotal", fmtJarak(total));
    setInnerText("waktuJalan", `\u00b1 ${menit} menit jalan kaki`);
    setInnerText("jarakJalan", fmtJarak(jalan));
    setInnerText("garisLurus", fmtJarak(getDistance(titik.A.pos, titik.B.pos)));
    setInnerText(
        "catatanPin",
        ekorA > 2 || ekorB > 2
            ? `Pin berjarak ${Math.round(ekorA)} m (A) dan ${Math.round(ekorB)} m (B) dari jalan terdekat. Jarak itu sudah ikut dihitung di total.`
            : ""
    );
    tampilkanHasil(true);
    if (fit) fitMap(PETA_ID, rute, 60);
}

function reset() {
    ["A", "B"].forEach((w) => {
        titik[w] = null;
        setSelect(w, "");
        if (marker[w]) { marker[w].remove(); marker[w] = null; }
    });
    hapusGarisRute();
    tampilkanHasil(false);
    fitMap(PETA_ID, data.semua, 30);
}

function tukar() {
    const a = titik.A;
    titik.A = titik.B;
    titik.B = a;
    ["A", "B"].forEach((w) => {
        if (marker[w]) { marker[w].remove(); marker[w] = null; }
        if (titik[w]) { setSelect(w, titik[w].id); pasangMarker(w); } else { setSelect(w, ""); }
    });
    hitungRute(true);
}

// ---------- start ----------
function pasangEvent() {
    onChange("asal", () => { const id = getValue("asal"); if (id) pilihGedung("A", id, true); });
    onChange("tujuan", () => { const id = getValue("tujuan"); if (id) pilihGedung("B", id, true); });
    onClick("tukar", tukar);
    onClick("reset", reset);
    onChange("toggleJalan", aturLapisanJalan);
    onChange("peta", () => {
        try { bangunPeta(getValue("peta")); }
        catch (e) { console.error(e); toastError("Gagal mengganti peta dasar."); }
    });
}

getGeoJSON(DATA_URL, ({ status, data: fc }) => {
    if (!fc) {
        setInnerText("status", `Gagal memuat data (status ${status}).`);
        toastError("Data GeoJSON tidak bisa dimuat. Jalankan lewat server (bukan file://).");
        return;
    }
    pisahkanData(fc);
    isiDropdown();
    pasangEvent();
    bangunPeta(petaAktif);
    setInnerText(
        "status",
        `${Object.keys(pintu).length} gedung dan fasilitas, ${data.jalan.features.length} ruas jalan (${fmtJarak(data.jalan.features.reduce((s, f) => s + f.properties.panjang_m, 0))}).`
    );
});
