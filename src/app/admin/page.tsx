'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase, BUCKET } from '@/lib/supabase';
import { useAdmin } from '@/lib/useAdmin';
import { formatDate } from '@/lib/format';
import type { Memo } from '@/lib/types';
import UploadForm from '@/components/UploadForm';

export default function AdminPage() {
  const router = useRouter();
  const admin = useAdmin();
  const [memos, setMemos] = useState<Memo[]>([]);

  const load = useCallback(async () => {
    const { data } = await supabase.from('memorandums').select('*').order('memo_date', { ascending: false });
    setMemos((data as Memo[]) ?? []);
  }, []);

  useEffect(() => {
    if (admin === 'no') router.replace('/login');
    if (admin === 'yes') load();
  }, [admin, router, load]);

  async function remove(m: Memo) {
    if (!confirm(`Delete ${m.memo_no}?`)) return;
    await supabase.storage.from(BUCKET).remove([m.file_path]);
    await supabase.from('memorandums').delete().eq('id', m.id);
    load();
  }

  async function logout() {
    await supabase.auth.signOut();
    router.replace('/login');
  }

  if (admin !== 'yes') return <p>Loading…</p>;

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 className="page-title">Uploader</h2>
        <button className="btn gray" onClick={logout}>Log out</button>
      </div>

      <UploadForm onDone={load} />

      <h3>Uploaded memorandums</h3>
      <div className="panel">
        <table>
          <thead>
            <tr><th>School Memorandum</th><th>Title</th><th className="date">Date</th><th></th></tr>
          </thead>
          <tbody>
            {memos.map((m) => (
              <tr key={m.id}>
                <td><Link href={`/memo/${m.id}`}>{m.memo_no}</Link></td>
                <td>{m.title}</td>
                <td className="date">{formatDate(m.memo_date)}</td>
                <td><button className="btn danger" onClick={() => remove(m)}>Delete</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}