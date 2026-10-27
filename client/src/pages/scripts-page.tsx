import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";
import type { Script } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Plus,
  Play,
  FileText,
  Trash2,
  Settings,
  Upload,
  Mic,
  MonitorPlay,
  Hash,
  Type,
  Gauge,
  FileDown,
  RefreshCw,
  Link,
  Loader2,
  LogOut,
  GripVertical,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

function SortableScriptCard({
  script,
  index,
  onPlay,
  onEdit,
  onDelete,
}: {
  script: Script;
  index: number;
  onPlay: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: script.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <Card
        className="bg-white/5 border-white/10 p-4"
        data-testid={`card-script-${script.id}`}
      >
        <div className="flex items-start justify-between gap-2">
          <button
            {...attributes}
            {...listeners}
            className="mt-1 text-white/20 hover:text-white/50 cursor-grab active:cursor-grabbing touch-none shrink-0"
            data-testid={`button-drag-${script.id}`}
            aria-label="Arrastar para reordenar"
          >
            <GripVertical className="h-5 w-5" />
          </button>
          <div className="flex-1 min-w-0 cursor-pointer" onClick={onPlay}>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center justify-center min-w-[24px] h-5 rounded-md bg-white/10 text-white/40 text-xs font-bold px-1">
                {index + 1}
              </span>
              <h3 className="font-semibold text-white/90 truncate" data-testid={`text-script-title-${script.id}`}>
                {script.title}
              </h3>
            </div>
            <p className="text-sm text-white/40 line-clamp-2 mt-1">
              {script.content.substring(0, 120)}...
            </p>
            <div className="flex items-center gap-3 mt-2 text-xs text-white/30">
              <span className="flex items-center gap-1">
                <Type className="h-3 w-3" />
                {script.fontSize}px
              </span>
              <span className="flex items-center gap-1">
                <Gauge className="h-3 w-3" />
                {script.speed}x
              </span>
              {script.mirrored && (
                <span className="text-emerald-400/60">Espelhado</span>
              )}
              {script.googleDocId && (
                <span className="flex items-center gap-1 text-blue-400/60">
                  <RefreshCw className="h-3 w-3" />
                  Google Docs
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button
              size="icon"
              variant="ghost"
              className="text-emerald-400"
              onClick={onPlay}
              data-testid={`button-play-${script.id}`}
            >
              <Play className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="text-white/40"
              onClick={onEdit}
              data-testid={`button-edit-${script.id}`}
            >
              <FileText className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="text-red-400/60"
              onClick={onDelete}
              data-testid={`button-delete-${script.id}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

export default function ScriptsPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { client, logout } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [gdocsOpen, setGdocsOpen] = useState(false);
  const [editingScript, setEditingScript] = useState<Script | null>(null);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [gdocsUrl, setGdocsUrl] = useState("");
  const [gdocsLoading, setGdocsLoading] = useState(false);
  const [gdocsList, setGdocsList] = useState<Array<{ id: string; title: string }>>([]);
  const [gdocsListLoading, setGdocsListLoading] = useState(false);
  const [fontSize, setFontSize] = useState(48);
  const [speed, setSpeed] = useState(3);
  const [mirrored, setMirrored] = useState(false);

  const [defaultFontSize, setDefaultFontSize] = useState(48);
  const [defaultSpeed, setDefaultSpeed] = useState(3);
  const [defaultMirrored, setDefaultMirrored] = useState(false);
  const [defaultMargin, setDefaultMargin] = useState(5);

  const { data: scripts, isLoading } = useQuery<Script[]>({
    queryKey: ["/api/scripts"],
  });

  const [localScripts, setLocalScripts] = useState<Script[]>([]);
  useEffect(() => {
    if (scripts) setLocalScripts(scripts);
  }, [scripts]);

  const { data: settings } = useQuery({
    queryKey: ["/api/settings"],
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  );

  const reorderMutation = useMutation({
    mutationFn: async (items: { id: number; number: number }[]) => {
      await apiRequest("PATCH", "/api/scripts/reorder", { items });
    },
    onError: () => {
      if (scripts) setLocalScripts(scripts);
      toast({ title: "Erro ao reordenar", variant: "destructive" });
    },
  });

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setLocalScripts((prev) => {
      const oldIndex = prev.findIndex((s) => s.id === active.id);
      const newIndex = prev.findIndex((s) => s.id === over.id);
      const reordered = arrayMove(prev, oldIndex, newIndex);
      reorderMutation.mutate(reordered.map((s, i) => ({ id: s.id, number: i + 1 })));
      return reordered.map((s, i) => ({ ...s, number: i + 1 }));
    });
  }

  const createMutation = useMutation({
    mutationFn: async (data: { title: string; content: string; fontSize: number; speed: number; mirrored: boolean }) => {
      const res = await apiRequest("POST", "/api/scripts", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scripts"] });
      setDialogOpen(false);
      resetForm();
      toast({ title: "Script criado com sucesso" });
    },
    onError: (err: any) => {
      const msg = err.message?.includes("403")
        ? "Limite de uso atingido. Entre em contato com o administrador."
        : "Erro ao criar script";
      toast({ title: msg, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: number; title: string; content: string; fontSize: number; speed: number; mirrored: boolean }) => {
      const res = await apiRequest("PATCH", `/api/scripts/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scripts"] });
      setDialogOpen(false);
      setEditingScript(null);
      resetForm();
      toast({ title: "Script atualizado" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/scripts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scripts"] });
      toast({ title: "Script removido" });
    },
  });

  const saveSettingsMutation = useMutation({
    mutationFn: async (data: { defaultFontSize: number; defaultSpeed: number; defaultMirrored: boolean; defaultMargin?: number }) => {
      const res = await apiRequest("POST", "/api/settings", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      setSettingsOpen(false);
      toast({ title: "Configurações salvas" });
    },
  });

  const resetForm = () => {
    setTitle("");
    setContent("");
    const s = settings as any;
    setFontSize(s?.defaultFontSize || 48);
    setSpeed(s?.defaultSpeed || 3);
    setMirrored(s?.defaultMirrored || false);
  };

  const openNewScript = () => {
    setEditingScript(null);
    resetForm();
    setDialogOpen(true);
  };

  const openEditScript = (script: Script) => {
    setEditingScript(script);
    setTitle(script.title);
    setContent(script.content);
    setFontSize(script.fontSize);
    setSpeed(script.speed);
    setMirrored(script.mirrored);
    setDialogOpen(true);
  };

  const openGdocsDialog = async () => {
    setGdocsUrl("");
    setGdocsOpen(true);
    setGdocsListLoading(true);
    try {
      const res = await fetch("/api/gdocs/list");
      if (res.ok) {
        const docs = await res.json();
        setGdocsList(docs);
      }
    } catch {
      // silently fail listing
    } finally {
      setGdocsListLoading(false);
    }
  };

  const importFromGdocs = async (docId?: string, url?: string) => {
    setGdocsLoading(true);
    try {
      const body: any = {};
      if (docId) body.docId = docId;
      else if (url) body.url = url;
      else {
        toast({ title: "Cole um link do Google Docs", variant: "destructive" });
        setGdocsLoading(false);
        return;
      }

      const res = await apiRequest("POST", "/api/gdocs/import", body);
      const doc = await res.json();

      const createRes = await apiRequest("POST", "/api/scripts", {
        title: doc.title,
        content: doc.content,
        fontSize: (settings as any)?.defaultFontSize || 48,
        speed: (settings as any)?.defaultSpeed || 3,
        mirrored: (settings as any)?.defaultMirrored || false,
        googleDocId: doc.docId,
      });
      await createRes.json();

      queryClient.invalidateQueries({ queryKey: ["/api/scripts"] });
      setGdocsOpen(false);
      toast({ title: "Documento importado do Google Docs" });
    } catch (err: any) {
      let errorMsg = "Erro ao importar documento";
      const msg = err?.message || "";
      if (msg.includes("not found") || msg.includes("Not Found")) {
        errorMsg = "Documento não encontrado. Verifique o link.";
      } else if (msg.includes("Insufficient") || msg.includes("Permission")) {
        errorMsg = "Permissão insuficiente. Reconecte o Google Docs.";
      } else if (msg.includes("not connected") || msg.includes("não está conectado")) {
        errorMsg = "Google Docs não está conectado. Reconecte a integração.";
      } else if (msg.includes("inválido")) {
        errorMsg = "URL ou ID do documento inválido.";
      }
      toast({ title: errorMsg, variant: "destructive" });
    } finally {
      setGdocsLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setContent(text);
      if (!title) {
        setTitle(file.name.replace(/\.[^/.]+$/, ""));
      }
    };
    reader.readAsText(file);
  };

  const handleSubmit = () => {
    if (!title.trim() || !content.trim()) {
      toast({ title: "Preencha o título e o conteúdo", variant: "destructive" });
      return;
    }
    if (editingScript) {
      updateMutation.mutate({ id: editingScript.id, title, content, fontSize, speed, mirrored });
    } else {
      createMutation.mutate({ title, content, fontSize, speed, mirrored });
    }
  };

  const openSettings = () => {
    const s = settings as any;
    setDefaultFontSize(s?.defaultFontSize || 48);
    setDefaultSpeed(s?.defaultSpeed || 3);
    setDefaultMirrored(s?.defaultMirrored || false);
    setDefaultMargin(s?.defaultMargin ?? 5);
    setSettingsOpen(true);
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-black/95 backdrop-blur-sm" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <div className="flex items-center justify-between gap-2 px-4 py-3">
          <div className="flex items-center gap-2">
            <MonitorPlay className="h-6 w-6 text-emerald-400" />
            <div>
              <h1 className="text-lg font-bold tracking-tight leading-none">TelePrompter</h1>
              {client && (
                <p className="text-[10px] text-white/40 leading-tight mt-0.5" data-testid="text-user-name">{client.name}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="icon"
              variant="ghost"
              className="text-white/70"
              onClick={() => logout.mutate()}
              data-testid="button-logout"
            >
              <LogOut className="h-5 w-5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="text-white/70"
              onClick={openSettings}
              data-testid="button-settings"
            >
              <Settings className="h-5 w-5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="text-white/70"
              onClick={openGdocsDialog}
              data-testid="button-gdocs-import"
            >
              <FileDown className="h-5 w-5" />
            </Button>
            {localScripts.length > 1 && (
              <Button
                onClick={() => {
                  const queue = localScripts.map((s) => s.id).join(",");
                  window.location.href = `/teleprompter/${localScripts[0].id}?queue=${queue}&autoplay=1`;
                }}
                className="bg-blue-600 text-white border-blue-700"
                data-testid="button-play-all"
              >
                <Play className="h-4 w-4 mr-1" />
                Todos
              </Button>
            )}
            <Button
              onClick={openNewScript}
              className="bg-emerald-600 text-white border-emerald-700"
              data-testid="button-new-script"
            >
              <Plus className="h-4 w-4 mr-1" />
              Novo
            </Button>
          </div>
        </div>
      </header>

      <main className="p-4 pb-24">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 w-full bg-white/5 rounded-md" />
            ))}
          </div>
        ) : !scripts?.length ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="rounded-full bg-white/5 p-6 mb-6">
              <FileText className="h-12 w-12 text-white/20" />
            </div>
            <h2 className="text-xl font-semibold text-white/80 mb-2">Nenhum script ainda</h2>
            <p className="text-sm text-white/40 mb-6 max-w-xs">
              Crie seu primeiro script ou faça upload de um arquivo de texto para começar
            </p>
            <Button
              onClick={openNewScript}
              className="bg-emerald-600 text-white border-emerald-700"
              data-testid="button-empty-new-script"
            >
              <Plus className="h-4 w-4 mr-1" />
              Criar Script
            </Button>
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={localScripts.map((s) => s.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-3">
                {localScripts.map((script, index) => (
                  <SortableScriptCard
                    key={script.id}
                    script={script}
                    index={index}
                    onPlay={() => navigate(`/teleprompter/${script.id}`)}
                    onEdit={() => openEditScript(script)}
                    onDelete={() => deleteMutation.mutate(script.id)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </main>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-zinc-900 border-white/10 text-white max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">
              {editingScript ? "Editar Script" : "Novo Script"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label className="text-white/70 text-sm">Título</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Nome do script"
                className="bg-white/5 border-white/10 text-white mt-1"
                data-testid="input-script-title"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label className="text-white/70 text-sm">Conteúdo</Label>
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept=".txt,.md,.text"
                    onChange={handleFileUpload}
                    className="hidden"
                    data-testid="input-file-upload"
                  />
                  <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
                    <Upload className="h-3 w-3" />
                    Upload arquivo
                  </span>
                </label>
              </div>
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Cole ou digite seu script aqui..."
                className="bg-white/5 border-white/10 text-white min-h-[200px] mt-1"
                data-testid="input-script-content"
              />
            </div>

            <div className="space-y-4 bg-white/5 rounded-md p-4">
              <h4 className="text-sm font-medium text-white/60 flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Configurações do script
              </h4>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-white/70 text-sm">Tamanho da fonte</Label>
                  <span className="text-sm text-emerald-400 font-mono">{fontSize}px</span>
                </div>
                <Slider
                  value={[fontSize]}
                  onValueChange={([v]) => setFontSize(v)}
                  min={20}
                  max={120}
                  step={2}
                  className="w-full"
                  data-testid="slider-font-size"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-white/70 text-sm">Velocidade</Label>
                  <span className="text-sm text-emerald-400 font-mono">{speed}x</span>
                </div>
                <Slider
                  value={[speed]}
                  onValueChange={([v]) => setSpeed(v)}
                  min={1}
                  max={10}
                  step={1}
                  className="w-full"
                  data-testid="slider-speed"
                />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-white/70 text-sm">Texto espelhado</Label>
                <Switch
                  checked={mirrored}
                  onCheckedChange={setMirrored}
                  data-testid="switch-mirrored"
                />
              </div>
            </div>

            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
              className="w-full bg-emerald-600 text-white border-emerald-700"
              data-testid="button-save-script"
            >
              {createMutation.isPending || updateMutation.isPending ? "Salvando..." : "Salvar Script"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={gdocsOpen} onOpenChange={setGdocsOpen}>
        <DialogContent className="bg-zinc-900 border-white/10 text-white max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">Importar do Google Docs</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label className="text-white/70 text-sm">Cole o link do documento</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  value={gdocsUrl}
                  onChange={(e) => setGdocsUrl(e.target.value)}
                  placeholder="https://docs.google.com/document/d/..."
                  className="bg-white/5 border-white/10 text-white flex-1"
                  data-testid="input-gdocs-url"
                />
                <Button
                  onClick={() => importFromGdocs(undefined, gdocsUrl)}
                  disabled={gdocsLoading || !gdocsUrl.trim()}
                  className="bg-emerald-600 text-white border-emerald-700"
                  data-testid="button-gdocs-import-url"
                >
                  {gdocsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="border-t border-white/10 pt-4">
              <Label className="text-white/70 text-sm mb-2 block">Ou escolha um documento recente</Label>
              {gdocsListLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-10 w-full bg-white/5 rounded-md" />
                  ))}
                </div>
              ) : gdocsList.length === 0 ? (
                <p className="text-sm text-white/30 text-center py-4">Nenhum documento encontrado</p>
              ) : (
                <div className="space-y-1 max-h-[300px] overflow-y-auto">
                  {gdocsList.map((doc) => (
                    <button
                      key={doc.id}
                      className="w-full text-left px-3 py-2.5 rounded-md bg-white/5 text-white/80 text-sm hover-elevate flex items-center gap-2"
                      onClick={() => importFromGdocs(doc.id)}
                      disabled={gdocsLoading}
                      data-testid={`button-gdoc-${doc.id}`}
                    >
                      <FileText className="h-4 w-4 text-blue-400 shrink-0" />
                      <span className="truncate">{doc.title}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="bg-zinc-900 border-white/10 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">Configurações Padrão</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <p className="text-sm text-white/40">
              Defina os valores padrão para novos scripts
            </p>
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-white/70 text-sm">Tamanho da fonte padrão</Label>
                <span className="text-sm text-emerald-400 font-mono">{defaultFontSize}px</span>
              </div>
              <Slider
                value={[defaultFontSize]}
                onValueChange={([v]) => setDefaultFontSize(v)}
                min={20}
                max={120}
                step={2}
                data-testid="slider-default-font-size"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-white/70 text-sm">Velocidade padrão</Label>
                <span className="text-sm text-emerald-400 font-mono">{defaultSpeed}x</span>
              </div>
              <Slider
                value={[defaultSpeed]}
                onValueChange={([v]) => setDefaultSpeed(v)}
                min={1}
                max={10}
                step={1}
                data-testid="slider-default-speed"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-white/70 text-sm">Margem lateral</Label>
                <span className="text-sm text-emerald-400 font-mono">{defaultMargin}%</span>
              </div>
              <Slider
                value={[defaultMargin]}
                onValueChange={([v]) => setDefaultMargin(v)}
                min={0}
                max={30}
                step={1}
                data-testid="slider-default-margin"
              />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-white/70 text-sm">Texto espelhado por padrão</Label>
              <Switch
                checked={defaultMirrored}
                onCheckedChange={setDefaultMirrored}
                data-testid="switch-default-mirrored"
              />
            </div>
            <Button
              onClick={() => saveSettingsMutation.mutate({ defaultFontSize, defaultSpeed, defaultMirrored, defaultMargin })}
              disabled={saveSettingsMutation.isPending}
              className="w-full bg-emerald-600 text-white border-emerald-700"
              data-testid="button-save-settings"
            >
              {saveSettingsMutation.isPending ? "Salvando..." : "Salvar Configurações"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
