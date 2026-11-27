'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { hapusUserLevel, setelLevelPengguna, simpanUserLevel, type ActionState } from '@/app/actions';
import { AKSI_MASTER, KATALOG_HAK, LABEL_AKSI_MASTER } from '@/lib/hak-akses';
import { DialogTombol } from './dialog';

const initial: ActionState = { ok: false, message: '' };

function Simpan({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary">
      {pending ? 'Menyimpan…' : label}
    </button>
  );
}

/** Kotak centang yang bisa setengah tercentang — untuk "pilih semua" sebagian. */
function CentangInduk({ semua, sebagian, onChange, label }: {
  semua: boolean; sebagian: boolean; onChange: (centang: boolean) => void; label: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (ref.current) ref.current.indeterminate = sebagian && !semua; }, [semua, sebagian]);
  return (
    <input
      ref={ref}
      type="checkbox"
      aria-label={label}
      checked={semua}
      onChange={(e) => onChange(e.target.checked)}
      className="h-4 w-4 rounded border-slate-300"
    />
  );
}

/**
 * Formulir user level: nama, keterangan, dan hak akses — satu tab per menu,
 * dikelompokkan per sub menu, dengan "pilih semua" per tab dan per sub menu.
 *
 * Centangnya disimpan di state, bukan di kotak centangnya sendiri: tab yang
 * tidak sedang dibuka tidak dirender, dan hak di tab itu tetap harus ikut
 * terkirim. Yang dikirim adalah isian tersembunyi untuk setiap hak terpilih.
 */
export function UserLevelForm({
  nilai, onTutup,
}: {
  nilai?: { id: string; name: string; description: string | null; hak: string[] };
  onTutup?: () => void;
}) {
  const [state, action] = useActionState(
    async (prev: ActionState, data: FormData) => {
      const hasil = await simpanUserLevel(prev, data);
      if (hasil.ok && onTutup) onTutup();
      return hasil;
    },
    initial,
  );
  const awalan = nilai ? `ul-${nilai.id}` : 'ul-baru';
  const [dipilih, setDipilih] = useState<Set<string>>(() => new Set(nilai?.hak ?? []));
  const [tab, setTab] = useState(0);
  const modul = KATALOG_HAK[tab];

  // Hak master: tambah/ubah/hapus tidak ada artinya tanpa lihat — halamannya
  // tidak bisa dibuka. Mencentang salah satunya ikut mencentang lihat, dan
  // melepas lihat ikut melepas ketiganya.
  const setel = (kode: readonly string[], centang: boolean) => setDipilih((lama) => {
    const baru = new Set(lama);
    for (const k of kode) {
      const m = /^(master\.[a-z_]+)\.(lihat|tambah|ubah|hapus)$/.exec(k);
      if (centang) {
        baru.add(k);
        if (m && m[2] !== 'lihat') baru.add(`${m[1]}.lihat`);
      } else {
        baru.delete(k);
        if (m && m[2] === 'lihat') for (const a of AKSI_MASTER) baru.delete(`${m[1]}.${a}`);
      }
    }
    return baru;
  });
  const jumlahDi = (kode: readonly string[]) => kode.filter((k) => dipilih.has(k)).length;

  const kodeTab = modul.hak.map((h) => h.kode);
  const kelompok = modul.hak.reduce<{ sub: string; hak: (typeof modul.hak)[number][] }[]>((acc, h) => {
    const akhir = acc[acc.length - 1];
    if (akhir && akhir.sub === h.sub) akhir.hak.push(h);
    else acc.push({ sub: h.sub, hak: [h] });
    return acc;
  }, []);

  return (
    <form action={action} className="space-y-4">
      {nilai && <input type="hidden" name="id" value={nilai.id} />}
      {[...dipilih].map((k) => <input key={k} type="hidden" name="hak" value={k} />)}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor={`${awalan}-nama`}>Nama user level</label>
          <input id={`${awalan}-nama`} name="name" className="input" defaultValue={nilai?.name}
            placeholder="Misalnya: Manajer Keuangan" required />
        </div>
        <div>
          <label className="label" htmlFor={`${awalan}-ket`}>Keterangan</label>
          <input id={`${awalan}-ket`} name="description" className="input" defaultValue={nilai?.description ?? ''}
            placeholder="Opsional, mis. menyetujui dana proyek" />
        </div>
      </div>

      <div>
        {/* Satu tab per menu, dengan jumlah hak yang sudah dicentang. */}
        <div role="tablist" className="flex gap-1 overflow-x-auto border-b border-slate-200">
          {KATALOG_HAK.map((m, i) => {
            const n = jumlahDi(m.hak.map((h) => h.kode));
            return (
              <button
                key={m.modul}
                type="button"
                role="tab"
                aria-selected={i === tab}
                onClick={() => setTab(i)}
                className={`-mb-px whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium uppercase tracking-wide ${
                  i === tab ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                {m.modul}
                <span className={`ml-2 rounded-full px-1.5 py-0.5 text-[11px] normal-case ${n > 0 ? 'bg-brand-100 text-brand-800' : 'bg-slate-100 text-slate-500'}`}>
                  {n}/{m.hak.length}
                </span>
              </button>
            );
          })}
        </div>

        <div role="tabpanel" className="max-h-[50vh] space-y-3 overflow-y-auto rounded-b-lg bg-slate-50 p-3">
          <label className="flex items-center gap-3 rounded-md bg-white px-4 py-3 shadow-sm">
            <CentangInduk
              label={`Pilih semua ${modul.modul}`}
              semua={jumlahDi(kodeTab) === kodeTab.length}
              sebagian={jumlahDi(kodeTab) > 0}
              onChange={(c) => setel(kodeTab, c)}
            />
            <span className="font-medium text-slate-900">Pilih semua</span>
            <span className="ml-auto text-xs text-slate-500">{jumlahDi(kodeTab)} dari {kodeTab.length} hak {modul.modul}</span>
          </label>

          {modul.hak.every((h) => h.aksi) ? (
            /* Menu master: satu baris per menu, satu kolom per hak — 36 hak
               dalam satu tabel ringkas, bukan daftar panjang. */
            <div className="overflow-x-auto rounded-md bg-white shadow-sm">
              <table className="w-full min-w-[560px] text-sm">
                <thead className="border-b border-slate-200 bg-slate-50/60">
                  <tr>
                    <th className="th">Menu</th>
                    {AKSI_MASTER.map((a) => {
                      const kodeKolom = modul.hak.filter((h) => h.aksi === a).map((h) => h.kode);
                      return (
                        <th key={a} className="th text-center">
                          <label className="inline-flex flex-col items-center gap-1">
                            <span>{LABEL_AKSI_MASTER[a]}</span>
                            <CentangInduk
                              label={`${LABEL_AKSI_MASTER[a]} semua menu`}
                              semua={jumlahDi(kodeKolom) === kodeKolom.length}
                              sebagian={jumlahDi(kodeKolom) > 0}
                              onChange={(c) => setel(kodeKolom, c)}
                            />
                          </label>
                        </th>
                      );
                    })}
                    <th className="th text-center">Semua</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {kelompok.map((g) => {
                    const kodeSub = g.hak.map((h) => h.kode);
                    return (
                      <tr key={g.sub} className="hover:bg-slate-50">
                        <td className="td font-medium text-slate-900">{g.sub}</td>
                        {AKSI_MASTER.map((a) => {
                          const h = g.hak.find((x) => x.aksi === a);
                          return (
                            <td key={a} className="td text-center">
                              {h && (
                                <input
                                  type="checkbox"
                                  aria-label={h.label}
                                  title={h.keterangan}
                                  checked={dipilih.has(h.kode)}
                                  onChange={(e) => setel([h.kode], e.target.checked)}
                                  className="h-4 w-4 rounded border-slate-300"
                                />
                              )}
                            </td>
                          );
                        })}
                        <td className="td text-center">
                          <CentangInduk
                            label={`Semua hak ${g.sub}`}
                            semua={jumlahDi(kodeSub) === kodeSub.length}
                            sebagian={jumlahDi(kodeSub) > 0}
                            onChange={(c) => setel(kodeSub, c)}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : kelompok.map((g) => {
            const kodeSub = g.hak.map((h) => h.kode);
            return (
              <div key={g.sub} className="overflow-hidden rounded-md bg-white shadow-sm">
                <label className="flex items-center gap-3 border-b border-slate-100 bg-slate-50/60 px-4 py-2">
                  <CentangInduk
                    label={`Pilih semua ${g.sub}`}
                    semua={jumlahDi(kodeSub) === kodeSub.length}
                    sebagian={jumlahDi(kodeSub) > 0}
                    onChange={(c) => setel(kodeSub, c)}
                  />
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">{g.sub}</span>
                </label>
                {g.hak.map((h) => (
                  <label key={h.kode} className="flex items-start gap-3 border-b border-slate-100 px-4 py-3 last:border-0 hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={dipilih.has(h.kode)}
                      onChange={(e) => setel([h.kode], e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm text-slate-900">{h.label}</span>
                      <span className="block text-xs text-slate-500">{h.keterangan}</span>
                    </span>
                    <span className="hidden shrink-0 text-xs text-slate-400 sm:block">{g.sub}</span>
                  </label>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-4">
        {state.message && (
          <p className={`mr-auto text-sm ${state.ok ? 'text-emerald-700' : 'text-red-600'}`}>{state.message}</p>
        )}
        {onTutup && <button type="button" className="btn-secondary" onClick={onTutup}>Batal</button>}
        <Simpan label={nilai ? 'Simpan perubahan' : 'Simpan'} />
      </div>
    </form>
  );
}

export function TambahUserLevelDialog() {
  return (
    <DialogTombol label="Tambah user level" lebar="lg" judul="Tambah user level"
      keterangan="Centang apa saja yang boleh dilakukan pengguna di level ini. Hak dikelompokkan per menu dan sub menu.">
      {(tutup) => <UserLevelForm onTutup={tutup} />}
    </DialogTombol>
  );
}

export function UbahUserLevelDialog({ nilai }: { nilai: { id: string; name: string; description: string | null; hak: string[] } }) {
  return (
    <DialogTombol label="Ubah" varian="tautan" lebar="lg" judul={`Ubah ${nilai.name}`}
      keterangan="Perubahan hak akses langsung berlaku bagi semua pengguna di level ini.">
      {(tutup) => <UserLevelForm nilai={nilai} onTutup={tutup} />}
    </DialogTombol>
  );
}

export function HapusUserLevel({ id, nama }: { id: string; nama: string }) {
  const [state, action] = useActionState(hapusUserLevel, initial);
  const [yakin, setYakin] = useState(false);
  return (
    <span className="inline-flex flex-wrap items-center gap-2 text-xs">
      {yakin ? (
        <form action={action} className="inline-flex items-center gap-2">
          <input type="hidden" name="id" value={id} />
          <span className="text-slate-600">Hapus {nama}?</span>
          <button type="submit" className="font-medium text-red-600 hover:underline">Ya</button>
          <button type="button" className="text-slate-500 hover:underline" onClick={() => setYakin(false)}>Batal</button>
        </form>
      ) : (
        <button type="button" className="font-medium text-red-600 hover:underline" onClick={() => setYakin(true)}>Hapus</button>
      )}
      {!state.ok && state.message && <span className="block text-red-600">{state.message}</span>}
    </span>
  );
}

/**
 * Pilihan user level seorang pengguna, tersimpan begitu diganti. Dikendalikan
 * dan dikirim langsung — bukan lewat form action — karena React mengosongkan
 * formulir setelah aksinya selesai, dan pilihan yang baru disimpan akan
 * terlihat kembali ke semula.
 */
export function SetelLevel({
  id, levelId, levels,
}: {
  id: string;
  levelId: string | null;
  levels: { id: string; name: string }[];
}) {
  const [nilai, setNilai] = useState(levelId ?? '');
  const [state, setState] = useState<ActionState>(initial);
  const [sibuk, setSibuk] = useState(false);
  return (
    <span className="block">
      <select
        aria-label="User level"
        className="input py-1 text-sm"
        value={nilai}
        disabled={sibuk}
        onChange={async (e) => {
          const baru = e.target.value;
          const lama = nilai;
          setNilai(baru);
          setSibuk(true);
          const data = new FormData();
          data.set('id', id);
          data.set('levelId', baru);
          const hasil = await setelLevelPengguna(initial, data);
          setSibuk(false);
          setState(hasil);
          if (!hasil.ok) setNilai(lama);
        }}
      >
        <option value="">— Tanpa level (akses penuh) —</option>
        {levels.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
      </select>
      {state.message && (
        <span className={`mt-1 block text-[11px] ${state.ok ? 'text-emerald-700' : 'text-red-600'}`}>{state.message}</span>
      )}
    </span>
  );
}
