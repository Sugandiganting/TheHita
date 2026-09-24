# Pemetaan COA GuestPro ke The Hita Finance

Tabel ini memetakan setiap akun pada dua berkas COA GuestPro ke nomor akun baru.
Dipakai saat memindahkan saldo awal dan histori transaksi.

- Baris akun pada berkas GuestPro: **376**
- Akun pada sistem baru: **181** bisa diposting + 51 akun induk
- Akun tidak terpetakan: **0**

## Kenapa jumlahnya menyusut

Di GuestPro, cabang dipisahkan dengan menggandakan nomor akun — `Biaya Listrik - TH`,
`Biaya Listrik - SRK`, dan `Biaya Listrik` pada PMS satunya adalah tiga nomor untuk satu
jenis biaya yang sama. Di sistem ini penggandaan itu tidak diperlukan: setiap baris jurnal
membawa penanda unit usaha, sehingga satu akun `6120.01 Biaya Listrik` melayani seluruh cabang
dan laporannya tetap bisa dipisah maupun dikonsolidasi.

## Akun baru yang tidak berasal dari GuestPro

| Kode | Nama | Alasan |
|---|---|---|
| `1190.01` | Piutang Antar Unit | Dibuat otomatis saat satu cabang menalangi cabang lain. |
| `2190.01` | Hutang Antar Unit | Pasangan dari 1190.01. |
| `1131.11` | Piutang - Trip.com | GuestPro punya akun Komisi Trip.com tetapi tidak punya piutangnya. |
| `6191.01` | Biaya Penyusutan FF&E | GuestPro punya Akumulasi Penyusutan (aset) tetapi tidak punya akun bebannya. |

## Tabel lengkap

| Kode baru | Nama baru | Kode GuestPro | Nama di GuestPro | Berkas asal |
|---|---|---|---|---|
| `DIHAPUS` | _(tidak dipakai lagi)_ | `114.06` | Persediaan Perlengkapan Toilet - Tidak dipakai | TH Uluwatu + IGYT |
| ⤷ |  | `611.07` | Biaya Perlengkapan Toilet - Tidak dipakai | TH Uluwatu + IGYT |
| ⤷ |  | `613.04` | Biaya Gaji Management - Tidak dipakai | TH Uluwatu + IGYT |
| ⤷ |  | `1140.06-10` | Persediaan Perlengkapan Toilet TH - Tidak dipakai | TH Legian, Sri Krisna + Play Laundry |
| ⤷ |  | `1140.06-30` | Persediaan Perlengkapan Toilet SRK - Tidak dipakai | TH Legian, Sri Krisna + Play Laundry |
| ⤷ |  | `6130.02` | Biaya Gaji Management - Tidak Dipakai | TH Legian, Sri Krisna + Play Laundry |
| ⤷ |  | `6150.05-10` | Biaya Perlengkapan Toilet TH - Tidak dipakai | TH Legian, Sri Krisna + Play Laundry |
| ⤷ |  | `6150.05-30` | Biaya Perlengkapan Toilet SRK - Tidak dipakai | TH Legian, Sri Krisna + Play Laundry |
| ⤷ |  | `6120.05-30` | Biaya Pemeliharaan & Perbaikan SRK - Tidak dipakai | TH Legian, Sri Krisna + Play Laundry |
| `1110.01` | Kas Pemasukan | `111.01` | TH - Kas Pemasukan | TH Uluwatu + IGYT |
| ⤷ |  | `111.05` | IGYT - Kas Pemasukan | TH Uluwatu + IGYT |
| ⤷ |  | `1110.01` | SK - Kas Pemasukan | TH Legian, Sri Krisna + Play Laundry |
| ⤷ |  | `1110.06` | Laundry - Kas Pemasukan | TH Legian, Sri Krisna + Play Laundry |
| ⤷ |  | `1110.07` | TH - Kas Pemasukan | TH Legian, Sri Krisna + Play Laundry |
| `1110.02` | Petty Cash FO | `111.02` | Petty Cash FO | TH Uluwatu + IGYT |
| ⤷ |  | `1110.02` | Petty Cash FO | TH Legian, Sri Krisna + Play Laundry |
| `1110.03` | Petty Cash Purchasing | `115.01` | Petty Cash Purchasing | TH Uluwatu + IGYT |
| ⤷ |  | `1110.03` | Petty Cash Purchasing | TH Legian, Sri Krisna + Play Laundry |
| `1110.04` | Petty Cash HR | `115.02` | Petty Cash HR | TH Uluwatu + IGYT |
| ⤷ |  | `1110.04` | Petty Cash HR | TH Legian, Sri Krisna + Play Laundry |
| `1110.05` | Petty Cash Laundry | `1110.05` | Petty Cash Laundry | TH Legian, Sri Krisna + Play Laundry |
| `1110.06` | Shopee Pay | `111.03` | Shopee Pay | TH Uluwatu + IGYT |
| `1110.07` | Grab Pay | `111.04` | Grab Pay | TH Uluwatu + IGYT |
| `1120.01` | Bank Mandiri/BCA | `112.01` | Bank | TH Uluwatu + IGYT |
| ⤷ |  | `1120.01` | Bank Mandiri/BCA | TH Legian, Sri Krisna + Play Laundry |
| `1120.02` | Bank BCA - Proyek | `112.02` | Bank BCA - Proyek | TH Uluwatu + IGYT |
| `1120.03` | Bank BRI | `112.04` | TH - Bank BRI | TH Uluwatu + IGYT |
| ⤷ |  | `112.05` | IGYT - Bank BRI | TH Uluwatu + IGYT |
| ⤷ |  | `1120.03` | TH - Bank BRI | TH Legian, Sri Krisna + Play Laundry |
| ⤷ |  | `1120.04` | Laundry - Bank BRI | TH Legian, Sri Krisna + Play Laundry |
| `1120.04` | Kas Property | `112.03` | Kas Property | TH Uluwatu + IGYT |
| ⤷ |  | `1120.02` | Kas Property | TH Legian, Sri Krisna + Play Laundry |
| `1130.01` | Piutang EDC | `113.12` | Piutang EDC | TH Uluwatu + IGYT |
| ⤷ |  | `1130.01-10` | Piutang EDC - TH Seminyak | TH Legian, Sri Krisna + Play Laundry |
| ⤷ |  | `1130.02-30` | Piutang EDC - SRK | TH Legian, Sri Krisna + Play Laundry |
| `1130.02` | Piutang QRIS | `113.13` | Piutang QRIS | TH Uluwatu + IGYT |
| ⤷ |  | `1130.02-10` | QRIS - TH Seminyak | TH Legian, Sri Krisna + Play Laundry |
| ⤷ |  | `1130.01-30` | QRIS - SRK | TH Legian, Sri Krisna + Play Laundry |
| `1130.03` | City Ledger | `113.1` | City Ledger | TH Uluwatu + IGYT |
| ⤷ |  | `90-1197` | City Ledger | TH Legian, Sri Krisna + Play Laundry |
| `1130.04` | Guest Ledger | `113.11` | Guest Ledger | TH Uluwatu + IGYT |
| ⤷ |  | `90-1198` | Guest Ledger | TH Legian, Sri Krisna + Play Laundry |
| `1131.01` | Piutang - Booking.com | `113.01` | Piutang - Booking.com | TH Uluwatu + IGYT |
| ⤷ |  | `1131.03` | Piutang - Booking.com | TH Legian, Sri Krisna + Play Laundry |
| `1131.02` | Piutang - Agoda Home | `113.02` | Piutang - Agoda Home | TH Uluwatu + IGYT |
| ⤷ |  | `90-1122` | Piutang - Agoda Home | TH Legian, Sri Krisna + Play Laundry |
| `1131.03` | Piutang - Agoda YCS | `113.03` | Piutang - Agoda YCS | TH Uluwatu + IGYT |
| ⤷ |  | `90-1123` | Piutang - Agoda YCS | TH Legian, Sri Krisna + Play Laundry |
| `1131.04` | Piutang - Airbnb | `113.04` | Piutang - Airbnb | TH Uluwatu + IGYT |
| ⤷ |  | `90-1124` | Piutang - Airbnb | TH Legian, Sri Krisna + Play Laundry |
| `1131.05` | Piutang - Expedia | `113.05` | Piutang - Expedia | TH Uluwatu + IGYT |
| ⤷ |  | `90-1125` | Piutang - Expedia | TH Legian, Sri Krisna + Play Laundry |
| `1131.06` | Piutang - Tiket.com | `113.06` | Piutang - Tiket.com | TH Uluwatu + IGYT |
| ⤷ |  | `90-1126` | Piutang - Tiket.com | TH Legian, Sri Krisna + Play Laundry |
| `1131.07` | Piutang - Traveloka | `113.07` | Piutang - Traveloka | TH Uluwatu + IGYT |
| ⤷ |  | `90-1127` | Piutang - Traveloka | TH Legian, Sri Krisna + Play Laundry |
| `1131.08` | Piutang - BE | `113.08` | Piutang - BE | TH Uluwatu + IGYT |
| ⤷ |  | `90-1128` | Piutang - BE | TH Legian, Sri Krisna + Play Laundry |
| `1131.09` | Piutang - Hostel World | `113.14` | Piutang - Hostel World | TH Uluwatu + IGYT |
| ⤷ |  | `90-1199` | Piutang - Hostel World | TH Legian, Sri Krisna + Play Laundry |
| `1131.10` | Piutang - Klook | `113.15` | Piutang - Klook | TH Uluwatu + IGYT |
| ⤷ |  | `1131.04` | Piutang - Klook | TH Legian, Sri Krisna + Play Laundry |
| `1131.12` | Piutang - Travel Agent (Korporat/Offline) | `113.09` | Piutang - Travel Agent (Korporat/Offline) | TH Uluwatu + IGYT |
| ⤷ |  | `1132.11` | Piutang - Travel Agent (Korporat/Offline) | TH Legian, Sri Krisna + Play Laundry |
| `1140.01` | Persediaan Peralatan Kitchen | `114.01` | Persediaan Peralatan dan Perlengkapan Kitchen IGYT | TH Uluwatu + IGYT |
| ⤷ |  | `114.14` | Persediaan Peralatan Kitchen Room | TH Uluwatu + IGYT |
| ⤷ |  | `1140.01-10` | Persediaan Peralatan Kitchen - TH | TH Legian, Sri Krisna + Play Laundry |
| ⤷ |  | `1140.01-30` | Persediaan Peralatan Kitchen - SRK | TH Legian, Sri Krisna + Play Laundry |
| `1140.02` | Persediaan Perlengkapan dan Peralatan Amenities | `114.02` | Persediaan Perlengkapan dan Peralatan Amenities | TH Uluwatu + IGYT |
| ⤷ |  | `1140.02-10` | Persediaan Perlengkapan dan Peralatan Amenities - TH | TH Legian, Sri Krisna + Play Laundry |
| ⤷ |  | `1140.02-30` | Persediaan Perlengkapan dan Peralatan Amenities - SRK | TH Legian, Sri Krisna + Play Laundry |
| `1140.03` | Persediaan Chemical HK | `114.03` | Persediaan Chemical HK | TH Uluwatu + IGYT |
| ⤷ |  | `1140.03-10` | Persediaan Chemicall - TH | TH Legian, Sri Krisna + Play Laundry |
| ⤷ |  | `1140.03-30` | Persediaan Chemicall - SRK | TH Legian, Sri Krisna + Play Laundry |
| `1140.04` | Persediaan Perlengkapan Room | `114.05` | Persediaan Perlengkapan Room | TH Uluwatu + IGYT |
| ⤷ |  | `1140.05-10` | Persediaan Perlengkapan Room - TH | TH Legian, Sri Krisna + Play Laundry |
| ⤷ |  | `1140.05-30` | Persediaan Perlengkapan Room - SRK | TH Legian, Sri Krisna + Play Laundry |
| `1140.05` | Persediaan Room Supplies | `114.11` | Persediaan Room Supplies | TH Uluwatu + IGYT |
| ⤷ |  | `1140.07-10` | Persediaan Room Supplies - TH | TH Legian, Sri Krisna + Play Laundry |
| ⤷ |  | `1140.07-30` | Persediaan Room Supplies - SRK | TH Legian, Sri Krisna + Play Laundry |
| `1140.06` | Persediaan Alat dan Bahan Engineering | `114.21` | Persediaan Alat dan Bahan Engineering | TH Uluwatu + IGYT |
| ⤷ |  | `1140.08` | Persediaan Alat dan Bahan Engineering | TH Legian, Sri Krisna + Play Laundry |
| `1140.07` | Persediaan Peralatan dan Perlengkapan HK | `114.22` | Persediaan Peralatan dan Perlengkapan HK | TH Uluwatu + IGYT |
| ⤷ |  | `1140.09` | Persediaan Peralatan dan Perlengkapan HK | TH Legian, Sri Krisna + Play Laundry |
| `1140.08` | Persediaan Peralatan dan Perlengkapan Kantor | `114.23` | Persediaan Peralatan dan Perlengkapan Kantor | TH Uluwatu + IGYT |
| ⤷ |  | `1140.1` | Persediaan Peralatan dan Perlengkapan Kantor | TH Legian, Sri Krisna + Play Laundry |
| `1140.09` | Persediaan Peralatan dan Perlengkapan FO | `114.24` | Persediaan Peralatan dan Perlengkapan FO | TH Uluwatu + IGYT |
| ⤷ |  | `1140.11-10` | Persediaan Peralatan dan Perlengkapan FO - TH | TH Legian, Sri Krisna + Play Laundry |
| `1140.10` | Persediaan Peralatan dan Perlengkapan Resto | `114.18` | Persediaan Peralatan dan Perlengkapan Resto IGYT | TH Uluwatu + IGYT |
| `1140.11` | Persediaan Packaging | `114.17` | Persediaan Packaging | TH Uluwatu + IGYT |
| `1141.01` | Persediaan Linen | `116.01` | Persediaan Linen | TH Uluwatu + IGYT |
| ⤷ |  | `1141.01-10` | Persediaan Linen - TH | TH Legian, Sri Krisna + Play Laundry |
| ⤷ |  | `1141.01-30` | Persediaan Linen - SRK | TH Legian, Sri Krisna + Play Laundry |
| `1142.01` | Persediaan Bahan Makanan | `114.09` | Persediaan Bahan Makanan | TH Uluwatu + IGYT |
| `1142.02` | Persediaan Bahan Minuman | `114.1` | Persediaan Bahan Minuman | TH Uluwatu + IGYT |
| `1142.03` | Persediaan Minuman (F&B) | `114.04` | Persediaan - Minuman (F&B) | TH Uluwatu + IGYT |
| ⤷ |  | `1140.04-30` | Persediaan - Minuman (F&B) | TH Legian, Sri Krisna + Play Laundry |
| `1142.04` | Persediaan Minuman Alkohol | `114.19` | Persediaan Minuman Alkohol | TH Uluwatu + IGYT |
| `1142.05` | Persediaan Pastry dan Kue | `114.2` | Persediaan Pastry dan Kue | TH Uluwatu + IGYT |
| `1142.06` | Persediaan Shared F&B Inventory | `114.12` | Persediaan Shared F&B Inventory | TH Uluwatu + IGYT |
| `1143.01` | Persediaan Tabung Gas | `114.07` | Persediaan Tabung Gas HK | TH Uluwatu + IGYT |
| ⤷ |  | `114.15` | Persediaan Tabung Gas Kitchen | TH Uluwatu + IGYT |
| ⤷ |  | `1142.02-10` | Persediaan Tabung Gas | TH Legian, Sri Krisna + Play Laundry |
| `1143.02` | Persediaan Galon | `114.08` | Persediaan Galon HK | TH Uluwatu + IGYT |
| ⤷ |  | `114.16` | Persediaan Galon Kitchen | TH Uluwatu + IGYT |
| ⤷ |  | `1142.01-10` | Persediaan Galon | TH Legian, Sri Krisna + Play Laundry |
| `1143.03` | Persediaan Chemical Laundry | `114.13` | Persediaan Chemical Laundry | TH Uluwatu + IGYT |
| ⤷ |  | `1143.01` | Persediaan Chemicall Laundry Customer | TH Legian, Sri Krisna + Play Laundry |
| ⤷ |  | `1143.01-10` | Persediaan Chemicall Laundry - TH | TH Legian, Sri Krisna + Play Laundry |
| ⤷ |  | `1143.01-30` | Persediaan Chemicall Laundry - SRK | TH Legian, Sri Krisna + Play Laundry |
| `1143.04` | Persediaan Plastik Laundry | `1143.02` | Persediaan Plastik Laundry | TH Legian, Sri Krisna + Play Laundry |
| `1143.05` | Persediaan Perlengkapan dan Peralatan Laundry | `1143.04` | Persediaan Perlengkapan dan Peralatan Laundry | TH Legian, Sri Krisna + Play Laundry |
| `1210.01` | Gedung & Bangunan | `121.01` | Gedung & Bangunan | TH Uluwatu + IGYT |
| ⤷ |  | `1210.01` | Gedung & Bangunan | TH Legian, Sri Krisna + Play Laundry |
| `1210.02` | Perabotan & Perlengkapan (FF&E) | `121.02` | Perabotan & Perlengkapan (FF&E) | TH Uluwatu + IGYT |
| ⤷ |  | `1210.02` | Perabotan & Perlengkapan (FF&E) | TH Legian, Sri Krisna + Play Laundry |
| `1210.03` | Akumulasi Penyusutan FF&E | `121.03` | Akumulasi Penyusutan FF&E | TH Uluwatu + IGYT |
| ⤷ |  | `1210.03` | Akumulasi Penyusutan FF&E | TH Legian, Sri Krisna + Play Laundry |
| `1220.01` | Aset Dalam Pengerjaan | `121.04` | Aset Dalam Pengerjaan | TH Uluwatu + IGYT |
| ⤷ |  | `1220.01` | Aset Dalam Pengerjaan - Bangunan Laundry | TH Legian, Sri Krisna + Play Laundry |
| `2101.01` | Account Payable | `211.05` | Account Payable | TH Uluwatu + IGYT |
| ⤷ |  | `2101.01` | Account Payable | TH Legian, Sri Krisna + Play Laundry |
| `2101.02` | Uang Muka Tamu | `211.03` | Uang Muka Tamu | TH Uluwatu + IGYT |
| ⤷ |  | `2101.02` | Uang Muka Tamu | TH Legian, Sri Krisna + Play Laundry |
| `2101.03` | Utang Bank | `211.01` | Utang Bank | TH Uluwatu + IGYT |
| ⤷ |  | `2101.03` | Utang Bank | TH Legian, Sri Krisna + Play Laundry |
| `2101.04` | Utang Usaha | `211.07` | Utang Usaha | TH Uluwatu + IGYT |
| ⤷ |  | `2101.04` | Utang Usaha | TH Legian, Sri Krisna + Play Laundry |
| `2101.05` | Utang Pajak | `211.04` | Utang Pajak | TH Uluwatu + IGYT |
| ⤷ |  | `2101.05` | Utang Pajak | TH Legian, Sri Krisna + Play Laundry |
| `2101.06` | AP Commission | `211.06` | AP Commission | TH Uluwatu + IGYT |
| ⤷ |  | `2101.06` | AP Commission | TH Legian, Sri Krisna + Play Laundry |
| `2101.07` | Utang Owner | `211.02` | Utang Owner | TH Uluwatu + IGYT |
| `2102.01` | Hotel Tax / PHR | `212.01` | Hotel Tax / PHR | TH Uluwatu + IGYT |
| ⤷ |  | `2.1.02.01` | Hotel Tax / PHR | TH Legian, Sri Krisna + Play Laundry |
| `2102.02` | Cafe Tax | `212.02` | Cafe Tax | TH Uluwatu + IGYT |
| `2103.01` | Service Charge | `213.01` | Service Cafe | TH Uluwatu + IGYT |
| ⤷ |  | `2.1.03.01` | Service Charge | TH Legian, Sri Krisna + Play Laundry |
| `3101.01` | Modal Pemilik | `311.01` | Modal Pemilik | TH Uluwatu + IGYT |
| ⤷ |  | `3101.01` | Modal Pemilik | TH Legian, Sri Krisna + Play Laundry |
| `3101.02` | Opening Balance Equity | `311.06` | Opening Balance Equity | TH Uluwatu + IGYT |
| ⤷ |  | `3101.02` | Opening Balance Equity | TH Legian, Sri Krisna + Play Laundry |
| `3101.03` | Prive | `311.04` | Prive | TH Uluwatu + IGYT |
| ⤷ |  | `3101.03` | Prive | TH Legian, Sri Krisna + Play Laundry |
| `3101.04` | Laba Ditahan | `311.02` | Laba Ditahan | TH Uluwatu + IGYT |
| ⤷ |  | `3101.04` | Laba Ditahan | TH Legian, Sri Krisna + Play Laundry |
| `3101.05` | Profit this month | `311.05` | Profit this month | TH Uluwatu + IGYT |
| ⤷ |  | `3101.05` | Profit this month | TH Legian, Sri Krisna + Play Laundry |
| `3101.06` | Laba Tahun Berjalan | `311.03` | Laba Tahun Berjalan | TH Uluwatu + IGYT |
| ⤷ |  | `3101.06` | Laba Tahun Berjalan | TH Legian, Sri Krisna + Play Laundry |
| `3101.07` | Management Fee | `311.07` | Management Fee | TH Uluwatu + IGYT |
| ⤷ |  | `3101.07` | Management Fee | TH Legian, Sri Krisna + Play Laundry |
| `4110.01` | Pendapatan Kamar | `411.01` | Pendapatan Kamar TH Uluwatu | TH Uluwatu + IGYT |
| ⤷ |  | `4110.01-10` | Pendapatan Kamar - TH Seminyak | TH Legian, Sri Krisna + Play Laundry |
| ⤷ |  | `4110.01-30` | Pendapatan Kamar - Sri Krisna | TH Legian, Sri Krisna + Play Laundry |
| `4110.02` | Pendapatan Upgrade Room | `411.13` | Pendapatan Upgrade Room | TH Uluwatu + IGYT |
| ⤷ |  | `4110.10-10` | Pendapatan Upgrade Room - TH Seminyak | TH Legian, Sri Krisna + Play Laundry |
| ⤷ |  | `4110.09-30` | Pendapatan Upgrade Room - Sri Krisna | TH Legian, Sri Krisna + Play Laundry |
| `4110.03` | Pendapatan Early CI / Late CO | `411.07` | Pendapatan Early CI/ Late CO | TH Uluwatu + IGYT |
| ⤷ |  | `4110.06-10` | Pendapatan Early CI / Late CO - TH Seminyak | TH Legian, Sri Krisna + Play Laundry |
| ⤷ |  | `4110.05-30` | Pendapatan Early CI / Late CO - Sri Krisna | TH Legian, Sri Krisna + Play Laundry |
| `4110.04` | Pendapatan Rental Motor | `411.02` | Pendapatan Rental Motor - TH Uluwatu | TH Uluwatu + IGYT |
| ⤷ |  | `4110.02-10` | Pendapatan Rental Motor - TH Seminyak | TH Legian, Sri Krisna + Play Laundry |
| ⤷ |  | `4110.02-30` | Pendapatan Rental Motor - Sri Krisna | TH Legian, Sri Krisna + Play Laundry |
| `4110.05` | Pendapatan Rental Mobil | `411.12` | Pendapatan Rental Mobil | TH Uluwatu + IGYT |
| ⤷ |  | `4110.09-10` | Pendapatan Rental Mobil - TH Seminyak | TH Legian, Sri Krisna + Play Laundry |
| ⤷ |  | `4110.08-30` | Pendapatan Rental Mobil - Sri Krisna | TH Legian, Sri Krisna + Play Laundry |
| `4110.06` | Pendapatan Tour & Airport Transfer | `411.04` | Pendapatan Tour & Airport Transfer - TH Uluwatu | TH Uluwatu + IGYT |
| ⤷ |  | `4110.04-10` | Pendapatan Tour & Airport Transfer - TH Seminyak | TH Legian, Sri Krisna + Play Laundry |
| ⤷ |  | `4110.03-30` | Pendapatan Tour & Airport Transfer - Sri Krisna | TH Legian, Sri Krisna + Play Laundry |
| `4110.07` | Pendapatan Denda & Kerusakan | `411.06` | Pendapatan Denda & Kerusakan | TH Uluwatu + IGYT |
| ⤷ |  | `4110.05-10` | Pendapatan Denda & Kerusakan - TH Seminyak | TH Legian, Sri Krisna + Play Laundry |
| ⤷ |  | `4110.04-30` | Pendapatan Denda & Kerusakan - Sri Krisna | TH Legian, Sri Krisna + Play Laundry |
| `4110.08` | Pendapatan Layanan Tamu (Honeymoon/Birthday/Dll) | `411.08` | Pendapatan Layanan Tamu (Honeymoon/Birthday/Dll) | TH Uluwatu + IGYT |
| ⤷ |  | `4110.07-10` | Pendapatan Layanan Tamu (Honeymoon/Birthday/Dll) - TH Seminyak | TH Legian, Sri Krisna + Play Laundry |
| ⤷ |  | `4110.06-30` | Pendapatan Layanan Tamu (Honeymoon/Birthday/Dll) - Sri Krisna | TH Legian, Sri Krisna + Play Laundry |
| `4110.09` | Pendapatan Lain-lain | `411.05` | Pendapatan Lain-lain - TH Uluwatu | TH Uluwatu + IGYT |
| ⤷ |  | `4110.08-10` | Pendapatan Lain-lain - TH Seminyak | TH Legian, Sri Krisna + Play Laundry |
| ⤷ |  | `4110.07-30` | Pendapatan Lain-lain - Sri Krisna | TH Legian, Sri Krisna + Play Laundry |
| `4111.01` | Pendapatan (F&B) - Makanan | `412.02` | Pendapatan (F&B) - Makanan | TH Uluwatu + IGYT |
| `4111.02` | Pendapatan (F&B) - Minuman | `412.01` | Pendapatan (F&B) - Minuman | TH Uluwatu + IGYT |
| `4111.03` | Pendapatan (F&B) - Breakfast | `412.03` | Pendapatan (F&B) - Breakfast | TH Uluwatu + IGYT |
| `4111.04` | Pendapatan (F&B) Minuman FO | `4110.03-10` | Pendapatan (F&B) Minuman FO -TH Seminyak | TH Legian, Sri Krisna + Play Laundry |
| `4111.05` | Pendapatan Online Delivery - Makanan | `412.04` | Pendapatan Online Delivery - Makanan | TH Uluwatu + IGYT |
| `4111.06` | Pendapatan Online Delivery - Minuman | `412.05` | Pendapatan Online Delivery - Minuman | TH Uluwatu + IGYT |
| `4112.01` | Pendapatan Laundry Kiloan | `4111.01` | Pendapatan laundry kiloan | TH Legian, Sri Krisna + Play Laundry |
| `4112.02` | Pendapatan Laundry Satuan | `4111.02` | Pendapatan laundry Satuan | TH Legian, Sri Krisna + Play Laundry |
| `4112.03` | Pendapatan Standart Laundry | `411.11` | Pendapatan Standart Laundry | TH Uluwatu + IGYT |
| `4113.01` | Pendapatan PMS - Belum Dialokasikan | `4.1.03` | Pendapatan PMS - Belum Dialokasikan | TH Uluwatu + IGYT |
| `4113.02` | Pendapatan Bunga Bank | `4104.01` | Pendapatan Bunga Bank | TH Uluwatu + IGYT |
| ⤷ |  | `4112.01` | Pendapatan Bunga Bank | TH Legian, Sri Krisna + Play Laundry |
| `5110.01` | HPP Food (F&B) | `511.01` | HPP Food (F&B) | TH Uluwatu + IGYT |
| `5110.02` | HPP Minuman (F&B) | `511.02` | HPP Minuman (F&B) | TH Uluwatu + IGYT |
| ⤷ |  | `5110.01-10` | HPP Minuman (F&B) - TH Seminyak | TH Legian, Sri Krisna + Play Laundry |
| ⤷ |  | `5110.01-30` | HPP Minuman (F&B) - Sri Krisna | TH Legian, Sri Krisna + Play Laundry |
| `5110.03` | HPP Breakfast (F&B) | `511.03` | HPP Breakfast (F&B) | TH Uluwatu + IGYT |
| `5110.04` | HPP Complimentary / Spoilage | `511.04` | HPP Complimentary / Spoilage | TH Uluwatu + IGYT |
| `5110.05` | HPP Tour & Airport Transfer | `511.05` | HPP Tour & Airport Transfer | TH Uluwatu + IGYT |
| ⤷ |  | `5110.02-10` | HPP Tour & Airport Transfer - TH Seminyak | TH Legian, Sri Krisna + Play Laundry |
| `5110.06` | HPP Minuman Alkohol | `511.06` | HPP Minuman Alkohol | TH Uluwatu + IGYT |
| `6110.01` | Komisi - Booking.com | `614.01` | Komisi - Booking.com | TH Uluwatu + IGYT |
| ⤷ |  | `6110.10-10` | Komisi Booking.com - TH | TH Legian, Sri Krisna + Play Laundry |
| ⤷ |  | `6110.10-30` | Komisi Booking.com - SRK | TH Legian, Sri Krisna + Play Laundry |
| `6110.02` | Biaya Layanan Booking.com | `614.1` | Biaya Layanan Booking.com | TH Uluwatu + IGYT |
| ⤷ |  | `6110.01-10` | Biaya Layanan Booking.com - TH | TH Legian, Sri Krisna + Play Laundry |
| ⤷ |  | `6110.01-30` | Biaya Layanan Booking.com - SRK | TH Legian, Sri Krisna + Play Laundry |
| `6110.03` | Komisi - Agoda Home | `614.02` | Komisi - Agoda Home | TH Uluwatu + IGYT |
| ⤷ |  | `6110.02-10` | Komisi Agoda Home - TH | TH Legian, Sri Krisna + Play Laundry |
| ⤷ |  | `6110.02-30` | Komisi Agoda Home - SRK | TH Legian, Sri Krisna + Play Laundry |
| `6110.04` | Komisi - Agoda YCS | `614.03` | Komisi - Agoda YCS | TH Uluwatu + IGYT |
| ⤷ |  | `6110.03-10` | Komisi Agoda YCS - TH | TH Legian, Sri Krisna + Play Laundry |
| ⤷ |  | `6110.03-30` | Komisi Agoda YCS - SRK | TH Legian, Sri Krisna + Play Laundry |
| `6110.05` | Komisi - Airbnb | `614.04` | Komisi - Airbnb | TH Uluwatu + IGYT |
| ⤷ |  | `6110.04-10` | Komisi Airbnb - TH | TH Legian, Sri Krisna + Play Laundry |
| ⤷ |  | `6110.04-30` | Komisi Airbnb - SRK | TH Legian, Sri Krisna + Play Laundry |
| `6110.06` | Komisi - Expedia | `614.05` | Komisi - Expedia | TH Uluwatu + IGYT |
| ⤷ |  | `6110.05-10` | Komisi Expedia - TH | TH Legian, Sri Krisna + Play Laundry |
| ⤷ |  | `6110.05-30` | Komisi Expedia - SRK | TH Legian, Sri Krisna + Play Laundry |
| `6110.07` | Komisi - Tiket.com | `614.06` | Komisi - Tiket.com | TH Uluwatu + IGYT |
| ⤷ |  | `6110.06-10` | Komisi Tiket.com - TH | TH Legian, Sri Krisna + Play Laundry |
| ⤷ |  | `6110.06-30` | Komisi Tiket.com - SRK | TH Legian, Sri Krisna + Play Laundry |
| `6110.08` | Komisi - Traveloka | `614.07` | Komisi - Traveloka | TH Uluwatu + IGYT |
| ⤷ |  | `6110.07-10` | Komisi Traveloka - TH | TH Legian, Sri Krisna + Play Laundry |
| ⤷ |  | `6110.07-30` | Komisi Traveloka - SRK | TH Legian, Sri Krisna + Play Laundry |
| `6110.09` | Komisi - BE | `614.08` | Komisi - BE | TH Uluwatu + IGYT |
| ⤷ |  | `6110.08-10` | Komisi BE - TH | TH Legian, Sri Krisna + Play Laundry |
| ⤷ |  | `6110.08-30` | Komisi BE - SRK | TH Legian, Sri Krisna + Play Laundry |
| `6110.10` | Komisi - Hostel World | `614.11` | Komisi - Hostel World | TH Uluwatu + IGYT |
| ⤷ |  | `6110.11-10` | Komisi Hostel World - TH | TH Legian, Sri Krisna + Play Laundry |
| ⤷ |  | `6110.11-30` | Komisi Hostel World - SRK | TH Legian, Sri Krisna + Play Laundry |
| `6110.11` | Komisi - Trip.com | `614.12` | Komisi - Trip.com | TH Uluwatu + IGYT |
| ⤷ |  | `6110.12-10` | Komisi Trip.com - TH | TH Legian, Sri Krisna + Play Laundry |
| ⤷ |  | `6110.12-30` | Komisi Trip.com - SRK | TH Legian, Sri Krisna + Play Laundry |
| `6110.12` | Komisi - Klook | `614.13` | Komisi - Klook | TH Uluwatu + IGYT |
| ⤷ |  | `6110.13-10` | Komisi Klook - TH | TH Legian, Sri Krisna + Play Laundry |
| ⤷ |  | `6110.13-30` | Komisi Klook - SRK | TH Legian, Sri Krisna + Play Laundry |
| `6110.13` | Komisi - Travel Agent (Korporat/Offline) | `614.09` | Komisi - Travel Agent (Korporat/Offline) | TH Uluwatu + IGYT |
| ⤷ |  | `6110.09-10` | Komisi Travel Agent (Korporat/Offline) - TH | TH Legian, Sri Krisna + Play Laundry |
| ⤷ |  | `6110.09-30` | Komisi Travel Agent (Korporat/Offline) - SRK | TH Legian, Sri Krisna + Play Laundry |
| `6120.01` | Biaya Listrik | `612.01` | Biaya Listrik | TH Uluwatu + IGYT |
| ⤷ |  | `6120.03-10` | Biaya Listrik - TH | TH Legian, Sri Krisna + Play Laundry |
| ⤷ |  | `6120.03-30` | Biaya Listrik - SRK | TH Legian, Sri Krisna + Play Laundry |
| ⤷ |  | `6170.01` | Biaya Listrik Laundry | TH Legian, Sri Krisna + Play Laundry |
| `6120.02` | Biaya Internet | `612.02` | Biaya Internet | TH Uluwatu + IGYT |
| ⤷ |  | `6120.04-10` | Biaya Internet - TH | TH Legian, Sri Krisna + Play Laundry |
| ⤷ |  | `6120.04-30` | Biaya Internet - SRK | TH Legian, Sri Krisna + Play Laundry |
| `6120.03` | Biaya Pajak | `612.04` | Biaya Pajak | TH Uluwatu + IGYT |
| `6120.04` | Biaya Administrasi & Umum | `612.05` | Biaya Administrasi & Umum | TH Uluwatu + IGYT |
| `6120.05` | Biaya Software dan Langganan | `612.06` | Biaya Software dan Langganan | TH Uluwatu + IGYT |
| ⤷ |  | `6130.04` | Biaya Software dan Langganan | TH Legian, Sri Krisna + Play Laundry |
| `6120.06` | Biaya Peralatan dan Perlengkapan Kantor | `612.07` | Biaya Peralatan dan Perlengkapan Kantor | TH Uluwatu + IGYT |
| ⤷ |  | `6130.06` | Biaya Peralatan dan Perlengkapan Kantor | TH Legian, Sri Krisna + Play Laundry |
| `6120.07` | Biaya Diskon Tamu | `611.05` | Biaya Diskon Tamu | TH Uluwatu + IGYT |
| ⤷ |  | `6120.01-10` | Biaya Diskon Tamu - TH | TH Legian, Sri Krisna + Play Laundry |
| ⤷ |  | `6120.01-30` | Biaya Diskon Tamu - SRK | TH Legian, Sri Krisna + Play Laundry |
| `6120.08` | Biaya Refund dan Kompensasi Tamu | `611.1` | Biaya Refund dan Kompensasi Tamu | TH Uluwatu + IGYT |
| ⤷ |  | `6120.02-10` | Biaya Refund dan Kompensasi Tamu - TH | TH Legian, Sri Krisna + Play Laundry |
| ⤷ |  | `6120.02-30` | Biaya Refund dan Kompensasi Tamu - SRK | TH Legian, Sri Krisna + Play Laundry |
| `6120.09` | Biaya Lain-lain | `612.08` | Biaya Lain-lain | TH Uluwatu + IGYT |
| ⤷ |  | `6130.05` | Biaya lain-lain | TH Legian, Sri Krisna + Play Laundry |
| ⤷ |  | `6170.06` | Biaya Lain-lain Laundry | TH Legian, Sri Krisna + Play Laundry |
| `6130.01` | Biaya Gaji Karyawan | `613.01` | Biaya Gaji Karyawan | TH Uluwatu + IGYT |
| ⤷ |  | `616.1` | Biaya Gaji IGYT | TH Uluwatu + IGYT |
| ⤷ |  | `6130.01` | Biaya Gaji Karyawan | TH Legian, Sri Krisna + Play Laundry |
| ⤷ |  | `6130.12` | Biaya Gaji Laundry | TH Legian, Sri Krisna + Play Laundry |
| `6130.02` | Biaya Service Karyawan | `613.02` | Biaya Service Karyawan | TH Uluwatu + IGYT |
| ⤷ |  | `616.12` | Biaya Service IGYT | TH Uluwatu + IGYT |
| ⤷ |  | `6130.03` | Biaya Service Karyawan | TH Legian, Sri Krisna + Play Laundry |
| ⤷ |  | `6130.13` | Biaya Service Laundry | TH Legian, Sri Krisna + Play Laundry |
| `6130.03` | Biaya THR | `613.05` | Biaya THR | TH Uluwatu + IGYT |
| ⤷ |  | `6130.1` | Biaya THR | TH Legian, Sri Krisna + Play Laundry |
| `6130.04` | Biaya Bonus Management | `613.06` | Biaya Bonus Management | TH Uluwatu + IGYT |
| ⤷ |  | `6130.11` | Biaya Bonus Management | TH Legian, Sri Krisna + Play Laundry |
| `6130.05` | Biaya Marketing | `613.09` | Biaya Marketing | TH Uluwatu + IGYT |
| ⤷ |  | `6130.14` | Biaya Marketing | TH Legian, Sri Krisna + Play Laundry |
| `6130.06` | Biaya Administrasi Bank | `613.03` | Biaya Administrasi Bank | TH Uluwatu + IGYT |
| ⤷ |  | `6130.07` | Biaya Administrasi Bank | TH Legian, Sri Krisna + Play Laundry |
| `6140.01` | Biaya Linen | `6140.01-10` | Biaya Linen - TH | TH Legian, Sri Krisna + Play Laundry |
| ⤷ |  | `6140.01-30` | Biaya Linen - SRK | TH Legian, Sri Krisna + Play Laundry |
| `6150.01` | Biaya Peralatan Kitchen | `611.22` | Biaya Peralatan Kitchen Room | TH Uluwatu + IGYT |
| ⤷ |  | `616.01` | Biaya Peralatan dan Perlengkapan Kitchen IGYT | TH Uluwatu + IGYT |
| ⤷ |  | `6150.01-10` | Biaya Peralatan Kitchen - TH | TH Legian, Sri Krisna + Play Laundry |
| ⤷ |  | `6150.01-30` | Biaya Peralatan Kitchen - SRK | TH Legian, Sri Krisna + Play Laundry |
| `6150.02` | Biaya Perlengkapan dan Peralatan Amenities | `611.02` | Biaya Perlengkapan dan Peralatan Amenities | TH Uluwatu + IGYT |
| ⤷ |  | `6150.02-10` | Biaya Perlengkapan dan Peralatan Amenities - TH | TH Legian, Sri Krisna + Play Laundry |
| ⤷ |  | `6150.02-30` | Biaya Perlengkapan dan Peralatan Amenities - SRK | TH Legian, Sri Krisna + Play Laundry |
| `6150.03` | Biaya Chemical HK | `611.04` | Biaya Chemical HK | TH Uluwatu + IGYT |
| ⤷ |  | `6150.03-10` | Biaya Chemicall - TH | TH Legian, Sri Krisna + Play Laundry |
| ⤷ |  | `6150.03-30` | Biaya Chemicall - SRK | TH Legian, Sri Krisna + Play Laundry |
| `6150.04` | Biaya Perlengkapan Room | `611.06` | Biaya Perlengkapan Room | TH Uluwatu + IGYT |
| ⤷ |  | `6150.04-10` | Biaya Perlengkapan Room - TH | TH Legian, Sri Krisna + Play Laundry |
| ⤷ |  | `6150.04-30` | Biaya Perlengkapan Room - SRK | TH Legian, Sri Krisna + Play Laundry |
| `6150.05` | Biaya Room Supplies | `611.12` | Biaya Room Supplies | TH Uluwatu + IGYT |
| ⤷ |  | `6150.07-10` | Biaya Room Supplies - TH | TH Legian, Sri Krisna + Play Laundry |
| ⤷ |  | `6150.07-30` | Biaya Room Supplies - SRK | TH Legian, Sri Krisna + Play Laundry |
| `6150.06` | Biaya Layanan Tamu | `611.11` | Biaya Layanan Tamu | TH Uluwatu + IGYT |
| ⤷ |  | `6150.06-10` | Biaya Layanan Tamu - TH | TH Legian, Sri Krisna + Play Laundry |
| ⤷ |  | `6150.06-30` | Biaya Layanan Tamu - SRK | TH Legian, Sri Krisna + Play Laundry |
| `6150.07` | Biaya Layanan Tamu FREE | `611.13` | Biaya Layanan Tamu FREE | TH Uluwatu + IGYT |
| ⤷ |  | `6150.08-10` | Biaya Layanan Tamu FREE - TH | TH Legian, Sri Krisna + Play Laundry |
| ⤷ |  | `6150.08-30` | Biaya Layanan Tamu FREE - SRK | TH Legian, Sri Krisna + Play Laundry |
| `6150.08` | Biaya Alat dan Bahan Engineering | `611.28` | Biaya Alat dan Bahan Engineering | TH Uluwatu + IGYT |
| ⤷ |  | `6150.1` | Biaya Alat dan Bahan Engineering | TH Legian, Sri Krisna + Play Laundry |
| `6150.09` | Biaya Peralatan dan Perlengkapan HK | `611.29` | Biaya Peralatan dan Perlengkapan HK | TH Uluwatu + IGYT |
| ⤷ |  | `6150.11` | Biaya Peralatan dan Perlengkapan HK | TH Legian, Sri Krisna + Play Laundry |
| `6150.10` | Biaya Peralatan dan Perlengkapan FO | `611.3` | Biaya Peralatan dan Perlengkapan FO | TH Uluwatu + IGYT |
| ⤷ |  | `6150.12-10` | Biaya Peralatan dan Perlengkapan FO - TH | TH Legian, Sri Krisna + Play Laundry |
| `6150.11` | Biaya Renovasi & Penambahan Fasilitas | `611.31` | Biaya Renovasi & Penambahan Fasilitas | TH Uluwatu + IGYT |
| `6150.12` | Biaya Laundry | `611.03` | Biaya Laundry | TH Uluwatu + IGYT |
| `6150.13` | Biaya Laundry Linen | `6150.09-30` | Biaya Laundry Linen | TH Legian, Sri Krisna + Play Laundry |
| `6160.01` | Biaya Gas HK | `611.2` | Biaya Gas HK | TH Uluwatu + IGYT |
| `6160.02` | Biaya Gas Kitchen | `616.02` | Biaya Gas Kitchen | TH Uluwatu + IGYT |
| `6160.03` | Biaya Galon HK | `611.09` | Biaya Galon HK | TH Uluwatu + IGYT |
| ⤷ |  | `6160.02-` | Biaya Galon | TH Legian, Sri Krisna + Play Laundry |
| `6160.04` | Biaya Galon Kitchen | `616.07` | Biaya Galon Kitchen | TH Uluwatu + IGYT |
| `6160.05` | Biaya Air Isi Ulang | `611.24` | Biaya Air Isi Ulang HK | TH Uluwatu + IGYT |
| ⤷ |  | `616.09` | Biaya Air Isi Ulang IGYT | TH Uluwatu + IGYT |
| ⤷ |  | `6160.03` | Biaya Air Isi Ulang | TH Legian, Sri Krisna + Play Laundry |
| `6160.06` | Biaya Tabung Gas | `6160.01-` | Biaya Gas | TH Legian, Sri Krisna + Play Laundry |
| ⤷ |  | `6160.04` | Biaya Tabung Gas | TH Legian, Sri Krisna + Play Laundry |
| ⤷ |  | `6170.02` | Biaya Gas Laundry | TH Legian, Sri Krisna + Play Laundry |
| `6170.01` | Biaya Sabun & Chemical Laundry | `611.21` | Biaya Chemical Laundry | TH Uluwatu + IGYT |
| ⤷ |  | `6170.03` | Biaya Sabun & Chemical Laundry Customer | TH Legian, Sri Krisna + Play Laundry |
| ⤷ |  | `6170.03-10` | Biaya Sabun & Chemical Laundry - TH | TH Legian, Sri Krisna + Play Laundry |
| ⤷ |  | `6170.03-30` | Biaya Sabun & Chemical Laundry - SRK | TH Legian, Sri Krisna + Play Laundry |
| `6170.02` | Biaya Perlengkapan (Supplies) Laundry | `6170.04` | Biaya Perlengkapan (Supplies) Laundry | TH Legian, Sri Krisna + Play Laundry |
| `6170.03` | Biaya Perawatan Mesin Laundry | `6170.05` | Biaya Perawatan Mesin Laundry | TH Legian, Sri Krisna + Play Laundry |
| `6170.04` | Biaya BBM Laundry | `611.27` | Biaya Bensin Laundry | TH Uluwatu + IGYT |
| ⤷ |  | `6170.07` | Biaya BBM Laundry | TH Legian, Sri Krisna + Play Laundry |
| `6180.01` | Biaya Pemeliharaan Room | `615.01` | Biaya Pemeliharaan Room | TH Uluwatu + IGYT |
| ⤷ |  | `6180.01` | Biaya Pemeliharaan Room | TH Legian, Sri Krisna + Play Laundry |
| `6180.02` | Biaya Pemeliharaan Kendaraan (Service/Samsat/dll) | `615.02` | Biaya Pemeliharaan Kendaraan (Service/Samsat/dll) | TH Uluwatu + IGYT |
| ⤷ |  | `6180.02` | Biaya Pemeliharaan Kendaraan (Service/Samsat/dll) | TH Legian, Sri Krisna + Play Laundry |
| `6180.03` | Biaya Pemeliharaan Wifi | `615.03` | Biaya Pemeliharaan Wifi | TH Uluwatu + IGYT |
| ⤷ |  | `6180.03` | Biaya Pemeliharaan Wifi | TH Legian, Sri Krisna + Play Laundry |
| `6180.04` | Biaya Pemeliharaan Furniture | `615.04` | Biaya Pemeliharaan Furniture | TH Uluwatu + IGYT |
| ⤷ |  | `6180.04` | Biaya Pemeliharaan Furniture | TH Legian, Sri Krisna + Play Laundry |
| `6180.05` | Biaya Pemeliharaan Public Area | `615.05` | Biaya Pemeliharaan Public Area | TH Uluwatu + IGYT |
| ⤷ |  | `6180.05` | Biaya Pemeliharaan Public Area | TH Legian, Sri Krisna + Play Laundry |
| `6180.06` | Biaya Pemeliharaan Office | `615.06` | Biaya Pemeliharaan Office | TH Uluwatu + IGYT |
| ⤷ |  | `6180.06` | Biaya Pemeliharaan Office | TH Legian, Sri Krisna + Play Laundry |
| `6180.07` | Biaya Pemeliharaan AC | `615.07` | Biaya Pemeliharaan AC | TH Uluwatu + IGYT |
| ⤷ |  | `6180.07` | Biaya Pemeliharaan AC | TH Legian, Sri Krisna + Play Laundry |
| `6180.08` | Biaya Pemeliharaan Linen | `615.08` | Biaya Pemeliharaan Linen | TH Uluwatu + IGYT |
| ⤷ |  | `6180.08` | Biaya Pemeliharaan Linen | TH Legian, Sri Krisna + Play Laundry |
| `6180.09` | Biaya Pemeliharaan Peralatan Kantor | `615.09` | Biaya Pemeliharaan Peralatan Kantor | TH Uluwatu + IGYT |
| ⤷ |  | `6180.09` | Biaya Pemeliharaan Peralatan Kantor | TH Legian, Sri Krisna + Play Laundry |
| `6180.10` | Biaya Pemeliharaan Alat & Mesin - Engineering | `615.1` | Biaya Pemeliharaan Alat & Mesin - Engineering | TH Uluwatu + IGYT |
| ⤷ |  | `6180.1` | Biaya Pemeliharaan Alat & Mesin - Engineering | TH Legian, Sri Krisna + Play Laundry |
| `6180.11` | Biaya Pemeliharaan Kitchen | `617.01` | Biaya Pemeliharaan Kitchen | TH Uluwatu + IGYT |
| `6180.12` | Biaya Pemeliharaan Kasir dan Bar | `617.02` | Biaya Pemeliharaan Kasir dan Bar | TH Uluwatu + IGYT |
| `6180.13` | Biaya Pemeliharaan Bangunan dan Fasilitas | `617.03` | Biaya Pemeliharaan Bangungan dan Fasilitas IGYT | TH Uluwatu + IGYT |
| `6181.01` | Biaya Rekrutmen | `618.01` | Biaya Rekrutmen | TH Uluwatu + IGYT |
| ⤷ |  | `6181.01` | Biaya Rekrutmen | TH Legian, Sri Krisna + Play Laundry |
| `6181.02` | Biaya Development Staff | `618.02` | Biaya Development Staff | TH Uluwatu + IGYT |
| ⤷ |  | `6181.02` | Biaya Development Staff | TH Legian, Sri Krisna + Play Laundry |
| `6181.03` | Biaya Kompensasi | `618.03` | Biaya Kompensasi | TH Uluwatu + IGYT |
| ⤷ |  | `6181.03` | Biaya Kompensasi | TH Legian, Sri Krisna + Play Laundry |
| `6181.04` | Biaya Konsumsi | `618.04` | Biaya Konsumsi | TH Uluwatu + IGYT |
| ⤷ |  | `6181.04` | Biaya Konsumsi | TH Legian, Sri Krisna + Play Laundry |
| `6181.05` | Biaya Perlengkapan Staf | `618.05` | Biaya Perlengkapan Staf | TH Uluwatu + IGYT |
| ⤷ |  | `6181.05` | Biaya Perlengkapan Staf | TH Legian, Sri Krisna + Play Laundry |
| `6190.01` | Biaya Bahan Makanan | `616.03` | Biaya Bahan Makanan | TH Uluwatu + IGYT |
| `6190.02` | Biaya Bahan Minuman | `616.04` | Biaya Bahan Minuman | TH Uluwatu + IGYT |
| `6190.03` | Biaya Perlengkapan F&B | `616.08` | Biaya Perlengkapan F&B | TH Uluwatu + IGYT |
| `6190.04` | Biaya Packaging | `616.06` | Biaya Packaging | TH Uluwatu + IGYT |
| `6190.05` | Biaya Peralatan dan Perlengkapan Resto | `616.11` | Biaya Peralatan dan Perlengkapan Resto IGYT | TH Uluwatu + IGYT |
| `6190.06` | Biaya Peralatan dan Perlengkapan Cafe | `616.05` | Biaya peralatan dan perlengkapan cafe | TH Uluwatu + IGYT |
| `6190.07` | Biaya Shared F&B Inventory | `616.13` | Biaya Shared F&B Inventory | TH Uluwatu + IGYT |
| `6190.08` | Biaya Chemical & Supplies | `616.14` | Biaya Chemical & Supplies IGYT | TH Uluwatu + IGYT |
| `7110.01` | Interest Income | `711.01` | Interest Income | TH Uluwatu + IGYT |
| ⤷ |  | `7110.01` | Interest Income | TH Legian, Sri Krisna + Play Laundry |
| `8110.01` | Biaya Pajak Non Operasional | `811.01` | Biaya Pajak | TH Uluwatu + IGYT |
| ⤷ |  | `8110.01` | Biaya Pajak | TH Legian, Sri Krisna + Play Laundry |
| `8110.02` | Bank Charge Expense | `811.02` | Bank Charge Expense | TH Uluwatu + IGYT |
| ⤷ |  | `8110.02` | Bank Charge Expense | TH Legian, Sri Krisna + Play Laundry |
