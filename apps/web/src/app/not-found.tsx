import Link from "next/link";
import { Brain, ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-6 text-center">
      <div className="relative mb-10">
        <p className="text-[10rem] font-black leading-none text-slate-200 select-none">404</p>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-indigo-600 text-white shadow-2xl shadow-indigo-200 ring-4 ring-white animate-bounce">
            <Brain className="h-10 w-10" />
          </div>
        </div>
      </div>
      
      <h1 className="text-3xl font-black tracking-tight text-slate-900">
        길을 잃으셨나요?
      </h1>
      <p className="mt-3 text-lg font-medium text-slate-500 max-w-sm">
        요청하신 페이지가 존재하지 않거나 새로운 곳으로 이동되었습니다.
      </p>
      
      <Link
        href="/"
        className="group mt-10 inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-8 py-4 text-sm font-bold text-white shadow-xl transition-all hover:bg-slate-800 active:scale-95"
      >
        <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
        대시보드로 안전하게 돌아가기
      </Link>
    </div>
  );
}
