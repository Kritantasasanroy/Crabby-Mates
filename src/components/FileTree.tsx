import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { File, FilePlus, Trash2 } from "lucide-react";

export type RFile = { id: string; path: string; language: string };

export function FileTree({
  files, activeId, onPick, onCreate, onDelete, canEdit, canDelete,
}: {
  files: RFile[];
  activeId: string | null;
  onPick: (id: string) => void;
  onCreate: (path: string) => void;
  onDelete: (id: string) => void;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) { onCreate(name.trim()); setName(""); setAdding(false); }
  };
  return (
    <div className="h-full flex flex-col">
      <div className="p-2 border-b border-border/60 flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">Shell Storage</span>
        {canEdit && (
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setAdding(true)}>
            <FilePlus className="h-4 w-4" />
          </Button>
        )}
      </div>
      {adding && (
        <form onSubmit={submit} className="p-2 border-b border-border/60">
          <Input autoFocus value={name} onChange={(e) => setName(e.target.value)}
            placeholder="src/index.js" onBlur={() => setAdding(false)} />
        </form>
      )}
      <div className="flex-1 overflow-y-auto p-1">
        {files.length === 0 && <p className="text-xs text-muted-foreground p-3">No files. Create one!</p>}
        {files.map((f) => (
          <div key={f.id}
            className={`group flex items-center gap-2 px-2 py-1 rounded text-sm cursor-pointer ${
              activeId === f.id ? "bg-primary/20 text-foreground" : "hover:bg-muted/40 text-muted-foreground"
            }`}
            onClick={() => onPick(f.id)}>
            <File className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate flex-1">{f.path}</span>
            {canDelete && (
              <button onClick={(e) => { e.stopPropagation(); if (confirm(`Delete ${f.path}?`)) onDelete(f.id); }}
                className="opacity-0 group-hover:opacity-100 hover:text-destructive">
                <Trash2 className="h-3 w-3" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}