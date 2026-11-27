import { Alert, PageHeader } from './ui';

/** Ditampilkan sebagai ganti halaman yang tidak boleh dibuka user level ini. */
export function TanpaAkses({ nama }: { nama: string }) {
  return (
    <>
      <PageHeader title={nama} />
      <Alert tone="warning" title="Tidak punya akses">
        User level Anda tidak punya hak &ldquo;Lihat {nama}&rdquo;. Minta pengelola pengguna menambahkannya di
        Master Data › User Level.
      </Alert>
    </>
  );
}
