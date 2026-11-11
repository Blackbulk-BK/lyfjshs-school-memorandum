import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { supabase, fileUrl } from '@/lib/supabase';
import type { Memo } from '@/lib/types';
import { formatDate } from '@/lib/format';
import FilePreview from '@/components/FilePreview';
import ShareButtons from '@/components/ShareButtons';
import EmailShare from '@/components/EmailShare';

export const dynamic = 'force-dynamic';

async function getMemo(id: string): Promise<Memo | null> {
  const { data } = await supabase.from('memorandums').select('*').eq('id', id).maybeSingle();
  return (data as Memo) ?? null;
}

// Makes the Facebook share show the memo title
export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const memo = await getMemo(params.id);
  if (!memo) return { title: 'Not found' };
  const title = `${memo.memo_no} — ${memo.title}`;
  return { title, openGraph: { title, description: 'Luis Y. Ferrer Jr. Senior High School — School Memorandum' } };
}

export default async function MemoPage({ params }: { params: { id: string } }) {
  const memo = await getMemo(params.id);
  if (!memo) notFound();

  const url = fileUrl(memo.file_path);

  return (
    <>
      <p><a href="/">← Back to list</a></p>
      <h2 className="page-title" style={{ fontSize: 26 }}>{memo.memo_no}</h2>
      <p><strong>{memo.title}</strong></p>
      <p className="meta">{formatDate(memo.memo_date)}</p>

      <div className="actions">
        <a className="btn" href={url} download={memo.file_name} target="_blank" rel="noreferrer">Download file</a>
      </div>

      <ShareButtons />
      <EmailShare memoId={memo.id} />

      <FilePreview url={url} name={memo.file_name} type={memo.file_type} />
    </>
  );
}