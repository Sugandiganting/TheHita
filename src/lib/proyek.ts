/**
 * Item biaya proyek: jumlah × harga satuan = total.
 *
 * Totalnya yang disimpan dan dipakai peramalan serta rencana kas, karena
 * itulah uang yang akan keluar. Jumlah dan harga satuan disimpan di
 * sebelahnya supaya totalnya bisa ditelusuri dan diubah selama proyek berjalan.
 */

const bulat = (n: number) => Math.round(n * 100) / 100;

/** Total item: jumlah × harga satuan, dibulatkan ke sen. */
export function totalItemProyek(jumlah: number, hargaSatuan: number): number {
  return bulat(jumlah * hargaSatuan);
}

/**
 * Harga satuan yang ditampilkan. Item lama — dibuat sebelum ada jumlah dan
 * harga satuan — hanya punya nominal, jadi harganya nominal dibagi jumlahnya
 * (jumlahnya 1, jadi sama dengan nominalnya).
 */
export function hargaSatuanItem(item: { quantity: number; unitPrice: number | null; amount: number }): number {
  if (item.unitPrice !== null) return item.unitPrice;
  return item.quantity > 0 ? bulat(item.amount / item.quantity) : item.amount;
}

/** Jumlah dari isian: boleh pecahan dengan koma atau titik ("1,5" atau "1.5"). */
export function bacaJumlah(teks: string): number {
  const n = Number(String(teks).trim().replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}
