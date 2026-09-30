# -*- coding: utf-8 -*-
"""Membaca Room Revenue Report GuestPro (.xls) menjadi statistik hunian.

Laporan ini berisi satu baris per transaksi kamar, lengkap dengan tanggal,
nomor kamar, dan kode akun pendapatan. Dari situ bisa dihitung kamar terjual
per bulan per cabang sekaligus jumlah kamar yang benar-benar ada — dua hal yang
tidak bisa disimpulkan dari Sales Summary yang dikelompokkan per tipe kamar.

Keluarannya CSV yang sama bentuknya dengan scripts/baca-statistik.py, jadi
dimuat dengan scripts/impor-statistik.ts.

Angka uang TIDAK diimpor. Pendapatan kamar sudah masuk lewat laporan laba rugi;
di sini nilainya hanya dipakai sebagai pembanding. Lihat
docs/impor-data-guestpro.md.

Berkas ini memuat nama tamu. Yang dikeluarkan skrip ini hanya angka ringkasan —
nama tidak ikut ke mana pun.

Pemakaian:
    python3 scripts/baca-room-revenue.py laporan/room-revenue.xls --keluar=data/statistik.csv
    python3 scripts/baca-room-revenue.py laporan/room-revenue.xls --banding=data/pnl.json
"""
import collections
import csv
import glob
import json
import re
import sys

try:
    from python_calamine import CalamineWorkbook
except ImportError:
    sys.exit('Butuh python-calamine. Pasang dengan: pip install python-calamine')

NAMA_BULAN = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli',
              'Agustus', 'September', 'Oktober', 'November', 'Desember']

# Akun pendapatan kamar GuestPro -> cabang. Akhiran nomornya yang menandai
# cabang, sama seperti di tempat lain pada GuestPro 2.
UNIT_DARI_AKUN = {'4110.01-10': 'THL', '4110.01-30': 'SKR'}

# Hanya baris berjenis ini yang dihitung sebagai kamar terjual. Jenis lain
# (Late Checkout, Early Checkin, denda) adalah tambahan pada tamu yang sama,
# bukan malam kamar tersendiri.
JENIS_MALAM = 'Room Charge'

KOLOM = {'tanggal': 0, 'tipe': 2, 'kamar': 3, 'jenis': 6, 'akun': 10, 'nilai': 11}


def baca(path):
    wb = CalamineWorkbook.from_path(path)
    rows = wb.get_sheet_by_index(0).to_python()

    judul = next((i for i, r in enumerate(rows)
                  if r and str(r[0]).strip() == 'Date' and 'Folio No' in [str(c).strip() for c in r]), None)
    if judul is None:
        raise SystemExit(f'{path}: baris judul tabel tidak ditemukan. '
                         'Pastikan berkas ini Room Revenue Report dari GuestPro.')

    malam = collections.Counter()
    uang = collections.Counter()
    kamar = collections.defaultdict(set)
    akun_lain = collections.Counter()
    tercetak = None

    for r in rows[judul + 1:]:
        if not r or not str(r[KOLOM['tanggal']]).strip():
            continue
        if str(r[KOLOM['tanggal']]).strip().lower() == 'total':
            # Baris total yang tercetak di kaki laporan, dipakai sebagai pembanding.
            tercetak = {
                'malam': int(float(r[KOLOM['kamar']] or 0)),
                'nilai': float(r[KOLOM['nilai']] or 0),
            }
            continue

        tanggal = str(r[KOLOM['tanggal']])[:10]
        m = re.match(r'(\d{4})-(\d{2})-(\d{2})', tanggal)
        if not m:
            continue
        periode = f'{m.group(1)}-{m.group(2)}'
        kode = str(r[KOLOM['akun']]).split(' - ')[0].strip()
        nilai = float(r[KOLOM['nilai']] or 0)

        unit = UNIT_DARI_AKUN.get(kode)
        if unit is None:
            akun_lain[kode] += nilai
            continue

        uang[(unit, periode)] += nilai
        if str(r[KOLOM['jenis']]).strip() == JENIS_MALAM:
            malam[(unit, periode)] += 1
            kamar[unit].add(str(r[KOLOM['kamar']]).replace('.0', '').strip())

    return {'malam': malam, 'uang': uang, 'kamar': kamar,
            'akunLain': akun_lain, 'tercetak': tercetak}


def main(argv):
    berkas = []
    for a in argv:
        if not a.startswith('--'):
            berkas.extend(sorted(glob.glob(a)) or [a])
    keluar = next((a.split('=', 1)[1] for a in argv if a.startswith('--keluar=')), None)
    banding = next((a.split('=', 1)[1] for a in argv if a.startswith('--banding=')), None)
    if not berkas:
        raise SystemExit(__doc__)

    gabung = {'malam': collections.Counter(), 'uang': collections.Counter(),
              'kamar': collections.defaultdict(set), 'akunLain': collections.Counter()}
    for path in berkas:
        d = baca(path)
        for k in ('malam', 'uang', 'akunLain'):
            gabung[k].update(d[k])
        for u, ks in d['kamar'].items():
            gabung['kamar'][u] |= ks

        if d['tercetak']:
            malam = sum(d['malam'].values())
            nilai = sum(d['uang'].values()) + sum(d['akunLain'].values())
            beda_m = malam - d['tercetak']['malam']
            beda_n = nilai - d['tercetak']['nilai']
            if beda_m != 0 or abs(beda_n) > 0.5:
                raise SystemExit(
                    f'{path}: hasil baca tidak sama dengan baris Total yang tercetak.\n'
                    f'  kamar terjual : terbaca {malam}, tercetak {d["tercetak"]["malam"]}\n'
                    f'  nilai         : terbaca {nilai:,.2f}, tercetak {d["tercetak"]["nilai"]:,.2f}')
            print(f'{path}: {malam} kamar terjual, Rp {nilai:,.2f} — cocok dengan baris Total.')

    print('\nJumlah kamar menurut nomor kamar yang muncul di laporan:')
    for u in sorted(gabung['kamar']):
        nomor = sorted(gabung['kamar'][u], key=lambda x: (len(x), x))
        print(f'  {u}: {len(nomor)} kamar — {" ".join(nomor)}')

    periode = sorted({k[1] for k in gabung['malam']})
    unit = sorted(gabung['kamar'])
    print()
    print('Periode'.ljust(10) + ''.join(f'{u + " malam":>13}{u + " rupiah":>18}' for u in unit))
    for p in periode:
        print(p.ljust(10) + ''.join(
            f"{gabung['malam'][(u, p)]:>13}{gabung['uang'][(u, p)]:>18,.0f}" for u in unit))

    if gabung['akunLain']:
        print('\nAkun lain di laporan ini, tidak dihitung sebagai kamar terjual:')
        for k, v in sorted(gabung['akunLain'].items()):
            print(f'  {k or "(kosong)"}  Rp {v:,.2f}')

    if banding:
        bandingkan(gabung, banding)

    if not keluar:
        print('\nTambahkan --keluar=data/statistik.csv untuk menyimpan statistiknya.')
        return

    baru = not glob.glob(keluar)
    with open(keluar, 'a' if not baru else 'w', newline='') as f:
        w = csv.writer(f)
        if baru:
            w.writerow(['Unit', 'Periode', 'Room Night', 'Pax', 'Jumlah Kamar'])
        for u in unit:
            for p in periode:
                if gabung['malam'][(u, p)] == 0:
                    continue
                # Kolom Pax sengaja kosong: laporan ini tidak memuat jumlah tamu,
                # dan pemuatnya tidak akan menimpa angka pax yang sudah ada.
                w.writerow([u, p, gabung['malam'][(u, p)], '', len(gabung['kamar'][u])])
    print(f'\n{len(unit) * len(periode)} baris statistik -> {keluar}')


def bandingkan(gabung, path_pnl):
    """Membandingkan pendapatan kamar di sini dengan laporan laba rugi.

    Keduanya menghitung uang yang sama, jadi selisihnya menandakan sesuatu:
    periode laporan yang salah, atau penyesuaian yang dicatat langsung ke akun
    pendapatan tanpa lewat folio tamu.
    """
    pnl = json.load(open(path_pnl))
    if isinstance(pnl, dict):
        pnl = [pnl]
    balik = {v: k for k, v in UNIT_DARI_AKUN.items()}

    print('\nPembanding dengan laporan laba rugi:')
    print(f"{'Bulan':<15}{'Unit':<6}{'room revenue':>18}{'laba rugi':>18}{'selisih':>16}")
    ada = False
    for d in sorted(pnl, key=lambda d: (d['tahun'], d['bulan'])):
        p = f"{d['tahun']}-{d['bulan']:02d}"
        for u, kode in balik.items():
            r = gabung['uang'][(u, p)]
            n = next((a['nilai'] for a in d['akun'] if a['kode'] == kode), 0.0)
            if abs(r) < 0.005 and abs(n) < 0.005:
                continue
            beda = r - n
            if abs(beda) < 0.5:
                continue
            ada = True
            print(f"{NAMA_BULAN[d['bulan']] + ' ' + str(d['tahun']):<15}{u:<6}"
                  f"{r:>18,.2f}{n:>18,.2f}{beda:>16,.2f}")
    if not ada:
        print('  Tidak ada selisih.')


if __name__ == '__main__':
    main(sys.argv[1:])
