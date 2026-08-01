// ================= KONFIGURASI =================
const HEADERS = { "User-Agent": "PindaiGiziWeb/1.0" };
let searchMode = 'name'; // 'name' atau 'barcode'
let debounceTimer;
let html5QrcodeScanner = null;

// ================= 1. INISIALISASI & UI TOGGLE =================
document.addEventListener("DOMContentLoaded", () => {
  if (typeof lucide !== 'undefined') lucide.createIcons();
});

const tabNameBtn = document.getElementById("tab-name");
const tabBarcodeBtn = document.getElementById("tab-barcode");
const searchInput = document.getElementById("search-input");
const inputIcon = document.getElementById("input-icon");

function switchMode(mode) {
  searchMode = mode;
  searchInput.value = '';
  document.getElementById("results-container").innerHTML = '';

  if (mode === 'name') {
    tabNameBtn.className = "px-5 py-2.5 bg-white shadow-sm rounded-lg text-sm font-bold text-terracotta transition flex items-center gap-2";
    tabBarcodeBtn.className = "px-5 py-2.5 text-gray-500 hover:text-charcoal rounded-lg text-sm font-medium transition flex items-center gap-2";
    searchInput.placeholder = "Ketik nama produk, merek, atau kategori...";
    inputIcon.setAttribute("data-lucide", "search");
  } else {
    tabBarcodeBtn.className = "px-5 py-2.5 bg-white shadow-sm rounded-lg text-sm font-bold text-terracotta transition flex items-center gap-2";
    tabNameBtn.className = "px-5 py-2.5 text-gray-500 hover:text-charcoal rounded-lg text-sm font-medium transition flex items-center gap-2";
    searchInput.placeholder = "Ketik/Scan angka barcode (Misal: 8998989...)";
    inputIcon.setAttribute("data-lucide", "barcode");
  }
  lucide.createIcons();
}

tabNameBtn.addEventListener("click", () => switchMode('name'));
tabBarcodeBtn.addEventListener("click", () => switchMode('barcode'));

// ================= 2. PENCARIAN (DEBOUNCE) =================
searchInput.addEventListener("input", (e) => {
  clearTimeout(debounceTimer);
  const query = e.target.value.trim();

  if (query.length < 3) return;

  debounceTimer = setTimeout(() => {
    if (searchMode === 'name') {
      searchByName(query);
    } else {
      fetchProductDetail(query, true); 
    }
  }, 600);
});

// Ganti fungsi searchByName kamu dengan versi yang lebih stabil ini:
async function searchByName(keyword) {
  const container = document.getElementById("results-container");
  container.innerHTML = `<div class="col-span-full text-center py-10 text-gray-500"><i data-lucide="loader-2" class="w-8 h-8 animate-spin mx-auto mb-2 text-terracotta"></i>Mencari produk Indonesia...</div>`;
  if (typeof lucide !== 'undefined') lucide.createIcons();

  // OPSI A: Menggunakan Search-a-licious API (Sangat Direkomendasikan, Anti-503)
  const url = `https://search.openfoodfacts.org/search?q=${encodeURIComponent(keyword)}&countries_tags_en=indonesia&page_size=12`;

  try {
    const res = await fetch(url, { headers: HEADERS });
    
    // Jika server mengembalikan 503 atau error HTTP
    if (!res.ok) {
      throw new Error(`Server error: ${res.status}`);
    }

    const data = await res.json();
    
    // Engine baru meletakkan array produk di `data.hits`
    const products = data.hits || data.products || [];
    
    // Normalisasi struktur data (karena brands berbentuk Array di engine baru)
    const normalizedProducts = products.map(p => ({
      code: p.code,
      product_name: p.product_name,
      brands: Array.isArray(p.brands) ? p.brands.join(', ') : p.brands,
      image_front_small_url: p.image_front_small_url || p.image_front_url,
      nutriscore_grade: p.nutriscore_grade
    }));

    renderProducts(normalizedProducts);

  } catch (err) {
    console.error("Search Error:", err);
    container.innerHTML = `
      <div class="col-span-full text-center py-10 text-red-500">
        <p class="font-bold">Server Open Food Facts sedang sibuk (Error 503/Limit).</p>
        <p class="text-xs text-gray-500 mt-1">Coba gunakan pencarian via <span class="font-bold">Kode Barcode</span> atau ulangi beberapa saat lagi.</p>
      </div>
    `;
  }
}

const PLACEHOLDER_IMG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='150' height='150' viewBox='0 0 24 24' fill='none' stroke='%23d1d5db' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect width='18' height='18' x='3' y='3' rx='2' ry='2'/%3E%3Ccircle cx='9' cy='9' r='2'/%3E%3Cpath d='m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21'/%3E%3C/svg%3E";

function renderProducts(products) {
  const container = document.getElementById("results-container");
  container.innerHTML = "";

  if (!products || products.length === 0) {
    container.innerHTML = `<p class="col-span-full text-center text-gray-500 py-8">Produk tidak ditemukan.</p>`;
    return;
  }

  products.forEach(p => {
    // 1. Proteksi Gambar (Fallback URL)
    const imgUrl = p.image_front_small_url || p.image_front_url || PLACEHOLDER_IMG;
    
    // 2. Proteksi Teks Nama & Merek
    const productName = (p.product_name && p.product_name.trim() !== "") 
      ? p.product_name 
      : 'Nama Produk Tidak Tersedia';
      
    const brandName = (p.brands && p.brands.trim() !== "") 
      ? p.brands 
      : 'Merek Tidak Terdaftar';

    // 3. Proteksi Nutri-Score
    let nutriScore = '?';
    if (p.nutriscore_grade && p.nutriscore_grade !== 'unknown') {
      nutriScore = p.nutriscore_grade.toUpperCase();
    }
    
    let badgeColor = 'bg-gray-200 text-gray-700';
    if (['A', 'B'].includes(nutriScore)) badgeColor = 'bg-green-100 text-green-700 border-green-200';
    else if (nutriScore === 'C') badgeColor = 'bg-yellow-100 text-yellow-700 border-yellow-200';
    else if (['D', 'E'].includes(nutriScore)) badgeColor = 'bg-red-100 text-red-700 border-red-200';

    const card = document.createElement("div");
    card.className = "bg-white p-4 rounded-2xl shadow-sm hover:shadow-md transition cursor-pointer border border-gray-100 flex flex-col items-center text-center group";
    
    card.onclick = () => fetchProductDetail(p.code, false); 
    
    card.innerHTML = `
      <div class="h-32 w-full mb-4 flex items-center justify-center overflow-hidden bg-gray-50 rounded-xl p-2">
        <img 
          src="${imgUrl}" 
          alt="${productName}" 
          onerror="this.onerror=null; this.src='${PLACEHOLDER_IMG}';" 
          class="max-h-full max-w-full object-contain group-hover:scale-105 transition duration-300"
        >
      </div>
      <h4 class="font-bold text-sm text-charcoal line-clamp-2">${productName}</h4>
      <p class="text-xs text-gray-400 mt-1 mb-3 line-clamp-1">${brandName}</p>
      <div class="mt-auto inline-flex items-center gap-1 border ${badgeColor} px-2.5 py-1 rounded-lg text-xs font-bold">
        Nutri-Score: ${nutriScore}
      </div>
    `;
    container.appendChild(card);
  });
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

// ================= 3. FETCH DETAIL API v3 & MODAL =================
const detailModal = document.getElementById("detail-modal");
const detailContent = document.getElementById("detail-content");

document.getElementById("close-detail").addEventListener("click", () => {
  detailModal.classList.add("hidden");
});

async function fetchProductDetail(barcode, renderAsCardList = false) {
  // Cegah pemanggilan jika barcode kosong/undefined
  if (!barcode) return; 

  detailModal.classList.remove("hidden");
  detailContent.innerHTML = `<div class="text-center py-12"><i data-lucide="loader-2" class="w-10 h-10 animate-spin mx-auto text-terracotta mb-3"></i><p>Mengambil detail gizi...</p></div>`;
  lucide.createIcons();

  const url = `https://world.openfoodfacts.org/api/v3/product/${barcode}.json?lc=id&cc=id&fields=product_name,brands,image_front_url,nutriscore_grade,nutriments`;

  try {
    const res = await fetch(url, { headers: HEADERS });
    const data = await res.json();

    // PERBAIKAN UTAMA: Cek status success dari API v3
    if (data.status === "success" && data.product) {
      
      // INJEKSI CODE: Karena di API v3 nilai 'code' ada di luar objek 'product'
      data.product.code = data.code || barcode; 

      if(renderAsCardList) {
         detailModal.classList.add("hidden"); 
         renderProducts([data.product]); 
      } else {
         renderDetailModal(data.product); 
      }
    } else {
      detailContent.innerHTML = `<div class="text-center text-red-500 py-10"><i data-lucide="alert-circle" class="w-12 h-12 mx-auto mb-2"></i>Produk tidak ditemukan di database.</div>`;
      lucide.createIcons();
    }
  } catch (err) {
    detailContent.innerHTML = `<div class="text-center text-red-500 py-10">Gagal memuat data dari server.</div>`;
  }
}

// PERBAIKAN: Fungsi helper pembulatan desimal
const formatNum = (num) => {
  if (num === undefined || num === null || isNaN(num)) return 0;
  // Bulatkan 1 angka di belakang koma, hapus .0 jika bilangan bulat
  return Number(num).toFixed(1).replace(/\.0$/, ''); 
};

function renderDetailModal(p) {
  const imgUrl = p.image_front_url || p.image_front_small_url || PLACEHOLDER_IMG;
  const productName = (p.product_name && p.product_name.trim() !== "") ? p.product_name : 'Nama Produk Tidak Tersedia';
  const brandName = (p.brands && p.brands.trim() !== "") ? p.brands : 'Merek Tidak Terdaftar';
  
  const n = p.nutriments || {};
  const energi = formatNum(n['energy-kcal_100g'] || n['energy-kcal_value'] || 0);
  const gula = formatNum(n.sugars_100g || n.sugars_value);
  const lemak = formatNum(n.fat_100g || n.fat_value);
  const garam = formatNum(n.salt_100g || n.salt_value);
  
  detailContent.innerHTML = `
    <div class="flex flex-col items-center text-center">
      <div class="h-48 w-full flex items-center justify-center bg-gray-50 rounded-xl mb-4 p-2">
        <img 
          src="${imgUrl}" 
          alt="${productName}" 
          onerror="this.onerror=null; this.src='${PLACEHOLDER_IMG}';" 
          class="max-h-full object-contain"
        >
      </div>
      <h2 class="text-2xl font-bold text-charcoal mb-1">${productName}</h2>
      <p class="text-gray-500 font-medium mb-6"><i data-lucide="tag" class="w-4 h-4 inline mr-1"></i>${brandName}</p>
      
      <div class="w-full bg-[#F5EFEB] rounded-2xl p-5 text-left shadow-inner">
        <h3 class="font-bold text-terracotta flex items-center gap-2 mb-4 border-b border-gray-300 pb-2">
          <i data-lucide="activity" class="w-5 h-5"></i> Informasi Nilai Gizi (per 100g)
        </h3>
        <div class="grid grid-cols-2 gap-4 text-sm">
          <div class="bg-white p-3 rounded-xl shadow-sm border border-gray-100">
            <span class="text-gray-500 block text-xs">Energi (Kalori)</span>
            <span class="font-bold text-charcoal text-lg">${energi} kcal</span>
          </div>
          <div class="bg-white p-3 rounded-xl shadow-sm border border-gray-100">
            <span class="text-gray-500 block text-xs">Gula</span>
            <span class="font-bold text-charcoal text-lg">${gula} g</span>
          </div>
          <div class="bg-white p-3 rounded-xl shadow-sm border border-gray-100">
            <span class="text-gray-500 block text-xs">Lemak</span>
            <span class="font-bold text-charcoal text-lg">${lemak} g</span>
          </div>
          <div class="bg-white p-3 rounded-xl shadow-sm border border-gray-100">
            <span class="text-gray-500 block text-xs">Garam (Sodium)</span>
            <span class="font-bold text-charcoal text-lg">${garam} g</span>
          </div>
        </div>
      </div>
    </div>
  `;
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

// ================= 4. SCANNER KAMERA =================
const scannerModal = document.getElementById("scanner-modal");
const openScannerBtn = document.getElementById("btn-open-scanner");
const closeScannerBtn = document.getElementById("btn-close-scanner");

openScannerBtn.addEventListener("click", () => {
  scannerModal.classList.remove("hidden");
  html5QrcodeScanner = new Html5Qrcode("reader");
  html5QrcodeScanner.start(
    { facingMode: "environment" },
    { fps: 10, qrbox: { width: 250, height: 250 } },
    (decodedText) => {
      html5QrcodeScanner.stop().then(() => {
        scannerModal.classList.add("hidden");
        switchMode('barcode'); 
        searchInput.value = decodedText;
        fetchProductDetail(decodedText, true); 
      });
    }
  ).catch(err => console.error(err));
});

closeScannerBtn.addEventListener("click", () => {
  if (html5QrcodeScanner) {
    html5QrcodeScanner.stop().then(() => scannerModal.classList.add("hidden"));
  } else {
    scannerModal.classList.add("hidden");
  }
});