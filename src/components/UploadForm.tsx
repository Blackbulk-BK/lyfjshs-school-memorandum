'use client';
import { useState } from 'react';
import { supabase, BUCKET } from '@/lib/supabase';

export default function UploadForm({ onDone }: { onDone: () => void }) {
  const [memoNo, setMemoNo] = useState('');
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return setMsg('Please choose a file.');
    setBusy(true);
    setMsg('');

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${Date.now()}-${safeName}`;

    const up = await supabase.storage.from(BUCKET).upload(path, file);
    if (up.error) {
      setBusy(false);
      return setMsg(up.error.message);
    }

    const ins = await supabase.from('memorandums').insert({
      memo_no: memoNo.trim(),
      title: title.trim(),
      memo_date: date,
      file_path: path,
      file_name: file.name,
      file_type: file.type || null,
      file_size: file.size,
    });

    if (ins.error) {
      await supabase.storage.from(BUCKET).remove([path]); // undo the upload
      setBusy(false);
      return setMsg(ins.error.message);
    }

    setBusy(false);
    setMemoNo('');
    setTitle('');
    setDate('');
    setFile(null);
    (e.target as HTMLFormElement).reset();
    setMsg('Uploaded!');
    onDone();
  }

  return (
    <form className="card" onSubmit={submit}>
      <h3>Upload memorandum</h3>
      <div className="form-row">
        <label>School Memorandum (number)</label>
        <input required value={memoNo} onChange={(e) => setMemoNo(e.target.value)} placeholder="SM NO. 001 s. 2026" />
      </div>
      <div className="form-row">
        <label>Title</label>
        <input required value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div className="form-row">
        <label>Date</label>
        <input required type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      <div className="form-row">
        <label>File (PDF, Excel, Word, anything)</label>
        <input required type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      </div>
      <button className="btn" disabled={busy}>{busy ? 'Uploading…' : 'Upload'}</button>
      {msg && <p className="msg">{msg}</p>}
    </form>
  );
}
