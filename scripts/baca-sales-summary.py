# -*- coding: utf-8 -*-
"""
Mengubah Sales Summary Report GuestPro (PDF) menjadi CSV jurnal siap impor.

Laporan ini memuat pendapatan per tipe kamar untuk satu bulan, dan mencakup
dua properti sekaligus (The Hita Legian/Seminyak dan Sri Krisna) yang dibedakan
lewat nama tipe kamarnya.

Pemakaian:
    python3 scripts/baca-sales-summary.py berkas1.pdf berkas2.pdf -o jurnal.csv
    npm run impor -- jurnal.csv --pms=PMS2 --unit=THL --coba

Butuh: pip install pdfplumber

Pembacaan selalu dicocokkan dengan baris total yang tercetak di laporan. Bila
tidak cocok, skrip berhenti daripada menghasilkan angka yang salah.
"""

import argparse, csv, os, re, sys

try:
    import pdfplumber
except ImportError:
    sys.exit('Butuh pdfplumber. Pasang dengan: pip install pdfplumber')

MONEY = re.compile(r'^\d{1,3}(?:\.\d{3})*,\d{2}$')
BULAN = {'Jan': 1, 'Feb': 2, 'Mar': 3, 'Apr': 4, 'May': 5, 'Mei': 5, 'Jun': 6,
         'Jul': 7, 'Aug': 8, 'Agu': 8, 'Sep': 9, 'Oct': 10, 'Okt': 10,
         'Nov': 11, 'Dec': 12, 'Des': 12}

# Urutan kolom nilai pada setiap baris tipe kamar.
KOLOM = ['roomCharge', 'extraCharge', 'pos', 'rebate', 'service', 'taxes',
         'commission', 'consignment', 'arr', 'totalNet', 'netExclPos', 'roomNet']

# Akun tujuan pada COA baru.
AKUN_KAS = '1110.01'          # Kas Pemasukan
AKUN_KAMAR = '4110.01'        # Pendapatan Kamar
AKUN_EXTRA = '4110.09'        # Pendapatan Lain-lain
AKUN_LAUNDRY = '4112.03'      # Pendapatan Standart Laundry
UNIT_LAUNDRY = 'PLD'          # Play Laundry


def angka(s):
    return float(s.replace('.', '').replace(',', '.'))


def unit_dari_tipe(tipe):
    """Tipe kamar bertuliskan "Sri Krisna" milik cabang Sri Krisna."""
    return 'SKR' if 'sri krisna' in tipe.lower() else 'THL'


def akhir_bulan(tahun, bulan):
    import calendar
    return f'{tahun:04d}-{bulan:02d}-{calendar.monthrange(tahun, bulan)[1]:02d}'


def baca_laporan(path):
    with pdfplumber.open(path) as pdf:
        page = pdf.pages[0]
        words = page.extract_words(keep_blank_chars=False)
        teks = page.extract_text() or ''

    m = re.search(r'Periode:\s*(\d{2})\s+(\w{3})\s+(\d{4})', teks)
    if not m:
        raise ValueError(f'{os.path.basename(path)}: baris "Periode:" tidak ditemukan.')
    bulan, tahun = BULAN[m.group(2)], int(m.group(3))

    baris = {}
    for w in words:
        baris.setdefault(round(w['top'] / 3), []).append(w)

    # Baris tipe kamar dikenali dari empat bilangan bulat di kolom kiri:
    # malam, reservasi, lead time, dan pax.
    anchors = []
    for k in sorted(baris):
        kiri = [w for w in baris[k] if w['x0'] < 170 and re.fullmatch(r'\d+', w['text'])]
        if len(kiri) >= 4:
            stat = [int(w['text']) for w in sorted(kiri, key=lambda w: w['x0'])][:4]
            anchors.append((k, stat))

    rows = []
    for i, (k, stat) in enumerate(anchors):
        batas = anchors[i + 1][0] if i + 1 < len(anchors) else k + 8

        nama = []
        for kk in range(k - 3, min(batas, k + 4)):
            for w in baris.get(kk, []):
                if w['x0'] < 70 and w['text'] != 'Rp' and not re.fullmatch(r'[\d.,]+', w['text']):
                    nama.append((kk, w['x0'], w['text']))
        tipe = re.sub(r'\bApartmen\s+t\b', 'Apartment',
                      ' '.join(t for _, _, t in sorted(nama))).strip()

        # Nilai diambil berurutan menurut koordinat X. Lebar angka berbeda tiap
        # bulan sehingga kolomnya bergeser; rentang X tetap tidak bisa dipakai.
        tokens = sorted(
            (w['x0'], angka(w['text']))
            for kk in range(k - 3, min(batas, k + 5))
            for w in baris.get(kk, [])
            if MONEY.fullmatch(w['text']) and w['x0'] >= 165
        )
        if len(tokens) != len(KOLOM):
            raise ValueError(
                f'{os.path.basename(path)}: tipe "{tipe}" terbaca {len(tokens)} angka, '
                f'seharusnya {len(KOLOM)}. Tata letak laporan mungkin berubah.'
            )

        rows.append({'tipe': tipe, 'malam': stat[0], 'pax': stat[3],
                     **dict(zip(KOLOM, (v for _, v in tokens)))})

    # Blok total di kanan bawah, dipasangkan lewat kedekatan koordinat karena
    # labelnya kerap terpotong dua baris dengan nilainya di tengah.
    labels, values = [], []
    for k, ws in baris.items():
        for w in ws:
            if 625 <= w['x0'] < 700 and w['text'] != 'Rp' and not MONEY.fullmatch(w['text']):
                labels.append((k, w['text']))
            elif w['x0'] >= 735 and MONEY.fullmatch(w['text']):
                values.append((k, angka(w['text'])))

    tercetak = {}
    for k, v in values:
        dekat = ' '.join(t for kk, t in sorted(labels) if abs(kk - k) <= 3)
        if 'Room' in dekat and 'Charge' in dekat:
            tercetak['roomCharge'] = v
        elif 'Extra' in dekat and 'Charge' in dekat:
            tercetak['extraCharge'] = v

    # Pemeriksaan silang: jumlah hasil baca harus sama dengan total tercetak.
    for kolom in ('roomCharge', 'extraCharge'):
        jumlah = sum(r[kolom] for r in rows)
        cetak = tercetak.get(kolom)
        if cetak is None or abs(jumlah - cetak) > 1:
            raise ValueError(
                f'{os.path.basename(path)}: {kolom} hasil baca {jumlah:,.2f} '
                f'tidak cocok dengan total tercetak {cetak}. Pembacaan dibatalkan.'
            )

    return {'bulan': bulan, 'tahun': tahun, 'rows': rows, 'berkas': os.path.basename(path)}


def jurnal_dari_laporan(lap):
    """Satu bukti per cabang per bulan.

    Kas cabang didebit sejumlah seluruh penerimaan, lalu dikredit ke akun
    pendapatan masing-masing. Pendapatan laundry dikreditkan ke Play Laundry
    walaupun uangnya diterima hotel — sistem impor otomatis menambahkan baris
    piutang dan hutang antar unit untuk menyeimbangkannya.
    """
    tanggal = akhir_bulan(lap['tahun'], lap['bulan'])
    per_unit = {}
    for r in lap['rows']:
        u = unit_dari_tipe(r['tipe'])
        a = per_unit.setdefault(u, {'room': 0.0, 'extra': 0.0, 'pos': 0.0})
        a['room'] += r['roomCharge']
        a['extra'] += r['extraCharge']
        a['pos'] += r['pos']

    baris = []
    for unit in sorted(per_unit):
        a = per_unit[unit]
        total = a['room'] + a['extra'] + a['pos']
        if total <= 0:
            continue
        ref = f"SS-{unit}-{lap['tahun']}-{lap['bulan']:02d}"
        ket = f"Penjualan {unit} {lap['bulan']:02d}/{lap['tahun']}"

        baris.append([tanggal, ref, AKUN_KAS, unit, ket, f'{total:.2f}', ''])
        if a['room'] > 0:
            baris.append([tanggal, ref, AKUN_KAMAR, unit, ket, '', f"{a['room']:.2f}"])
        if a['extra'] > 0:
            baris.append([tanggal, ref, AKUN_EXTRA, unit, ket, '', f"{a['extra']:.2f}"])
        if a['pos'] > 0:
            baris.append([tanggal, ref, AKUN_LAUNDRY, UNIT_LAUNDRY, ket, '', f"{a['pos']:.2f}"])
    return baris


def main():
    ap = argparse.ArgumentParser(description='Sales Summary GuestPro (PDF) -> CSV jurnal')
    ap.add_argument('berkas', nargs='+')
    ap.add_argument('-o', '--keluaran', default='jurnal-sales-summary.csv')
    args = ap.parse_args()

    semua = []
    for f in sorted(args.berkas):
        lap = baca_laporan(f)
        rows = jurnal_dari_laporan(lap)
        semua.extend(rows)
        total = sum(float(r[5] or 0) for r in rows)
        print(f"{lap['berkas']}: {lap['bulan']:02d}/{lap['tahun']}, "
              f"{len(lap['rows'])} tipe kamar, {len(rows)} baris jurnal, Rp {total:,.0f}")

    with open(args.keluaran, 'w', newline='', encoding='utf-8') as f:
        w = csv.writer(f)
        w.writerow(['Tanggal', 'No Bukti', 'Kode Akun', 'Unit', 'Keterangan', 'Debit', 'Kredit'])
        w.writerows(semua)

    print(f'\n{args.keluaran} berisi {len(semua)} baris.')
    print('Impor dengan:')
    print(f'  npm run impor -- {args.keluaran} --pms=PMS2 --unit=THL --coba')


if __name__ == '__main__':
    main()
