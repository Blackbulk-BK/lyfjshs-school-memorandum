import Link from 'next/link';
import type { Memo } from '@/lib/types';
import { formatDate } from '@/lib/format';

export default function MemoTable({ memos }: { memos: Memo[] }) {
  if (memos.length === 0) return <div className="empty">No memorandum found.</div>;

  return (
    <table>
      <thead>
        <tr>
          <th>School Memorandum</th>
          <th>Title</th>
          <th className="date">Date</th>
        </tr>
      </thead>
      <tbody>
        {memos.map((m) => (
          <tr key={m.id}>
            <td><Link href={`/memo/${m.id}`}>{m.memo_no}</Link></td>
            <td>{m.title}</td>
            <td className="date">{formatDate(m.memo_date)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
