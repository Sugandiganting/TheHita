# -*- coding: utf-8 -*-
"""Membaca statistik hunian dari Sales Summary Report GuestPro (PDF).

Yang diambil hanya angka operasional — room night, pax, ARR, dan jumlah kamar —
bukan angka uangnya. Uang sudah masuk lewat laporan laba rugi; mengimpornya dua
kali berarti mencatat pendapatan dobel. Lihat docs/impor-data-guestpro.md.

Skrip ini membaca baris TOTAL yang tercetak di laporan, bukan menjumlahkan
sendiri baris per baris, sehingga tidak tergantung apakah laporannya
dikelompokkan per tipe kamar atau per nomor kamar.

Pemakaian:
    python3 scripts/baca-statistik.py --unit=THU laporan/*.pdf --keluar=data/statistik.csv
"""
import csv
import glob
import re
import sys
import pdfplumber

BULAN = {'Jan': 1, 'Feb': 2, 'Mar': 3, 'Apr': 4, 'May': 5, 'Mei': 5, 'Jun': 6,
         'Jul': 7, 'Aug': 8, 'Agu': 8, 'Sep': 9, 'Oct': 10, 'Okt': 10,
         'Nov': 11, 'Des': 12, 'Dec': 12}
NAMA_BULAN = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli',
              'Agustus', 'September', 'Oktober', 'November', 'Desember']

# Nomor kamar di kolom paling kiri, mis. 104, 126, 210.
NOMOR_KAMAR = re.compile(r'^\d{3}$')


def angka(s):
    return float(s.replace('.', '').replace(',', '.'))


def baca(path):
    with pdfplumber.open(path) as pdf:
        halaman = [(pg.extract_text() or '', pg.extract_words(keep_blank_chars=False))
                   for pg in pdf.pages]
    teks = '\n'.join(t for t, _ in halaman)
    satu = teks.replace('\n', ' ')

    m = re.search(r'Periode:\s*(\d{2})\s+(\w{3})\s+(\d{4})', teks)
    if not m:
        raise SystemExit(f'{path}: periode laporan tidak ditemukan.')
    bulan, tahun = BULAN[m.group(2)], int(m.group(3))

    def cacah(label):
        m = re.search(label + r'\s+(\d[\d.]*)\b', satu)
        return int(m.group(1).replace('.', '')) if m else None

    def uang(label):
        m = re.search(label + r'\s+Rp\s*(-?[\d.,]+)', satu)
        return angka(m.group(1)) if m else None

    # Jumlah kamar diambil dari nomor kamar yang benar-benar muncul di laporan,
    # bukan dari data induk, supaya tingkat hunian tidak dihitung dari angka
    # karangan. Laporan yang dikelompokkan per tipe kamar tidak memuat nomor
    # kamar, dan untuk laporan seperti itu hasilnya None.
    kamar = set()
    for _, kata in halaman:
        baris = {}
        for w in kata:
            baris.setdefault(round(w['top'] / 3), []).append(w)
        for ws in baris.values():
            kiri = sorted(ws, key=lambda w: w['x0'])[0]
            if kiri['x0'] < 90 and NOMOR_KAMAR.fullmatch(kiri['text']):
                kamar.add(kiri['text'])

    return {
        'berkas': path,
        'bulan': bulan,
        'tahun': tahun,
        'roomNight': cacah(r'Total Night'),
        'pax': cacah(r'Total Pax'),
        'arr': uang(r'Total ARR'),
        'roomNet': uang(r'Total Room Net'),
        'jumlahKamar': len(kamar) or None,
    }


def main(argv):
    berkas = []
    for a in argv:
        if not a.startswith('--'):
            berkas.extend(sorted(glob.glob(a)) or [a])
    unit = next((a.split('=', 1)[1].upper() for a in argv if a.startswith('--unit=')), None)
    keluar = next((a.split('=', 1)[1] for a in argv if a.startswith('--keluar=')), None)
    if not berkas or not unit:
        raise SystemExit(__doc__)

    hasil, kurang = [], []
    for path in berkas:
        d = baca(path)
        d['unit'] = unit
        label = f"{NAMA_BULAN[d['bulan']]} {d['tahun']}"
        hilang = [k for k in ('roomNight', 'pax') if d[k] is None]
        # ARR yang tercetak GuestPro tidak selalu konsisten dengan angkanya
        # sendiri: pada April dan Juni 2026, ARR dikali room night meleset dari
        # Total Room Net. Karena itu ARR tidak ikut diimpor — di sistem ini ARR
        # dihitung dari pendapatan kamar yang sudah masuk lewat laba rugi.
        if d['arr'] and d['roomNight'] and d['roomNet']:
            selisih = d['arr'] * d['roomNight'] - d['roomNet']
            if abs(selisih) > max(10.0, abs(d['roomNet']) * 1e-6):
                d['catatan'] = (f"ARR cetak {d['arr']:,.2f} tidak sepadan dengan "
                                f"Total Room Net (meleset {selisih:,.2f})")
        print(f"{label:<16} room night {str(d['roomNight'] or '-'):>6}   "
              f"pax {str(d['pax'] or '-'):>6}   "
              f"kamar {str(d['jumlahKamar'] or '-'):>4}   "
              f"{'KURANG: ' + ', '.join(hilang) if hilang else 'OK'}")
        if d.get('catatan'):
            print(f"    catatan: {d['catatan']}")
        if hilang:
            kurang.append(f'{label}: {", ".join(hilang)} tidak ditemukan')
        hasil.append(d)

    if kurang:
        raise SystemExit('\nAda angka yang tidak terbaca:\n  ' + '\n  '.join(kurang))

    ganda = {}
    for d in hasil:
        ganda.setdefault((d['tahun'], d['bulan']), []).append(d['berkas'])
    for (tahun, bulan), asal in sorted(ganda.items()):
        if len(asal) > 1:
            raise SystemExit(f'{NAMA_BULAN[bulan]} {tahun} terbaca dari {len(asal)} berkas.')

    hasil.sort(key=lambda d: (d['tahun'], d['bulan']))
    if not keluar:
        print('\nSemua terbaca. Tambahkan --keluar=data/statistik.csv untuk menyimpannya.')
        return

    baru = not glob.glob(keluar)
    with open(keluar, 'a' if not baru else 'w', newline='') as f:
        w = csv.writer(f)
        if baru:
            w.writerow(['Unit', 'Periode', 'Room Night', 'Pax', 'Jumlah Kamar'])
        for d in hasil:
            w.writerow([d['unit'], f"{d['tahun']}-{d['bulan']:02d}", d['roomNight'],
                        d['pax'], d['jumlahKamar'] or ''])
    print(f"\n{len(hasil)} bulan -> {keluar}")


if __name__ == '__main__':
    main(sys.argv[1:])
