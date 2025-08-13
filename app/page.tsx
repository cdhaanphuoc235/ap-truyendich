import Link from 'next/link';

export default function Home() {
  return (
    <div className="container py-5">
      <h3>AP - Truyendich</h3>
      <p>Vui lòng <Link href="/login">đăng nhập</Link> để tiếp tục.</p>
    </div>
  );
}
