import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <main className="min-h-[80vh] flex items-center justify-center px-5 py-10">
      <div className="text-center max-w-sm w-full">
        <p className="text-5xl font-bold text-accent mb-2">404</p>
        <h1 className="text-xl font-bold text-neutral-900">페이지를 찾을 수 없어요</h1>
        <p className="text-sm text-neutral-500 mt-1">
          주소를 다시 확인하거나 홈으로 돌아가세요.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex h-12 items-center justify-center px-5 rounded-xl bg-accent text-white font-semibold active:scale-95"
        >
          홈으로 돌아가기
        </Link>
      </div>
    </main>
  );
}
