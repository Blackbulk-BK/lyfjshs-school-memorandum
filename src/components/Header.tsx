import Link from 'next/link';

export default function Header() {
  return (
    <header className="site-header">
      <Link href="/">
        {/* Put your school logo at /public/logo.png */}
        <img src="/logo.png" alt="School logo" />
      </Link>
      <h1>Luis Y. Ferrer Jr. Senior High School — School Memorandum</h1>
    </header>
  );
}