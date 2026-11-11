import { supabase } from '@/lib/supabase';
import type { Memo } from '@/lib/types';
import MemoTable from '@/components/MemoTable';
import SearchBar from '@/components/SearchBar';

export const dynamic = 'force-dynamic';

export default async function Home({ searchParams }: { searchParams: { q?: string } }) {
  // strip characters that would break the filter syntax
  const q = (searchParams.q ?? '').replace(/[%,()*\\]/g, ' ').trim();

  let query = supabase.from('memorandums').select('*').order('memo_date', { ascending: false });
  if (q) query = query.or(`title.ilike.%${q}%,memo_no.ilike.%${q}%`);

  const { data } = await query;

  return (
    <>
      <h2 className="page-title">School Memorandum</h2>
      <div className="panel">
        <div className="panel-top">
          <SearchBar defaultValue={q} />
        </div>
        <MemoTable memos={(data as Memo[]) ?? []} />
      </div>
    </>
  );
}