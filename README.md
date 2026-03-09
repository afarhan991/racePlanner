# Ultra Race Planner MVP

MVP web buat planning ultra trail race.

## Fitur v1
- Upload GPX
- Override distance / elevation kalau GPX belum ada
- Dynamic COP / checkpoint cutoff (opsional, bisa lebih dari satu)
- Target finish time vs total cutoff
- Output split, ETA, buffer cutoff
- Fueling & hydration baseline dengan source classification
- GAP / effort pace metric buat baca effort trail lebih fair
- Data classification: official vs guideline vs model estimate
- Source policy panel + metric source chips buat pondasi standard engine
- UI premium-style buat arah produk komersial
- Placeholder unreleased feature buat versi berbayar

## Cara pakai
1. Buka `index.html` di browser.
2. Upload GPX atau isi distance/elevation override.
3. Isi target finish + COT total.
4. Tambah checkpoint opsional.
5. Klik **Generate plan**.

## Catatan
- Ini masih MVP, belum pakai source engine penuh / segment technical analysis.
- Fueling output masih guideline-level, belum individualized.
- Estimasi pacing masih heuristik dan harus divalidasi lagi di versi lanjut.
