import { ArrowDown, ArrowUp, Plus, Trash2, X, Wand2 } from "lucide-react";
import { ICON_NAMES } from "@/features/cms/schema";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function slugify(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function Wrapper({ label, help, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-graphite-900">{label}</span>
      {children}
      {help && <span className="mt-1 block text-xs text-graphite-500">{help}</span>}
    </label>
  );
}

function ScalarField({ field, value, onChange }) {
  const common = { className: "input", value: value ?? "", onChange: (e) => onChange(e.target.value) };
  switch (field.type) {
    case "textarea":
      return (
        <Wrapper label={field.label} help={field.help}>
          <textarea rows={field.rows || 3} {...common} />
        </Wrapper>
      );
    case "bool":
      return (
        <label className="flex items-center gap-3 text-sm font-medium text-graphite-900">
          <input type="checkbox" className="h-4 w-4 accent-amber" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} />
          {field.label}
        </label>
      );
    case "select":
      return (
        <Wrapper label={field.label} help={field.help}>
          <select {...common}>
            {!field.options.includes(value) && <option value={value ?? ""}>{value || "Select…"}</option>}
            {field.options.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </Wrapper>
      );
    case "icon":
      return (
        <Wrapper label={field.label} help={field.help}>
          <select {...common}>
            {ICON_NAMES.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </Wrapper>
      );
    case "date":
      return (
        <Wrapper label={field.label} help={field.help}>
          <input type="date" {...common} />
        </Wrapper>
      );
    case "url":
      return (
        <Wrapper label={field.label} help={field.help || "Path like /contact, or a full https:// link"}>
          <input type="text" spellCheck={false} {...common} />
        </Wrapper>
      );
    default:
      return (
        <Wrapper label={field.label} help={field.help}>
          <input type="text" {...common} />
        </Wrapper>
      );
  }
}

function StringListField({ field, value, onChange }) {
  const items = Array.isArray(value) ? value : [];
  return (
    <div>
      <span className="mb-1.5 block text-sm font-medium text-graphite-900">{field.label}</span>
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="flex gap-2">
            <input
              className="input"
              value={item}
              onChange={(e) => onChange(items.map((x, idx) => (idx === i ? e.target.value : x)))}
            />
            <button type="button" className="btn-ghost px-3" aria-label="Remove item" onClick={() => onChange(items.filter((_, idx) => idx !== i))}>
              <X size={14} />
            </button>
          </div>
        ))}
        <button type="button" className="btn-ghost text-sm" onClick={() => onChange([...items, ""])}>
          <Plus size={14} /> Add item
        </button>
      </div>
    </div>
  );
}

function CollectionField({ field, value, onChange }) {
  const items = Array.isArray(value) ? value : [];
  const hasSlug = field.fields.some((f) => f.key === "slug");
  const hasTitle = field.fields.some((f) => f.key === "title");

  const setItem = (i, next) => onChange(items.map((item, idx) => (idx === i ? next : item)));
  const removeItem = (i) => onChange(items.filter((_, idx) => idx !== i));
  const moveItem = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  const addItem = () => onChange([...items, clone(field.empty ?? {})]);

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-graphite-900">
        {field.label} <span className="font-normal text-graphite-500">({items.length})</span>
      </p>
      {items.map((item, i) => {
        const title = (field.titleKey && item?.[field.titleKey]) || item?.[field.fields[0].key] || `${field.itemLabel} ${i + 1}`;
        return (
          <details key={i} open className="rounded-sm border border-steel-200 bg-white">
            <summary className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-graphite-900">
              <span className="truncate">
                <span className="mr-2 font-mono text-xs text-graphite-500">{String(i + 1).padStart(2, "0")}</span>
                {title || "(untitled)"}
              </span>
            </summary>
            <div className="space-y-4 border-t border-steel-200 p-4">
              {field.fields.map((f) => (
                <FieldRenderer key={f.key} field={f} value={item?.[f.key]} onChange={(v) => setItem(i, { ...item, [f.key]: v })} />
              ))}
              <div className="flex flex-wrap items-center gap-2 border-t border-steel-200 pt-3">
                {hasSlug && hasTitle && (
                  <button type="button" className="btn-ghost text-xs" onClick={() => setItem(i, { ...item, slug: slugify(item.title) })}>
                    <Wand2 size={13} /> Generate slug from title
                  </button>
                )}
                <button type="button" className="btn-ghost text-xs" onClick={() => moveItem(i, -1)} disabled={i === 0} aria-label="Move up">
                  <ArrowUp size={13} /> Up
                </button>
                <button type="button" className="btn-ghost text-xs" onClick={() => moveItem(i, 1)} disabled={i === items.length - 1} aria-label="Move down">
                  <ArrowDown size={13} /> Down
                </button>
                <button type="button" className="btn-ghost ml-auto text-xs text-rust" onClick={() => removeItem(i)}>
                  <Trash2 size={13} /> Remove
                </button>
              </div>
            </div>
          </details>
        );
      })}
      <button type="button" className="btn-ghost text-sm" onClick={addItem}>
        <Plus size={14} /> Add {(field.itemLabel || "item").toLowerCase()}
      </button>
    </div>
  );
}

function GroupField({ field, value, onChange }) {
  return (
    <fieldset className="space-y-4 rounded-sm border border-steel-200 p-4">
      <legend className="px-1 font-display text-xs font-semibold uppercase tracking-wide text-graphite-500">{field.label}</legend>
      {field.fields.map((f) => (
        <FieldRenderer key={f.key} field={f} value={value?.[f.key]} onChange={(v) => onChange({ ...(value || {}), [f.key]: v })} />
      ))}
    </fieldset>
  );
}

function FieldRenderer({ field, value, onChange }) {
  if (field.type === "group") return <GroupField field={field} value={value} onChange={onChange} />;
  if (field.type === "stringList") return <StringListField field={field} value={value} onChange={onChange} />;
  if (field.type === "collection") return <CollectionField field={field} value={value} onChange={onChange} />;
  return <ScalarField field={field} value={value} onChange={onChange} />;
}

/**
 * Renders one CMS section. `section.kind === "list"` sections (services,
 * projects, …) hold an array; "object" sections hold a flat object.
 */
export function SectionEditor({ section, value, onChange }) {
  if (section.kind === "list") {
    return (
      <CollectionField
        field={{ key: section.id, label: section.label, itemLabel: section.itemLabel, empty: section.empty, titleKey: section.titleKey, fields: section.fields }}
        value={value}
        onChange={onChange}
      />
    );
  }
  return (
    <div className="space-y-5">
      {section.fields.map((f) => (
        <FieldRenderer key={f.key} field={f} value={value?.[f.key]} onChange={(v) => onChange({ ...(value || {}), [f.key]: v })} />
      ))}
    </div>
  );
}
