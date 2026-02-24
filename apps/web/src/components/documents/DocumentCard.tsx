import type { Document } from "@/types/api";
import { formatDate } from "@/lib/utils";

interface DocumentCardProps {
  document: Document;
  onSelect?: (id: string) => void;
}

export function DocumentCard({ document, onSelect }: DocumentCardProps) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3">
      <div>
        <h3 className="text-sm font-medium">{document.title}</h3>
        <p className="mt-0.5 text-xs text-gray-500">
          {document.char_count.toLocaleString()}자 · {document.chunk_count}개
          청크 · {formatDate(document.created_at)}
        </p>
      </div>

      {onSelect && (
        <button
          onClick={() => onSelect(document.id)}
          className="rounded-md border border-indigo-200 px-3 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50"
        >
          퀴즈 생성
        </button>
      )}
    </div>
  );
}
