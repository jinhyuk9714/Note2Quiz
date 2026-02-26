"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FolderInput } from "lucide-react";
import { toast } from "sonner";
import { listFolders, moveDocumentToFolder } from "@/lib/api";
import { cn } from "@/lib/utils";

interface FolderMoveDropdownProps {
  documentId: string;
  currentFolderId: string | null;
}

export function FolderMoveDropdown({ documentId, currentFolderId }: FolderMoveDropdownProps) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { data: folders } = useQuery({
    queryKey: ["folders"],
    queryFn: listFolders,
    enabled: open,
  });

  const mutation = useMutation({
    mutationFn: (folderId: string | null) =>
      moveDocumentToFolder(documentId, { folder_id: folderId }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["documents"] });
      void queryClient.invalidateQueries({ queryKey: ["folders"] });
      toast.success("폴더가 변경되었습니다");
      setOpen(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen(!open);
        }}
        className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-50 text-slate-400 transition-all hover:bg-indigo-50 hover:text-indigo-600 disabled:opacity-50"
        title="폴더 이동"
      >
        <FolderInput className="h-4 w-4" />
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-1 z-20 w-48 rounded-xl border border-slate-200 bg-white py-1 shadow-lg animate-in fade-in zoom-in-95 duration-150"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => mutation.mutate(null)}
            disabled={mutation.isPending || currentFolderId === null}
            className={cn(
              "flex w-full items-center gap-2 px-3 py-2 text-xs font-medium transition-colors",
              currentFolderId === null
                ? "bg-indigo-50 text-indigo-700 font-bold"
                : "text-slate-600 hover:bg-slate-50",
            )}
          >
            미분류
          </button>

          {folders?.map((f) => (
            <button
              key={f.id}
              onClick={() => mutation.mutate(f.id)}
              disabled={mutation.isPending || currentFolderId === f.id}
              className={cn(
                "flex w-full items-center gap-2 px-3 py-2 text-xs font-medium transition-colors",
                currentFolderId === f.id
                  ? "bg-indigo-50 text-indigo-700 font-bold"
                  : "text-slate-600 hover:bg-slate-50",
              )}
            >
              {f.emoji && <span>{f.emoji}</span>}
              <span
                className="h-2 w-2 rounded-full shrink-0"
                style={{ backgroundColor: f.color ?? "#94a3b8" }}
              />
              <span className="truncate">{f.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
