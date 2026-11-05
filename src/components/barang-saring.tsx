'use client';

import { SearchableSelect } from './searchable-select';
import type { Pilihan } from './barang-form';

/**
 * Saringan kategori di daftar barang.
 *
 * Dipisah jadi komponen klien sendiri karena SearchableSelect mengirim nilainya
 * lewat input tersembunyi — jadi ia tetap bekerja di dalam formulir GET biasa,
 * dan halamannya tidak perlu menjadi klien seluruhnya.
 */
export function SaringKategori({ kategori, terpilih }: { kategori: Pilihan[]; terpilih: string }) {
  return (
    <SearchableSelect
      id="f-kat"
      name="kategori"
      options={[
        { value: '', code: '—', label: 'Semua kategori' },
        ...kategori.map((k) => ({ value: k.id, code: k.code, label: k.name })),
      ]}
      defaultValue={terpilih}
      placeholder="— Semua kategori —"
      searchPlaceholder="Ketik kode atau nama kategori…"
    />
  );
}
