"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { listDocuments } from "@/lib/api";
import { DocumentUploadForm } from "@/components/documents/DocumentUploadForm";
import { DocumentCard } from "@/components/documents/DocumentCard";

export default function DocumentsPage() {
  const router = useRouter();

  const { data: documents } = useQuery({
    queryKey: ["documents"],
    queryFn: listDocuments,
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">문서 관리</h1>

      <DocumentUploadForm />

      {documents && documents.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">업로드된 문서</h2>
          {documents.map((doc) => (
            <DocumentCard
              key={doc.id}
              document={doc}
              onSelect={(id) => router.push(`/quiz/generate?document_id=${id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
