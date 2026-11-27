import { deleteCostItem } from '@/app/actions';
import { formatDate, formatRupiah, toDateInput } from '@/lib/format';
import {
  LABEL_REALISASI_ITEM, hargaSatuanItem, qtyTerealisasi, rekapHematProyek, rekapRealisasiItem,
} from '@/lib/proyek';
import { CostItemAccount, RealisasiItemDialog, UbahItemProyekDialog } from './cost-item-form';
import { Badge } from './ui';

export type ItemProyekTabel = {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number | null;
  amount: number;
  plannedDate: Date;
  paid: boolean;
  done: boolean;
  accountId: string | null;
  account: { code: string; name: string } | null;
  pembayaran: { id: string; date: Date; amount: number; quantity: number | null; note: string | null }[];
};

/**
 * Tabel item biaya proyek — dipakai untuk rencana awal maupun tiap pengajuan
 * tambahan. Kolom realisasi baru muncul bila realisasinya dibuka; tombol ubah
 * dan hapus hanya bila itemnya masih boleh diubah.
 */
export function TabelItemProyek({
  items, accounts, realisasi, bolehUbah, bolehRealisasi = true, hariIni,
}: {
  items: ItemProyekTabel[];
  accounts: { id: string; code: string; name: string }[];
  /** Tampilkan kolom realisasi, selisih, status, dan tombol Realisasi. */
  realisasi: boolean;
  /** Tampilkan tombol Ubah dan Hapus. */
  bolehUbah: boolean;
  /** Pengguna ini boleh mencatat realisasi: tombol Realisasi ditampilkan. */
  bolehRealisasi?: boolean;
  /** "YYYY-MM-DD", tanggal bawaan pembayaran. */
  hariIni: string;
}) {
  const baris = items.map((i) => ({
    ...i, real: rekapRealisasiItem(i, i.pembayaran), qtyDibeli: qtyTerealisasi(i.pembayaran),
  }));
  const total = baris.reduce((s, i) => s + i.amount, 0);
  const dibayar = baris.reduce((s, i) => s + i.real.realisasi, 0);
  const hemat = rekapHematProyek(items).bersih;
  const adaAksi = (realisasi && bolehRealisasi) || bolehUbah;

  return (
    <div className="overflow-x-auto">
      <table className={`w-full ${realisasi ? 'min-w-[900px]' : 'min-w-[620px]'}`}>
        <thead className="border-b border-slate-200">
          <tr>
            <th className="th">Item</th>
            <th className="th">Jadwal bayar</th>
            <th className="th num">Qty</th>
            <th className="th num">Harga satuan</th>
            <th className="th num">Total</th>
            {realisasi && <th className="th num">Realisasi</th>}
            {realisasi && <th className="th num">Selisih</th>}
            {realisasi && <th className="th">Status</th>}
            {adaAksi && <th className="th num">Aksi</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {baris.map((item) => (
            <tr key={item.id} className={realisasi && item.real.selesai ? 'text-slate-500' : ''}>
              <td className="td">
                <span className="font-medium text-slate-900">{item.name}</span>
                {/* Akunnya di bawah nama, supaya kolom realisasi muat. */}
                <span className="mt-0.5 block text-xs text-slate-500">
                  {item.account
                    ? `${item.account.code} ${item.account.name}`
                    : <CostItemAccount id={item.id} accounts={accounts} />}
                </span>
              </td>
              <td className="td whitespace-nowrap">{formatDate(item.plannedDate)}</td>
              <td className="td num">{item.quantity.toLocaleString('id-ID')}</td>
              <td className="td num whitespace-nowrap">{formatRupiah(hargaSatuanItem(item))}</td>
              <td className="td num whitespace-nowrap font-medium">{formatRupiah(item.amount)}</td>
              {realisasi && (
                <>
                  <td className="td num whitespace-nowrap">
                    {item.real.realisasi > 0 ? formatRupiah(item.real.realisasi) : <span className="text-slate-400">—</span>}
                    {item.qtyDibeli !== null && (
                      <span className="block text-[11px] text-slate-500">
                        {item.qtyDibeli.toLocaleString('id-ID')} dari {item.quantity.toLocaleString('id-ID')} qty
                      </span>
                    )}
                    {item.pembayaran.length > 1 && (
                      <span className="block text-[11px] text-slate-400">{item.pembayaran.length} kali bayar</span>
                    )}
                    {item.real.dariLunasLama && (
                      <span className="block text-[11px] text-slate-400">dari tanda Lunas lama</span>
                    )}
                  </td>
                  <td className="td num whitespace-nowrap">
                    {item.real.selisih === null || item.real.selisih === 0 ? (
                      item.real.selisih === 0 ? <span className="text-slate-400">pas</span>
                        : <span className="text-[11px] text-slate-400">sisa {formatRupiah(item.real.sisaAkanKeluar)}</span>
                    ) : item.real.selisih > 0 ? (
                      <span className="text-emerald-700">hemat {formatRupiah(item.real.selisih)}</span>
                    ) : (
                      <span className="text-red-600">lebih {formatRupiah(-item.real.selisih)}</span>
                    )}
                  </td>
                  <td className="td">
                    <Badge tone={item.real.status === 'SELESAI' ? 'green' : item.real.status === 'SEBAGIAN' ? 'blue' : 'amber'}>
                      {LABEL_REALISASI_ITEM[item.real.status]}
                    </Badge>
                  </td>
                </>
              )}
              {adaAksi && (
                <td className="td">
                  <span className="flex items-center justify-end gap-3">
                    {realisasi && bolehRealisasi && (
                      <RealisasiItemDialog
                        itemId={item.id}
                        nama={item.name}
                        total={item.amount}
                        qtyRencana={item.quantity}
                        hargaSatuan={hargaSatuanItem(item)}
                        realisasi={item.real.realisasi}
                        selesai={item.real.selesai}
                        tanggalBawaan={hariIni}
                        pembayaran={item.pembayaran.map((p) => ({
                          id: p.id, tanggal: formatDate(p.date), amount: p.amount, quantity: p.quantity, note: p.note,
                        }))}
                      />
                    )}
                    {bolehUbah && (
                      <>
                        <UbahItemProyekDialog
                          accounts={accounts}
                          nilai={{
                            id: item.id,
                            name: item.name,
                            quantity: item.quantity,
                            unitPrice: hargaSatuanItem(item),
                            plannedDate: toDateInput(item.plannedDate),
                            accountId: item.accountId,
                          }}
                        />
                        <form action={deleteCostItem}>
                          <input type="hidden" name="id" value={item.id} />
                          <button type="submit" className="text-xs text-slate-400 hover:text-red-600">
                            Hapus
                          </button>
                        </form>
                      </>
                    )}
                  </span>
                </td>
              )}
            </tr>
          ))}
        </tbody>
        <tfoot className="border-t-2 border-slate-200 font-semibold">
          <tr>
            <td className="td" colSpan={4}>Total</td>
            <td className="td num whitespace-nowrap">{formatRupiah(total)}</td>
            {realisasi && <td className="td num whitespace-nowrap">{formatRupiah(dibayar)}</td>}
            {realisasi && (
              <td className="td num whitespace-nowrap">
                {hemat > 0 ? <span className="text-emerald-700">hemat {formatRupiah(hemat)}</span>
                  : hemat < 0 ? <span className="text-red-600">lebih {formatRupiah(-hemat)}</span>
                    : '—'}
              </td>
            )}
            {realisasi && <td className="td" />}
            {adaAksi && <td className="td" />}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
