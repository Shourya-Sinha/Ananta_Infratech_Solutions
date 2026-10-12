import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Eye, Globe, Save, Send, Undo2 } from "lucide-react";
import { CMS_SECTIONS } from "@/features/cms/schema";
import { cmsKeys, discardCmsDraft, publishCmsDraft, saveCmsDraft, useCmsState } from "@/features/cms/api";
import { SectionEditor } from "@/features/cms/SectionEditor";
import { PreviewPane } from "@/features/cms/PreviewPane";
import { InquiriesPanel } from "@/features/cms/InquiriesPanel";
import { useToast } from "@/components/ui/Toast";
import { formatDateTime } from "@/lib/format";
import { cx } from "@/lib/format";

/** JSON with sorted keys, so two equal drafts always compare equal. */
function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function CmsPage() {
  const [tab, setTab] = useState("editor");
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-xl font-semibold text-graphite-900">Website CMS</h1>
          <p className="text-sm text-graphite-500">Edit the public website, preview changes side by side, then publish.</p>
        </div>
        <div className="flex rounded-sm border border-steel-200 bg-white p-1">
          {[
            { id: "editor", label: "Content editor", icon: Eye },
            { id: "enquiries", label: "Website enquiries", icon: Globe }
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              aria-pressed={tab === t.id}
              className={cx("flex items-center gap-2 rounded-sm px-3.5 py-2 text-sm font-semibold", tab === t.id ? "bg-amber-50 text-amber-600" : "text-graphite-500 hover:text-graphite-900")}>
              <t.icon size={15} /> {t.label}
            </button>
          ))}
        </div>
      </div>
      {tab === "editor" ? <CmsEditor /> : <InquiriesPanel />}
    </div>
  );
}

function CmsEditor() {
  const { data, isLoading, error } = useCmsState();
  const qc = useQueryClient();
  const toast = useToast();
  const [draft, setDraft] = useState(null);
  const [savedKey, setSavedKey] = useState("");
  const [sectionId, setSectionId] = useState(CMS_SECTIONS[0].id);

  // First load: take the server draft as the working copy.
  useEffect(() => {
    if (data && draft === null) {
      setDraft(data.draft);
      setSavedKey(stableStringify(data.draft));
    }
  }, [data, draft]);

  const dirty = draft !== null && stableStringify(draft) !== savedKey;
  const hasUnpublished = Boolean(data?.hasUnpublishedChanges) || dirty;

  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const syncFromServer = (state) => {
    qc.setQueryData(cmsKeys.state, state);
    setDraft(state.draft);
    setSavedKey(stableStringify(state.draft));
  };

  const save = useMutation({
    mutationFn: async () => {
      const sentKey = stableStringify(draft);
      const state = await saveCmsDraft(draft);
      return { state, sentKey };
    },
    onSuccess: ({ state, sentKey }) => {
      qc.setQueryData(cmsKeys.state, state);
      setSavedKey(sentKey);
      toast.success("Draft saved. The preview is up to date.");
    },
    onError: (err) => toast.error(err.message)
  });

  const publish = useMutation({
    mutationFn: async () => {
      if (dirty) await saveCmsDraft(draft);
      return publishCmsDraft();
    },
    onSuccess: (state) => {
      syncFromServer(state);
      toast.success("Website published. Changes are live.");
    },
    onError: (err) => toast.error(err.message)
  });

  const discard = useMutation({
    mutationFn: discardCmsDraft,
    onSuccess: (state) => {
      syncFromServer(state);
      toast.success("Draft reset to the live version.");
    },
    onError: (err) => toast.error(err.message)
  });

  const section = useMemo(() => CMS_SECTIONS.find((s) => s.id === sectionId) || CMS_SECTIONS[0], [sectionId]);

  if (isLoading) return <p className="text-sm text-graphite-500">Loading website content…</p>;
  if (error) {
    return (
      <div className="card p-6 text-sm text-rust">
        Could not load website content: {error.message}
      </div>
    );
  }
  if (!draft) return null;

  const busy = save.isPending || publish.isPending || discard.isPending;
  const status = dirty
    ? { label: "Unsaved changes", cls: "bg-amber-50 text-amber-600" }
    : hasUnpublished
      ? { label: "Draft saved — not published", cls: "bg-teal-50 text-teal" }
      : { label: "Live — no pending changes", cls: "bg-steel-100 text-graphite-700" };

  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className={cx("rounded-sm px-2.5 py-1 text-xs font-semibold", status.cls)}>{status.label}</span>
          <span className="text-xs text-graphite-500">
            {data.publishedAt ? `Last published ${formatDateTime(data.publishedAt)}` : "Never published — the website shows built-in defaults"}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-ghost text-sm"
            disabled={busy || !hasUnpublished}
            onClick={() => {
              if (window.confirm("Discard your draft and reset it to the live version? Unpublished edits will be lost.")) discard.mutate();
            }}>
            <Undo2 size={15} /> Discard draft
          </button>
          <button type="button" className="btn-ghost text-sm" disabled={busy || !dirty} onClick={() => save.mutate()}>
            <Save size={15} /> {save.isPending ? "Saving…" : "Save draft"}
          </button>
          <button
            type="button"
            className="btn-accent text-sm"
            disabled={busy || (!hasUnpublished && data.published)}
            onClick={() => {
              if (window.confirm("Publish these changes to the live website now?")) publish.mutate();
            }}>
            <Send size={15} /> {publish.isPending ? "Publishing…" : "Publish to live site"}
          </button>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[200px_minmax(0,1fr)_minmax(0,1.05fr)]">
        <nav aria-label="CMS sections" className="card h-fit p-2 xl:sticky xl:top-4">
          {CMS_SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSectionId(s.id)}
              aria-current={s.id === sectionId ? "true" : undefined}
              className={cx(
                "flex w-full items-center rounded-sm px-3 py-2 text-left text-sm font-medium",
                s.id === sectionId ? "bg-amber-50 text-amber-600 shadow-[inset_3px_0_0_0_#C97A1F]" : "text-graphite-700 hover:bg-steel-100"
              )}>
              {s.label}
            </button>
          ))}
        </nav>

        <div className="card min-w-0 p-6">
          <h2 className="font-display text-lg font-semibold text-graphite-900">{section.label}</h2>
          <p className="mb-6 mt-1 text-sm text-graphite-500">{section.description}</p>
          <SectionEditor
            key={section.id}
            section={section}
            value={draft[section.id]}
            onChange={(next) => setDraft((d) => ({ ...d, [section.id]: next }))}
          />
        </div>

        <div className="min-w-0 xl:sticky xl:top-4 xl:self-start">
          <PreviewPane draft={draft} />
        </div>
      </div>
    </div>
  );
}
