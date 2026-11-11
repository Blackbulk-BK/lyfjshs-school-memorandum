export default function SearchBar({ defaultValue = '' }: { defaultValue?: string }) {
  return (
    <form action="/" method="get" className="search">
      <input name="q" defaultValue={defaultValue} placeholder="Search" />
      <button type="submit" aria-label="Search">🔍</button>
    </form>
  );
}
