'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAdmin } from '@/lib/useAdmin';
import type { Recipient } from '@/lib/types';

// Only visible to the logged-in uploader (admin).
export default function EmailShare({ memoId }: { memoId: string }) {
  const admin = useAdmin();
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  async function loadRecipients() {
    const { data } = await supabase.from('share_recipients').select('*').order('created_at');
    setRecipients((data as Recipient[]) ?? []);
  }

  useEffect(() => {
    if (admin === 'yes') loadRecipients();
  }, [admin]);

  if (admin !== 'yes') return null;

  async function addRecipient() {
    setMsg('');
    const email = newEmail.trim().toLowerCase();
    if (!email) return;
    const { error } = await supabase.from('share_recipients').insert({ name: newName.trim() || null, email });
    if (error) return setMsg(error.message);
    setNewName('');
    setNewEmail('');
    loadRecipients();
  }

  async function removeRecipient(r: Recipient) {
    await supabase.from('share_recipients').delete().eq('id', r.id);
    setSelected((s) => s.filter((e) => e !== r.email));
    loadRecipients();
  }

  function toggle(email: string) {
    setSelected((s) => (s.includes(email) ? s.filter((e) => e !== email) : [...s, email]));
  }

  async function send() {
    setBusy(true);
    setMsg('');
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch('/api/send-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token ?? ''}`,
      },
      body: JSON.stringify({ memoId, recipients: selected }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    setMsg(res.ok ? `Sent to ${json.sent} email(s).` : json.error ?? 'Failed to send.');
  }

  return (
    <div className="card">
      <h3>Share by email</h3>
      <p>This is always sent to the school's built-in email. Tick anyone else to include:</p>

      {recipients.map((r) => (
        <div className="recipient" key={r.id}>
          <input type="checkbox" checked={selected.includes(r.email)} onChange={() => toggle(r.email)} />
          <span>{r.name ? `${r.name} — ` : ''}{r.email}</span>
          <button className="btn danger" onClick={() => removeRecipient(r)}>Remove</button>
        </div>
      ))}

      <div className="form-row" style={{ marginTop: 12 }}>
        <input placeholder="Name (optional)" value={newName} onChange={(e) => setNewName(e.target.value)} />
        <input placeholder="Email address" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
        <div><button className="btn gray" onClick={addRecipient}>Add person</button></div>
      </div>

      <button className="btn green" onClick={send} disabled={busy}>
        {busy ? 'Sending…' : 'Send email'}
      </button>
      {msg && <p className="msg">{msg}</p>}
    </div>
  );
}
