# -*- coding: utf-8 -*-
"""Membaca "Profit and Loss Report" GuestPro (PDF) menjadi JSON.

Skrip ini hanya bertugas mengeluarkan angka dari PDF. Semua urusan akuntansi —
padanan kode akun lama ke COA baru, pembagian beban bersama antar cabang,
penyusunan jurnal — dikerjakan oleh scripts/pnl-ke-jurnal.ts, supaya padanan
akun hanya punya satu sumber kebenaran (src/lib/coa-legacy.ts).

Pemakaian:
    python3 scripts/baca-pnl.py laporan/*.pdf --keluar=data/pnl.json

Skrip berhenti dengan galat bila jumlah hasil baca tidak sama dengan total yang
tercetak di laporan. Lebih baik gagal keras daripada memasukkan angka yang
diam-diam salah ke pembukuan.
"""
import json
import re
import sys
import pdfplumber

# Nominal bergaya Indonesia: 1.234.567,89
MONEY = re.compile(r'^\d{1,3}(?:\.\d{3})*,\d{2}$')
# Kode akun GuestPro: 4110.01, 6160.01-, 6120.05-30
KODE = re.compile(r'^\d{4}(?:\.\d{2})?(?:-\d{2})?-?$')
BULAN = {'Jan': 1, 'Feb': 2, 'Mar': 3, 'Apr': 4, 'May': 5, 'Mei': 5, 'Jun': 6,
         'Jul': 7, 'Aug': 8, 'Agu': 8, 'Sep': 9, 'Oct': 10, 'Okt': 10,
         'Nov': 11, 'Des': 12, 'Dec': 12}
NAMA_BULAN = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli',
              'Agustus', 'September', 'Oktober', 'November', 'Desember']

# Laporan menjorokkan akun terperinci ke dalam; judul kelompok dan baris "Total"
# rata kiri. Batas x di bawah ini yang membedakan keduanya.
X_AKUN_MIN, X_AKUN_MAKS = 130, 160
X_RATA_KIRI = 60


def angka(s):
    return float(s.replace('.', '').replace(',', '.'))


def baca_berkas(path):
    """Memecah satu PDF menjadi daftar laporan, satu per periode.

    GuestPro bisa mengeluarkan beberapa bulan dalam satu berkas — laporan
    Januari sampai Agustus bisa jadi 28 halaman dalam satu PDF, dan urutan
    bulannya belum tentu berurutan. Tiap laporan dikenali dari halaman yang
    memuat "Periode:".
    """
    with pdfplumber.open(path) as pdf:
        halaman = [(pg.extract_text() or '', pg.extract_words(keep_blank_chars=False))
                   for pg in pdf.pages]

    awal = [i for i, (t, _) in enumerate(halaman) if re.search(r'Periode:\s*\d{2}\s+\w{3}', t)]
    if not awal:
        raise SystemExit(f'{path}: periode laporan tidak ditemukan. '
                         'Pastikan berkas ini Profit and Loss Report dari GuestPro.')

    hasil = []
    for n, mulai in enumerate(awal):
        henti = awal[n + 1] if n + 1 < len(awal) else len(halaman)
        hasil.append(baca_satu(path, halaman[mulai:henti]))
    return hasil


def baca_satu(path, halaman):
    """Mengembalikan {bulan, tahun, akun: [{kode, nama, nilai}], tercetak}."""
    baris, teks_all = {}, []
    for i, (halaman_teks, kata) in enumerate(halaman):
        teks_all.append(halaman_teks)
        # Halaman digabung dengan jarak agar nomor baris tidak bertumpuk.
        for w in kata:
            baris.setdefault(i * 400 + round(w['top'] / 3), []).append(w)
    teks = '\n'.join(teks_all)

    m = re.search(r'Periode:\s*(\d{2})\s+(\w{3})\s+(\d{4})', teks)
    if not m:
        raise SystemExit(f'{path}: periode laporan tidak ditemukan. '
                         'Pastikan berkas ini Profit and Loss Report dari GuestPro.')
    bulan, tahun = BULAN[m.group(2)], int(m.group(3))

    # Titik jangkar tiap akun: kode akun yang berada di kolom menjorok.
    jangkar = []
    for k in sorted(baris):
        for w in baris[k]:
            if X_AKUN_MIN <= w['x0'] <= X_AKUN_MAKS and KODE.fullmatch(w['text']):
                jangkar.append((k, w['text']))
                break

    akun = []
    for i, (k, kode) in enumerate(jangkar):
        batas = jangkar[i + 1][0] if i + 1 < len(jangkar) else k + 10
        nama, uang = [], []
        for kk in range(k, min(batas, k + 8)):
            baris_ini = baris.get(kk, [])
            # Baris "Total ..." rata kiri adalah jumlah kelompok, bukan milik
            # akun ini. Tanpa penghentian ini, akun terakhir dalam sebuah
            # kelompok akan menyerap angka total kelompoknya.
            if any(w['x0'] < X_RATA_KIRI and w['text'].lower().startswith('total')
                   for w in baris_ini):
                break
            for w in baris_ini:
                if MONEY.fullmatch(w['text']):
                    uang.append((w['x0'], angka(w['text'])))
                elif (w['x0'] >= X_AKUN_MIN - 5 and w['text'] not in ('Rp', '-')
                      and not KODE.fullmatch(w['text'])):
                    nama.append((kk, w['x0'], w['text']))
        # Laporan memuat tiga kolom nominal: MONTH TO DATE, YEAR TO DATE, dan
        # persentase. Yang paling kiri adalah bulan berjalan, yang kita pakai.
        uang.sort()
        if len(uang) < 3:
            continue
        akun.append({
            'kode': kode,
            'nama': ' '.join(t for _, _, t in sorted(nama)),
            'nilai': uang[0][1],
        })

    satu_baris = teks.replace('\n', ' ')

    def tercetak(pola):
        m = re.search(pola + r'\s*Rp\s*([\d.,]+)', satu_baris)
        return angka(m.group(1)) if m else None

    return {
        'berkas': path,
        'bulan': bulan,
        'tahun': tahun,
        'akun': akun,
        'tercetak': {
            'income': tercetak(r'TOTAL INCOME'),
            'cogs': tercetak(r'TOTAL COST OF SALES'),
            'expenses': tercetak(r'TOTAL EXPENSES'),
            'otherExpenses': tercetak(r'TOTAL OTHER EXPENSES'),
            'net': tercetak(r'NET PROFIT'),
        },
    }


def periksa(d):
    """Membandingkan hasil baca dengan total yang tercetak di laporan.

    Mengembalikan daftar keterangan yang tidak cocok; kosong berarti aman.
    """
    jumlah = {'income': 0.0, 'cogs': 0.0, 'expenses': 0.0, 'otherExpenses': 0.0}
    for a in d['akun']:
        awal = a['kode'][0]
        if awal == '4':
            jumlah['income'] += a['nilai']
        elif awal == '5':
            jumlah['cogs'] += a['nilai']
        elif awal == '6':
            jumlah['expenses'] += a['nilai']
        elif awal == '8':
            jumlah['otherExpenses'] += a['nilai']
    jumlah['net'] = (jumlah['income'] - jumlah['cogs']
                     - jumlah['expenses'] - jumlah['otherExpenses'])

    salah = []
    for kunci, label in [('income', 'TOTAL INCOME'), ('cogs', 'TOTAL COST OF SALES'),
                         ('expenses', 'TOTAL EXPENSES'),
                         ('otherExpenses', 'TOTAL OTHER EXPENSES'),
                         ('net', 'NET PROFIT')]:
        cetak = d['tercetak'].get(kunci)
        if cetak is None:
            # Laporan boleh tidak memuat kelompok yang nilainya nol.
            if abs(jumlah[kunci]) > 0.5:
                salah.append(f'{label}: terbaca {jumlah[kunci]:,.2f} '
                             'tetapi totalnya tidak ada di laporan')
            continue
        if abs(jumlah[kunci] - cetak) > 0.5:
            salah.append(f'{label}: terbaca {jumlah[kunci]:,.2f}, '
                         f'tercetak {cetak:,.2f}, '
                         f'selisih {jumlah[kunci] - cetak:,.2f}')
    return jumlah, salah


def main(argv):
    berkas = [a for a in argv if not a.startswith('--')]
    keluar = next((a.split('=', 1)[1] for a in argv if a.startswith('--keluar=')), None)
    if not berkas:
        raise SystemExit(__doc__)

    hasil, gagal = [], []
    for path in berkas:
        for d in baca_berkas(path):
            jumlah, salah = periksa(d)
            label = f"{NAMA_BULAN[d['bulan']]} {d['tahun']}"
            print(f"{label:<18} {len(d['akun']):>3} akun   "
                  f"pendapatan {jumlah['income']:>16,.2f}   "
                  f"beban {jumlah['expenses'] + jumlah['cogs'] + jumlah['otherExpenses']:>16,.2f}   "
                  f"laba {jumlah['net']:>16,.2f}   "
                  f"{'COCOK' if not salah else 'TIDAK COCOK'}")
            for s in salah:
                print(f"    ! {s}")
                gagal.append(f'{label}: {s}')
            hasil.append(d)

    if gagal:
        raise SystemExit('\nPembacaan dihentikan: hasil baca tidak sama dengan '
                         'total yang tercetak di laporan. Angka seperti ini tidak '
                         'boleh masuk ke pembukuan.')

    # Satu periode tidak boleh terbaca dua kali — mis. kalau dua berkas yang
    # dikirim ternyata memuat bulan yang sama. Kalau dibiarkan, angkanya
    # tercatat dobel.
    kembar = {}
    for d in hasil:
        kembar.setdefault((d['tahun'], d['bulan']), []).append(d.get('berkas', '?'))
    ganda = {k: v for k, v in kembar.items() if len(v) > 1}
    if ganda:
        for (tahun, bulan), asal in sorted(ganda.items()):
            print(f"    ! {NAMA_BULAN[bulan]} {tahun} terbaca {len(asal)} kali "
                  f"(dari {', '.join(sorted(set(asal)))})")
        raise SystemExit('\nAda periode yang terbaca lebih dari sekali. Pisahkan '
                         'berkasnya supaya tiap bulan hanya dibaca satu kali.')

    hasil.sort(key=lambda d: (d['tahun'], d['bulan']))
    if keluar:
        with open(keluar, 'w') as f:
            json.dump(hasil, f, indent=1, ensure_ascii=False)
        print(f'\n{len(hasil)} laporan -> {keluar}')
    else:
        print('\nSemua cocok. Tambahkan --keluar=data/pnl.json untuk menyimpan hasilnya.')


if __name__ == '__main__':
    main(sys.argv[1:])
