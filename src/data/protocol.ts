/**
 * Protokol penelitian: dari gen sampai produk GOS.
 * Sumber: protokol tim GenoHack 2026, mengacu pada Sun dkk. 2014 untuk
 * ekspresi F441Y di P. pastoris dan kondisi reaksi GOS.
 *
 * `status` menandai seberapa kuat dasar tiap langkah:
 *   terbukti  — ada angka dari terbitan / sudah dijalankan di literatur
 *   rencana   — langkah standar, belum ada angka khusus untuk enzim ini
 *   terbuka   — masih perlu diputuskan atau diverifikasi tim
 */
export type ProtocolStatus = "terbukti" | "rencana" | "terbuka";

export interface ProtocolStep {
  no: number;
  title: string;
  body: string;
  status: ProtocolStatus;
  /** Angka kunci yang perlu dipantau saat langkah ini dijalankan. */
  facts?: { label: string; value: string }[];
  note?: string;
  source?: string;
}

export interface ProtocolPart {
  id: string;
  letter: "A" | "B" | "C";
  title: string;
  subtitle: string;
  steps: ProtocolStep[];
}

export const PROTOCOL: ProtocolPart[] = [
  {
    id: "enzim",
    letter: "A",
    title: "Pembuatan galur dan enzim",
    subtitle: "Dari desain gen sampai enzim siap pakai",
    steps: [
      {
        no: 1,
        title: "Desain gen",
        body: "Ambil sekuens β-galaktosidase S. solfataricus varian F441Y, lakukan optimasi kodon untuk P. pastoris, lalu pesan sintesis gennya.",
        status: "rencana",
        facts: [{ label: "Panjang gen", value: "± 1,47 kb" }],
      },
      {
        no: 2,
        title: "Konstruksi vektor",
        body: "Pakai vektor dengan promoter GAP atau PAOX1 bebas metanol.",
        status: "terbuka",
        note: "Titer untuk lacS F441Y lewat rute bebas metanol ini belum diuji.",
        source: "Bernat-Camps 2023 · Wang 2017",
      },
      {
        no: 3,
        title: "Transformasi",
        body: "Linearisasi dengan SacI, elektroporasi ke P. pastoris KM71, seleksi di YPD + G418, lalu verifikasi integrasi dengan PCR koloni. Siapkan juga kontrol vektor kosong.",
        status: "terbukti",
        facts: [
          { label: "G418", value: "100 µg/mL" },
          { label: "Suhu seleksi", value: "30 °C" },
        ],
        source: "Sun dkk. 2014",
      },
      {
        no: 4,
        title: "Skrining klon",
        body: "Kultur labu: inokulum YPD 24 jam → BMGY sampai OD₆₀₀ 5–6 → pindah ke BMMY dengan induksi metanol tiap 24 jam. Ukur aktivitas dengan assay oNPG, lalu pilih klon terbaik.",
        status: "terbukti",
        facts: [
          { label: "Induksi metanol", value: "10 µL/mL tiap 24 jam" },
          { label: "Aktivitas acuan", value: "50,3 U/mL pada jam ke-120" },
        ],
        source: "Sun dkk. 2014",
      },
      {
        no: 5,
        title: "Fermentasi fed-batch",
        body: "Bioreaktor 3 L pada 30 °C, pH 5 dijaga dengan NH₄OH, oksigen terlarut dikontrol lewat kecepatan pengadukan. Fase tumbuh di BSM dengan umpan gliserol eksponensial sampai OD₆₀₀ ± 200, lalu masuk fase induksi.",
        status: "terbukti",
        facts: [
          { label: "Puncak aktivitas", value: "204,9 U/mL" },
          { label: "Waktu panen", value: "± jam ke-80 induksi" },
        ],
        note: "Aktivitas turun setelah jam ke-90, jadi jangan lewat dari jam 80. Untuk rute bebas metanol, fase induksi diganti produksi konstitutif atau glucose-glycerol shift.",
        source: "Sun dkk. 2014",
      },
      {
        no: 6,
        title: "Panen sel dan lisis",
        body: "Sentrifugasi sel, cuci, lalu pecahkan sel dengan homogenizer tekanan tinggi.",
        status: "rencana",
      },
      {
        no: 7,
        title: "Pemanasan dan pemurnian",
        body: "Panaskan supernatan lisat 80 °C selama 10 menit supaya protein inang mengendap — enzim termofilik tetap tahan — lalu sentrifugasi. Lanjutkan dengan amonium sulfat, kromatografi DEAE, dan kromatografi hidrofobik (HIC).",
        status: "terbukti",
        facts: [
          { label: "Hasil akhir", value: "satu pita 56 kDa" },
          { label: "Aktivitas spesifik", value: "152,3 U/mg" },
        ],
        source: "Sun dkk. 2014",
      },
      {
        no: 8,
        title: "Penentuan aktivitas dan spesifikasi",
        body: "Assay oNPG pada 80 °C selama 10 menit, dihentikan dengan Na₂CO₃. Catat pH dan suhu optimum, waktu paruh, Km/kcat, serta aktivitas spesifik.",
        status: "terbukti",
        facts: [{ label: "Definisi unit", value: "1 U = 1 µmol o-nitrofenol/menit" }],
      },
      {
        no: 9,
        title: "Formulasi enzim",
        body: "Lisat terpanaskan atau enzim murni dibekukan atau dikeringkan, lalu diuji stabilitas penyimpanannya.",
        status: "terbuka",
        note: "Stabilitas penyimpanan belum diuji; hasilnya menentukan bentuk produk enzim.",
      },
    ],
  },
  {
    id: "reaksi",
    letter: "B",
    title: "Pembuatan GOS",
    subtitle: "Reaksi enzimatik — bagian yang disimulasikan dashboard ini",
    steps: [
      {
        no: 10,
        title: "Siapkan laktosa food grade",
        body: "Dari whey lokal: ultrafiltrasi untuk memisahkan protein → permeat → pemekatan → kristalisasi laktosa → pengeringan. Alternatifnya, beli laktosa edible atau permeat bersertifikat dengan COA.",
        status: "terbuka",
        note: "Pengaruh mineral dalam permeat terhadap enzim belum diketahui. Model menganggap substratnya laktosa murni.",
      },
      {
        no: 11,
        title: "Larutkan laktosa dan atur pH",
        body: "Larutkan laktosa pada suhu tinggi, karena kelarutan laktosa naik seiring suhu. Inilah alasan enzim termofilik cocok untuk proses ini. Lalu atur pH ke 6.",
        status: "terbukti",
        facts: [
          { label: "Laktosa", value: "700 g/L" },
          { label: "pH", value: "6,0" },
        ],
      },
      {
        no: 12,
        title: "Reaksi enzimatik",
        body: "Tambahkan enzim, lalu inkubasi pada 75 °C. Laktosa pekat ikut melindungi enzim dari panas.",
        status: "terbukti",
        facts: [
          { label: "Dosis enzim", value: "5–9 U/mL" },
          { label: "Lama reaksi", value: "± 44–48 jam" },
          { label: "Rendemen acuan", value: "61,0% (9 U/mL) · 60,5% (5 U/mL)" },
          { label: "Waktu paruh enzim", value: "± 61 jam di 75 °C" },
        ],
        note: "Aktivitas enzim paling tinggi di pH 5, tapi rendemen GOS terbaik di pH 6. Yang dikejar rendemen, bukan aktivitas.",
        source: "Sun dkk. 2014",
      },
      {
        no: 13,
        title: "Hentikan reaksi tepat waktu",
        body: "Hentikan di titik panen dengan pendinginan cepat atau inaktivasi panas, supaya GOS tidak terurai lagi. Rendemen naik sampai puncak, lalu turun.",
        status: "terbukti",
        note: "Waktu panen untuk tiap kondisi bisa dihitung di menu Simulasi dan Analisis CSV.",
      },
      {
        no: 14,
        title: "Analisis dengan HPLC",
        body: "Kolom APS-2 (asetonitril/air 73:27) untuk laktosa dan disakarida transgalaktosilasi. Kolom SH1011 (5 mM H₂SO₄) untuk oligosakarida, glukosa, dan galaktosa.",
        status: "terbukti",
        facts: [{ label: "Rendemen GOS", value: "TD + TOS" }],
        note: "Hasil HPLC inilah yang diisikan ke kolom observed_yield_pct saat mengunggah CSV, supaya akurasi model bisa dilacak.",
      },
    ],
  },
  {
    id: "hilir",
    letter: "C",
    title: "Dari campuran reaksi ke produk",
    subtitle: "Pemurnian, pengeringan, dan dokumentasi rilis",
    steps: [
      {
        no: 15,
        title: "Pisahkan enzim",
        body: "Inaktivasi panas atau ultrafiltrasi, lalu singkirkan debris.",
        status: "rencana",
      },
      {
        no: 16,
        title: "Murnikan",
        body: "Nanofiltrasi atau membran untuk memisahkan glukosa, galaktosa, dan sisa laktosa dari oligosakarida. Lanjutkan dengan penghilangan warna bila perlu.",
        status: "rencana",
      },
      {
        no: 17,
        title: "Pemekatan dan pengeringan",
        body: "Evaporasi, lalu spray dryer menjadi bubuk. Bisa juga dijual dalam bentuk sirup.",
        status: "rencana",
      },
      {
        no: 18,
        title: "Uji rilis dan dokumentasi",
        body: "Periksa kandungan GOS, kadar laktosa dan gula sisa, kelembapan, abu, protein sisa, logam berat, mikrobiologi, serta residu enzim dan DNA rekombinan.",
        status: "terbuka",
        note: "Spesifikasi rilis masih harus ditetapkan sesuai acuan pelanggan dan regulasi (BPOM, halal).",
      },
    ],
  },
];

export const STATUS_LABEL: Record<ProtocolStatus, string> = {
  terbukti: "Ada acuan terbitan",
  rencana: "Langkah standar",
  terbuka: "Perlu diputuskan",
};
