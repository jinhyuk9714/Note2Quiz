"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Folder as FolderIcon, FolderPlus, Pencil, Trash2, Files } from "lucide-react";
import { toast } from "sonner";
import type { Folder } from "@/types/api";
import { createFolder, updateFolder, deleteFolder } from "@/lib/api";
import { cn } from "@/lib/utils";
import { FolderManageDialog } from "./FolderManageDialog";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";

interface FolderSidebarProps {
  folders: Folder[];
  selectedFolderId: string | null; // null = all, "none" = uncategorized, uuid = specific
  onSelect: (folderId: string | null) => void;
  totalDocCount: number;
  uncategorizedCount: number;
}

export function FolderSidebar({
  folders,
  selectedFolderId,
  onSelect,
  totalDocCount,
  uncategorizedCount,
}: FolderSidebarProps) {
  const queryClient = useQueryClient();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingFolder, setEditingFolder] = useState<Folder | null>(null);
  const [deletingFolder, setDeletingFolder] = useState<Folder | null>(null);

  const createMutation = useMutation({
    mutationFn: createFolder,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["folders"] });
      void queryClient.invalidateQueries({ queryKey: ["documents"] });
      toast.success("폴더가 생성되었습니다");
      setShowCreateDialog(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }: { id: string; name?: string; color?: string; emoji?: string }) =>
      updateFolder(id, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["folders"] });
      toast.success("폴더가 수정되었습니다");
      setEditingFolder(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteFolder(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["folders"] });
      void queryClient.invalidateQueries({ queryKey: ["documents"] });
      toast.success("폴더가 삭제되었습니다");
      setDeletingFolder(null);
      // If viewing deleted folder, go back to all
      if (deletingFolder && selectedFolderId === deletingFolder.id) {
        onSelect(null);
      }
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden lg:block w-56 shrink-0">
        <div className="sticky top-6 space-y-1">
          <SidebarItem
            label="전체 문서"
            icon={<Files className="h-4 w-4" />}
            count={totalDocCount}
            active={selectedFolderId === null}
            onClick={() => onSelect(null)}
          />

          {folders.map((f) => (
            <SidebarItem
              key={f.id}
              label={f.name}
              icon={
                f.emoji ? (
                  <span className="text-sm">{f.emoji}</span>
                ) : (
                  <FolderIcon className="h-4 w-4" />
                )
              }
              count={f.document_count}
              active={selectedFolderId === f.id}
              onClick={() => onSelect(f.id)}
              color={f.color ?? undefined}
              onEdit={() => setEditingFolder(f)}
              onDelete={() => setDeletingFolder(f)}
            />
          ))}

          <SidebarItem
            label="미분류"
            icon={<FolderIcon className="h-4 w-4 opacity-50" />}
            count={uncategorizedCount}
            active={selectedFolderId === "none"}
            onClick={() => onSelect("none")}
          />

          <button
            onClick={() => setShowCreateDialog(true)}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-400 transition-all hover:bg-indigo-50 hover:text-indigo-600"
          >
            <FolderPlus className="h-4 w-4" />
            새 폴더
          </button>
        </div>
      </div>

      {/* Mobile horizontal tabs */}
      <div className="lg:hidden flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-none">
        <MobileTab
          label="전체"
          active={selectedFolderId === null}
          onClick={() => onSelect(null)}
          count={totalDocCount}
        />
        {folders.map((f) => (
          <MobileTab
            key={f.id}
            label={f.emoji ? `${f.emoji} ${f.name}` : f.name}
            active={selectedFolderId === f.id}
            onClick={() => onSelect(f.id)}
            count={f.document_count}
            color={f.color ?? undefined}
          />
        ))}
        <MobileTab
          label="미분류"
          active={selectedFolderId === "none"}
          onClick={() => onSelect("none")}
          count={uncategorizedCount}
        />
        <button
          onClick={() => setShowCreateDialog(true)}
          className="shrink-0 flex items-center gap-1.5 rounded-xl border-2 border-dashed border-slate-200 px-3 py-2 text-xs font-bold text-slate-400 transition-all hover:border-indigo-300 hover:text-indigo-600"
        >
          <FolderPlus className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Create dialog */}
      <FolderManageDialog
        open={showCreateDialog}
        onSave={(data) => createMutation.mutate(data)}
        onCancel={() => setShowCreateDialog(false)}
        loading={createMutation.isPending}
        title="새 폴더"
      />

      {/* Edit dialog */}
      <FolderManageDialog
        open={editingFolder !== null}
        onSave={(data) =>
          editingFolder && updateMutation.mutate({ id: editingFolder.id, ...data })
        }
        onCancel={() => setEditingFolder(null)}
        loading={updateMutation.isPending}
        initial={
          editingFolder
            ? { name: editingFolder.name, color: editingFolder.color, emoji: editingFolder.emoji }
            : undefined
        }
        title="폴더 수정"
      />

      {/* Delete confirm */}
      <ConfirmDialog
        open={deletingFolder !== null}
        onConfirm={() => deletingFolder && deleteMutation.mutate(deletingFolder.id)}
        onCancel={() => setDeletingFolder(null)}
        title="폴더 삭제"
        description={`"${deletingFolder?.name}" 폴더를 삭제하시겠습니까? 폴더 안의 문서는 삭제되지 않고 미분류로 이동합니다.`}
        loading={deleteMutation.isPending}
      />
    </>
  );
}

function SidebarItem({
  label,
  icon,
  count,
  active,
  onClick,
  color,
  onEdit,
  onDelete,
}: {
  label: string;
  icon: React.ReactNode;
  count: number;
  active: boolean;
  onClick: () => void;
  color?: string;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  return (
    <div className="group relative">
      <button
        onClick={onClick}
        className={cn(
          "flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
          active
            ? "bg-indigo-50 text-indigo-700 font-bold"
            : "text-slate-600 hover:bg-slate-50",
        )}
      >
        <span
          className={cn(
            "flex h-6 w-6 items-center justify-center rounded-lg",
            active ? "text-indigo-600" : "text-slate-400",
          )}
          style={color ? { color } : undefined}
        >
          {icon}
        </span>
        <span className="truncate flex-1 text-left">{label}</span>
        <span
          className={cn(
            "text-[11px] font-bold",
            active ? "text-indigo-500" : "text-slate-400",
          )}
        >
          {count}
        </span>
      </button>

      {(onEdit || onDelete) && (
        <div className="absolute right-1 top-1/2 -translate-y-1/2 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          {onEdit && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              className="flex h-6 w-6 items-center justify-center rounded-md text-slate-300 hover:bg-slate-100 hover:text-slate-500 transition-all"
            >
              <Pencil className="h-3 w-3" />
            </button>
          )}
          {onDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="flex h-6 w-6 items-center justify-center rounded-md text-slate-300 hover:bg-red-50 hover:text-red-500 transition-all"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function MobileTab({
  label,
  active,
  onClick,
  count,
  color,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  count: number;
  color?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "shrink-0 flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition-all whitespace-nowrap",
        active
          ? "bg-indigo-600 text-white shadow-lg"
          : "bg-white text-slate-600 ring-1 ring-inset ring-slate-200 hover:bg-slate-50",
      )}
      style={!active && color ? { borderColor: color } : undefined}
    >
      {label}
      <span
        className={cn(
          "text-[10px] font-bold",
          active ? "text-white/70" : "text-slate-400",
        )}
      >
        {count}
      </span>
    </button>
  );
}
