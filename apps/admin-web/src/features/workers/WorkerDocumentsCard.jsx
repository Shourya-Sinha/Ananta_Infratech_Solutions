import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Eye, ExternalLink, FileText, X } from "lucide-react";
import { useUploadWorkerDocument, useVerifyWorkerDocument, useWorkerDocuments } from "./api";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatDate } from "@/lib/format";

// Identity-relevant subset of DOCUMENT_TYPE for the admin upload control
// (PAYMENT_PROOF / EXPENSE_RECEIPT are finance artifacts, not onboarding docs).
const DOCUMENT_TYPES = ["AADHAAR", "PAN", "DRIVING_LICENCE", "VOTER_ID", "PASSPORT", "PROFILE_PHOTO", "OTHER"];

/**
 * Admin-side document review for a worker:
 *  1. Click Preview — the document opens as a FULL-WINDOW overlay above the
 *     whole website (image centered, PDF filling the window).
 *  2. Click the red ✕ close button (top-right) to return to this list.
 *  3. Then Verify, or Reject with a written reason, from the document row.
 * Once every uploaded document is VERIFIED, the worker-level "Verify
 * documents" step in the verification card unlocks.
 */
export function WorkerDocumentsCard({ workerId, verificationStatus }) {
  const { data: docs, isLoading } = useWorkerDocuments(workerId);
  const upload = useUploadWorkerDocument(workerId);
  const verify = useVerifyWorkerDocument(workerId);
  const [type, setType] = useState("AADHAAR");
  const [previewDoc, setPreviewDoc] = useState(null);
  const [rejectDoc, setRejectDoc] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [error, setError] = useState(null);
  const fileRef = useRef(null);

  const allVerified = (docs?.length ?? 0) > 0 && docs.every((d) => d.verificationStatus === "VERIFIED");

  const onUpload = async () => {
    setError(null);
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError("Choose a file to upload first.");
      return;
    }
    try {
      await upload.mutateAsync({ file, type });
      if (fileRef.current) fileRef.current.value = "";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    }
  };

  const decide = async (doc, approve, reason) => {
    setError(null);
    if (!approve && (!reason || reason.trim().length < 3)) {
      setError("Please enter a rejection reason (at least 3 characters) so the worker knows what to fix.");
      return false;
    }
    try {
      await verify.mutateAsync({ docId: doc._id, approve, rejectionReason: approve ? undefined : reason.trim() });
      setRejectDoc(null);
      setRejectionReason("");
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update the document.");
      return false;
    }
  };

  const startReject = (doc) => {
    setError(null);
    setRejectDoc(doc);
    setRejectionReason("");
  };

  return (
    <div className="card p-4">
      <p className="mb-3 font-display text-xs font-semibold uppercase tracking-wide text-graphite-500">
        Documents
      </p>
      {isLoading ? (
        <p className="text-sm text-graphite-500">Loading documents…</p>
      ) : !docs?.length ? (
        <p className="text-sm text-graphite-500">
          No documents yet — upload the worker&apos;s identity documents below, or the worker can
          upload them from the mobile app.
        </p>
      ) : (
        <ul className="divide-y divide-steel-200">
          {docs.map((doc) => (
            <li key={doc._id} className="py-2 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-graphite-900">{doc.type.replace(/_/g, " ")}</span>
                <StatusBadge status={doc.verificationStatus} />
                <span className="text-xs text-graphite-500">
                  {doc.metadata?.sizeBytes ? `${Math.round(doc.metadata.sizeBytes / 1024)} KB · ` : ""}
                  {formatDate(doc.createdAt)}
                </span>
                {doc.rejectionReason && (
                  <span className="text-xs text-rust">“{doc.rejectionReason}”</span>
                )}
                <span className="ml-auto flex items-center gap-2">
                  <button
                    type="button"
                    className="btn-primary inline-flex items-center gap-1.5 !px-3 !py-1.5 text-xs"
                    onClick={() => setPreviewDoc(doc)}
                  >
                    <Eye size={14} /> Preview
                  </button>
                  {doc.verificationStatus === "PENDING" && (
                    <>
                      <button
                        type="button"
                        className="btn-ghost inline-flex items-center gap-1 text-xs"
                        disabled={verify.isPending}
                        onClick={() => decide(doc, true)}
                      >
                        <Check size={14} /> Verify
                      </button>
                      <button
                        type="button"
                        className="btn-ghost inline-flex items-center gap-1 text-xs text-rust"
                        disabled={verify.isPending}
                        onClick={() => startReject(doc)}
                      >
                        <X size={14} /> Reject
                      </button>
                    </>
                  )}
                </span>
              </div>

              {rejectDoc?._id === doc._id && (
                <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3">
                  <label className="mb-1 block text-xs font-semibold text-red-700" htmlFor={`reject-reason-${doc._id}`}>
                    Rejection reason for this {doc.type.replace(/_/g, " ").toLowerCase()} *
                  </label>
                  <textarea
                    id={`reject-reason-${doc._id}`}
                    className="input min-h-20 w-full bg-white"
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Example: Image is blurry / wrong document / name does not match"
                    autoFocus
                  />
                  <p className="mt-1 text-[11px] text-red-600">This reason will be shown to the worker so they can upload the correct document.</p>
                  <div className="mt-2 flex flex-wrap justify-end gap-2">
                    <button
                      type="button"
                      className="btn-ghost text-xs"
                      onClick={() => { setRejectDoc(null); setRejectionReason(""); }}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="btn-primary !bg-[#dc2626] text-xs hover:!bg-[#b91c1c]"
                      disabled={verify.isPending || rejectionReason.trim().length < 3}
                      onClick={() => decide(doc, false, rejectionReason)}
                    >
                      {verify.isPending ? "Rejecting…" : "Confirm rejection"}
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex flex-wrap items-end gap-2 border-t border-steel-200 pt-4">
        <div>
          <label className="mb-1 block text-xs text-graphite-500">Document type</label>
          <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
            {DOCUMENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-48 flex-1">
          <label className="mb-1 block text-xs text-graphite-500">File (JPEG/PNG/WebP/PDF, up to 8MB)</label>
          <input
            className="input"
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            ref={fileRef}
          />
        </div>
        <button className="btn-primary" onClick={onUpload} disabled={upload.isPending}>
          {upload.isPending ? "Uploading…" : "Upload"}
        </button>
      </div>

      {error && <p className="mt-2 text-sm text-rust">{error}</p>}

      {previewDoc && (
        <DocumentPreviewOverlay doc={previewDoc} onClose={() => setPreviewDoc(null)} />
      )}

      {allVerified && verificationStatus === "PENDING_VERIFICATION" && (
        <p className="mt-2 text-sm text-emerald-700">
          All documents verified — use “Verify documents” above to complete the step.
        </p>
      )}
    </div>
  );
}

/**
 * FULL-WINDOW document preview.
 *
 * Rendered through a portal at <body> level so no card, sidebar, transform
 * or overflow in the app can shrink it: the overlay covers the ENTIRE
 * browser window above the website. The uploaded image is shown centered
 * at the largest size that fits; PDFs fill the available window. The only
 * action here is the big RED ✕ close button at the top-right (plus Escape)
 * — after closing, the admin uses Verify / Reject-with-reason in the list.
 */
function DocumentPreviewOverlay({ doc, onClose }) {
  const mime = doc.metadata?.mimeType ?? "";
  const isPdf = mime === "application/pdf" || /\.pdf($|\?)/i.test(doc.url ?? "");
  const isImage = mime.startsWith("image/") || /\.(jpe?g|png|webp)($|\?)/i.test(doc.url ?? "");

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden"; // the page behind must not scroll
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex h-[100dvh] w-screen flex-col bg-black/95"
      role="dialog"
      aria-modal="true"
      aria-label={`Full-window preview of ${doc.type.replace(/_/g, " ")}`}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Header strip: what document this is + the RED close button */}
      <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
        <div className="min-w-0 flex-1 text-white">
          <p className="truncate font-display text-base font-semibold sm:text-lg">
            {doc.type.replace(/_/g, " ")}
            <span className="ml-3 align-middle"><StatusBadge status={doc.verificationStatus} /></span>
          </p>
          <p className="mt-0.5 truncate text-xs text-white/60">
            {mime || "Unknown file type"}
            {doc.metadata?.sizeBytes ? ` · ${Math.round(doc.metadata.sizeBytes / 1024)} KB` : ""}
            {` · Uploaded ${formatDate(doc.createdAt)}`}
          </p>
        </div>
        <a
          className="hidden items-center gap-1.5 rounded-full bg-white/10 px-3 py-2 text-xs font-medium text-white transition hover:bg-white/20 sm:inline-flex"
          href={doc.url}
          target="_blank"
          rel="noreferrer"
        >
          <ExternalLink size={14} /> Open original
        </a>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close preview"
          title="Close preview (Esc)"
          className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#dc2626] text-white shadow-[0_8px_30px_rgba(220,38,38,0.55)] ring-2 ring-white/80 transition hover:scale-105 hover:bg-[#b91c1c] focus:outline-none focus-visible:ring-4 focus-visible:ring-white"
        >
          <X size={26} strokeWidth={2.75} />
        </button>
      </div>

      {/* Document itself: centered, as large as the whole window allows */}
      <div
        className="flex min-h-0 flex-1 items-center justify-center overflow-auto px-4 pb-4 sm:px-8 sm:pb-6"
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        {!doc.url ? (
          <p className="text-sm text-white/70">No preview URL is available for this document.</p>
        ) : isPdf ? (
          <iframe
            title={`${doc.type.replace(/_/g, " ")} PDF preview`}
            src={doc.url}
            className="h-full w-full rounded-lg bg-white shadow-2xl"
          />
        ) : isImage ? (
          <img
            src={doc.url}
            alt={`${doc.type.replace(/_/g, " ")} uploaded by worker`}
            className="max-h-full max-w-full rounded-lg object-contain shadow-2xl"
          />
        ) : (
          <div className="text-center text-white">
            <FileText className="mx-auto mb-2 text-white/50" size={40} />
            <p className="text-sm text-white/70">This file type cannot be previewed inline.</p>
            <a className="mt-2 inline-block text-sm font-medium text-white underline" href={doc.url} target="_blank" rel="noreferrer">
              Open the document
            </a>
          </div>
        )}
      </div>

      <p className="px-4 pb-4 text-center text-xs text-white/55">
        Press the red ✕ button to close this preview, then Verify or Reject (with a reason) from the document list.
      </p>
    </div>,
    document.body
  );
}
