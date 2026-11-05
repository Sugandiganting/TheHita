'use client';

import { useActionState, useEffect, useMemo, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import {
  buatKategoriCepat, buatSatuanCepat, buatSubKategoriCepat,
  hapusKategoriBarang, hapusSatuan, hapusSubKategori, setelAktifItem, simpanItem,
  simpanKategoriBarang, simpanSatuan, simpanSubKategori,
  type ActionState, type PilihanBaru,
} from '@/app/actions';
import { SearchableSelect, type PickerOption } from './searchable-select';

const initial: ActionState = { ok: false, message: '' };

export type Pilihan = { id: string; code: string; name: string };
export type Sub = Pilihan & { categoryId: string };

/** Kode dicari sekaligus dengan namanya, jadi keduanya masuk ke pilihan. */
function opsi(daftar: Pilihan[]): PickerOption[] {
  return daftar.map((d) => ({ value: d.id, code: d.code, label: d.name }));
}

function Tombol({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? 'Menyimpan…' : label}
    </button>
  );
}

function Pesan({ state }: { state: ActionState }) {
  if (!state.message) return null;
  return (
    <p className={`mt-2 rounded-md px-3 py-2 text-sm ${
      state.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
    }`}>
      {state.message}
    </p>
  );
}

/** Tombol hapus dua langkah: sekali untuk bertanya, sekali untuk sungguhan. */
function Hapus({
  id, aksi, tanya,
}: {
  id: string;
  aksi: (p: ActionState, f: FormData) => Promise<ActionState>;
  tanya: string;
}) {
  const [state, action] = useActionState(aksi, initial);
  const [yakin, setYakin] = useState(false);

  if (!state.ok && state.message) {
    return <span className="text-[11px] text-red-600">{state.message}</span>;
  }
  if (!yakin) {
    return (
      <button type="button" className="text-xs font-medium text-red-600 hover:underline"
        onClick={() => setYakin(true)}>
        Hapus
      </button>
    );
  }
  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <span className="text-[11px] text-slate-500">{tanya}</span>
      <button type="submit" className="text-xs font-medium text-red-600 hover:underline">Ya</button>
      <button type="button" className="text-xs text-slate-500 hover:underline"
        onClick={() => setYakin(false)}>Batal</button>
    </form>
  );
}

/* ---------------------------------------------------------------- klasifikasi */

export function FormSatuan() {
  const [state, action] = useActionState(simpanSatuan, initial);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2" key={state.ok ? state.message : 'isi'}>
      <div className="w-28">
        <label className="label" htmlFor="sat-code">Kode</label>
        <input id="sat-code" name="code" className="input font-mono" placeholder="KG" required />
      </div>
      <div className="min-w-[10rem] flex-1">
        <label className="label" htmlFor="sat-name">Nama</label>
        <input id="sat-name" name="name" className="input" placeholder="Kilogram" required />
      </div>
      <Tombol label="Tambah" />
      <div className="w-full"><Pesan state={state} /></div>
    </form>
  );
}

export function HapusSatuan({ id, kode }: { id: string; kode: string }) {
  return <Hapus id={id} aksi={hapusSatuan} tanya={`Hapus satuan ${kode}?`} />;
}

export function FormKategori() {
  const [state, action] = useActionState(simpanKategoriBarang, initial);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2" key={state.ok ? state.message : 'isi'}>
      <div className="w-32">
        <label className="label" htmlFor="kat-code">Kode</label>
        <input id="kat-code" name="code" className="input font-mono" placeholder="OPEX" required />
      </div>
      <div className="min-w-[10rem] flex-1">
        <label className="label" htmlFor="kat-name">Nama</label>
        <input id="kat-name" name="name" className="input" placeholder="Operasional" required />
      </div>
      <Tombol label="Tambah" />
      <div className="w-full"><Pesan state={state} /></div>
    </form>
  );
}

export function HapusKategori({ id, kode }: { id: string; kode: string }) {
  return <Hapus id={id} aksi={hapusKategoriBarang} tanya={`Hapus kategori ${kode}?`} />;
}

export function FormSubKategori({ kategori }: { kategori: Pilihan[] }) {
  const [state, action] = useActionState(simpanSubKategori, initial);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2" key={state.ok ? state.message : 'isi'}>
      <div className="min-w-[14rem] flex-1">
        <label className="label" htmlFor="sub-kat">Kategori induk</label>
        <SearchableSelect
          id="sub-kat"
          name="categoryId"
          options={opsi(kategori)}
          required
          placeholder="— Pilih kategori —"
          searchPlaceholder="Ketik kode atau nama kategori…"
        />
      </div>
      <div className="w-32">
        <label className="label" htmlFor="sub-code">Kode</label>
        <input id="sub-code" name="code" className="input font-mono" placeholder="CHEM" required />
      </div>
      <div className="min-w-[10rem] flex-1">
        <label className="label" htmlFor="sub-name">Nama</label>
        <input id="sub-name" name="name" className="input" placeholder="Chemical" required />
      </div>
      <Tombol label="Tambah" />
      <div className="w-full"><Pesan state={state} /></div>
    </form>
  );
}

export function HapusSubKategori({ id, kode }: { id: string; kode: string }) {
  return <Hapus id={id} aksi={hapusSubKategori} tanya={`Hapus sub kategori ${kode}?`} />;
}

/* ----------------------------------------------------------------- item */

/* ------------------------------------------------- tambah cepat di tempat */

/** Menggabungkan daftar dari server dengan yang baru dibuat di layar ini. */
function gabung<T extends Pilihan>(dasar: T[], tambahan: T[]): T[] {
  const peta = new Map(dasar.map((d) => [d.id, d]));
  for (const t of tambahan) peta.set(t.id, t);
  return [...peta.values()].sort((a, b) => a.code.localeCompare(b.code));
}

/**
 * Kolom pilihan dengan tombol "Baru" di sebelah labelnya.
 *
 * Panelnya bukan <form> tersendiri: ia hidup di dalam formulir barang, dan
 * form di dalam form tidak sah di HTML — tombolnya akan menyimpan barang,
 * bukan kategorinya. Jadi aksinya dipanggil langsung dari penangan klik.
 */
function PilihAtauBuat({
  id,
  name,
  label,
  noun,
  options,
  value,
  onChange,
  required,
  disabled,
  placeholder,
  bisaBuat,
  alasanTakBisaBuat,
  buat,
  contohKode,
  contohNama,
}: {
  id: string;
  name: string;
  label: string;
  noun: string;
  options: PickerOption[];
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  disabled?: boolean;
  placeholder: string;
  bisaBuat: boolean;
  alasanTakBisaBuat?: string;
  buat: (code: string, name: string) => Promise<PilihanBaru>;
  contohKode: string;
  contohNama: string;
}) {
  const [buka, setBuka] = useState(false);
  const [kode, setKode] = useState('');
  const [nama, setNama] = useState('');
  const [pesan, setPesan] = useState('');
  const [sibuk, setSibuk] = useState(false);
  const kodeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (buka) kodeRef.current?.focus();
  }, [buka]);

  const simpan = async () => {
    setSibuk(true);
    setPesan('');
    try {
      const hasil = await buat(kode, nama);
      if (!hasil.ok) {
        setPesan(hasil.message);
        return;
      }
      onChange(hasil.item.id);
      setBuka(false);
      setKode('');
      setNama('');
    } finally {
      setSibuk(false);
    }
  };

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <label className="label" htmlFor={id}>{label}</label>
        {bisaBuat ? (
          <button
            type="button"
            className="text-xs font-medium text-brand-600 hover:underline"
            onClick={() => { setBuka((v) => !v); setPesan(''); }}
          >
            {buka ? 'Batal' : '+ Baru'}
          </button>
        ) : (
          alasanTakBisaBuat && <span className="text-[11px] text-slate-400">{alasanTakBisaBuat}</span>
        )}
      </div>

      <SearchableSelect
        id={id}
        name={name}
        options={options}
        value={value}
        onChange={onChange}
        required={required}
        disabled={disabled}
        placeholder={placeholder}
        searchPlaceholder={`Ketik kode atau nama ${noun}…`}
        noun={noun}
      />

      {buka && (
        <div className="mt-2 rounded-md border border-brand-200 bg-brand-50/60 p-2">
          <div className="flex gap-2">
            <input
              ref={kodeRef}
              className="input w-24 font-mono"
              placeholder={contohKode}
              value={kode}
              onChange={(e) => setKode(e.target.value)}
              aria-label={`Kode ${noun} baru`}
              autoCapitalize="off"
              spellCheck={false}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void simpan(); } }}
            />
            <input
              className="input min-w-0 flex-1"
              placeholder={contohNama}
              value={nama}
              onChange={(e) => setNama(e.target.value)}
              aria-label={`Nama ${noun} baru`}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void simpan(); } }}
            />
            <button
              type="button"
              className="btn-primary shrink-0 px-3 py-1.5 text-sm"
              disabled={sibuk}
              onClick={() => void simpan()}
            >
              {sibuk ? '…' : 'Simpan'}
            </button>
          </div>
          {pesan && <p className="mt-1.5 text-xs text-red-700">{pesan}</p>}
          {!pesan && (
            <p className="mt-1.5 text-[11px] text-slate-500">
              Tersimpan ke master, lalu langsung terpilih di kolom ini.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/* ----------------------------------------------------------------- item */

export function FormItem({
  kategori, sub, satuan, akun, onTutup,
}: {
  kategori: Pilihan[];
  sub: Sub[];
  satuan: Pilihan[];
  akun: Pilihan[];
  /** Ditampilkan sebagai tombol tutup bila formulir ini berada di dalam dialog. */
  onTutup?: () => void;
}) {
  const [state, action] = useActionState(simpanItem, initial);
  const [kat, setKat] = useState('');
  const [subTerpilih, setSubTerpilih] = useState('');
  const [sat, setSat] = useState('');

  // Yang dibuat lewat tombol "Baru" disimpan terpisah lalu digabung, bukan
  // menimpa daftar dari server. Dengan begitu daftar yang disegarkan server
  // tetap mengalir masuk, dan yang baru dibuat tidak hilang saat itu terjadi.
  const [katBaru, setKatBaru] = useState<Pilihan[]>([]);
  const [subBaru, setSubBaru] = useState<Sub[]>([]);
  const [satBaru, setSatBaru] = useState<Pilihan[]>([]);

  const semuaKategori = useMemo(() => gabung(kategori, katBaru), [kategori, katBaru]);
  const semuaSatuan = useMemo(() => gabung(satuan, satBaru), [satuan, satBaru]);
  const semuaSub = useMemo(() => gabung(sub, subBaru), [sub, subBaru]);

  // Sub kategori milik kategori lain akan menghasilkan barang yang terbaca di
  // dua tempat sekaligus, jadi daftarnya disempitkan — bukan hanya ditolak
  // setelah disimpan.
  const subTersedia = useMemo(() => semuaSub.filter((s) => s.categoryId === kat), [semuaSub, kat]);

  // Tanpa ini, sub kategori yang sudah terpilih tetap terkirim setelah
  // kategorinya diganti — dan yang tersimpan bukan yang terbaca di layar.
  const gantiKategori = (v: string) => {
    setKat(v);
    setSubTerpilih('');
  };

  /*
   * Dikosongkan sendiri setelah tersimpan.
   *
   * Kode, nama dan akun sudah kosong dengan sendirinya karena `key` pada
   * <form> melahirkan ulang isinya.
   * Kategori, sub kategori dan satuan tidak: ketiganya terkendali oleh state
   * di sini, yang hidup di luar form itu.
   * Membiarkannya terisi memang menghemat dua klik saat mendaftarkan beberapa
   * barang sekaligus, tetapi sub kategori yang tertinggal dari barang
   * sebelumnya akan ikut tersimpan pada barang berikutnya tanpa ada yang
   * terlihat salah — dan itu harganya jauh lebih mahal daripada dua klik.
   */
  useEffect(() => {
    if (!state.ok) return;
    setKat('');
    setSubTerpilih('');
    setSat('');
  }, [state]);

  /*
   * Pilihan "tanpa sub kategori" ikut masuk daftar, bukan dibiarkan sebagai
   * keadaan kosong yang hanya bisa dicapai dengan tidak menyentuh kolomnya.
   * Begitu seseorang sudah memilih satu sub kategori, tanpa pilihan ini ia
   * tidak punya cara membatalkannya lagi.
   */
  const opsiSub: PickerOption[] = useMemo(
    () => [{ value: '', code: '—', label: 'Tanpa sub kategori' }, ...opsi(subTersedia)],
    [subTersedia],
  );

  return (
    <form action={action} className="space-y-3" key={state.ok ? state.message : 'isi'}>
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="it-code">Kode barang</label>
          <input id="it-code" name="code" className="input font-mono" placeholder="CHEM-01"
            autoCapitalize="off" spellCheck={false} required />
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="it-name">Nama barang</label>
          <input id="it-name" name="name" className="input" placeholder="Chemical Lantai" required />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <PilihAtauBuat
          id="it-kat"
          name="categoryId"
          label="Kategori"
          noun="kategori"
          options={opsi(semuaKategori)}
          value={kat}
          onChange={gantiKategori}
          required
          placeholder="— Pilih kategori —"
          bisaBuat
          buat={async (code, nama) => {
            const hasil = await buatKategoriCepat(code, nama);
            if (hasil.ok) setKatBaru((d) => [...d, hasil.item]);
            return hasil;
          }}
          contohKode="OPEX"
          contohNama="Operasional"
        />

        <PilihAtauBuat
          id="it-sub"
          name="subCategoryId"
          label="Sub kategori"
          noun="sub kategori"
          options={opsiSub}
          value={subTerpilih}
          onChange={setSubTerpilih}
          disabled={!kat}
          placeholder="— Tanpa sub kategori —"
          bisaBuat={Boolean(kat)}
          alasanTakBisaBuat="pilih kategorinya dulu"
          buat={async (code, nama) => {
            const hasil = await buatSubKategoriCepat(kat, code, nama);
            if (hasil.ok) setSubBaru((d) => [...d, { ...hasil.item, categoryId: kat }]);
            return hasil;
          }}
          contohKode="CHEM"
          contohNama="Chemical"
        />

        <PilihAtauBuat
          id="it-sat"
          name="unitId"
          label="Satuan"
          noun="satuan"
          options={opsi(semuaSatuan)}
          value={sat}
          onChange={setSat}
          required
          placeholder="— Pilih satuan —"
          bisaBuat
          buat={async (code, nama) => {
            const hasil = await buatSatuanCepat(code, nama);
            if (hasil.ok) setSatBaru((d) => [...d, hasil.item]);
            return hasil;
          }}
          contohKode="SAK"
          contohNama="Sak 50 kg"
        />

        <div>
          <label className="label" htmlFor="it-akun">Akun COA</label>
          <SearchableSelect
            id="it-akun"
            name="accountId"
            options={opsi(akun)}
            required
            placeholder="— Pilih akun —"
            searchPlaceholder="Ketik nomor atau nama akun…"
          />
          <p className="mt-1 text-xs text-slate-500">
            Penyusun RAB cukup memilih barangnya; akun inilah yang mengikuti.
          </p>
        </div>
      </div>

      <p className="text-xs text-slate-500">
        Kode dan nama hanya perlu unik di dalam kategorinya — barang yang sama boleh didaftarkan
        lagi di kategori lain dengan akun COA yang berbeda.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <Tombol label="Simpan barang" />
        {onTutup && (
          <button type="button" className="btn-secondary" onClick={onTutup}>Tutup</button>
        )}
      </div>
      <Pesan state={state} />
    </form>
  );
}

export function AktifItem({ id, kode, aktif }: { id: string; kode: string; aktif: boolean }) {
  const [state, action] = useActionState(setelAktifItem, initial);
  return (
    <form action={action} className="inline">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="aktif" value={aktif ? 'false' : 'true'} />
      <button type="submit" className={`text-xs font-medium hover:underline ${
        aktif ? 'text-red-600' : 'text-emerald-700'
      }`}>
        {aktif ? 'Nonaktifkan' : 'Aktifkan'}
      </button>
      <span className="sr-only">{kode}</span>
      {!state.ok && state.message && (
        <span className="mt-1 block text-[11px] text-red-600">{state.message}</span>
      )}
    </form>
  );
}
