import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-50 text-center">
      <p className="text-6xl font-bold text-indigo-200">404</p>
      <h1 className="text-xl font-semibold text-gray-800">
        페이지를 찾을 수 없습니다
      </h1>
      <p className="text-sm text-gray-500">
        요청하신 페이지가 존재하지 않거나 이동되었습니다.
      </p>
      <Link
        href="/"
        className="mt-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
      >
        대시보드로 돌아가기
      </Link>
    </div>
  );
}
