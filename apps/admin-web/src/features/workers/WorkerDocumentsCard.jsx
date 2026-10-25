import { useRef, useState } from "react";
import { Eye, ExternalLink, FileText, X } from "lucide-react";
import { useUploadWorkerDocument, useVerifyWorkerDocument, useWorkerDocuments } from "./api";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatDate } from "@/lib/format";

// Identity-relevant subset of DOCUMENT_TYPE for the admin upload control
// (PAYMENT_PROOF / EXPENSE_RECEIPT are finance artifacts, not onboarding docs).
const DOCUMENT_TYPES = ["AADHAAR", "PAN", "DRIVING_LICENCE", "VOTER_ID", "PASSPORT", "PROFILE_PHOTO", "OTHER"];

/**
 * Admin-side document review for a worker: upload documents on the worker's
 * behalf, then verify or reject each one. Once every uploaded document is
 * VERIFIED, the worker-level "Verify documents" step in the verification
 * card above unlocks (it requires all docs individually verified first).
 */
export function WorkerDocumentsCard({ workerId, verificationStatus }) {
  const { data: docs, isLoading } = useWorkerDocuments(workerId);
  const upload = useUploadWorkerDocument(workerId);
  const verify = useVerifyWorkerDocument(workerId);
  const [type, setType] = useState("AADHAAR");
  const [previewDoc, setPreviewDoc] = useState(null);
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

  const decide = async (doc, approve) => {
    setError(null);
    let rejectionReason;
    if (!approve) {
      rejectionReason = window.prompt(`Reason for rejecting the ${doc.type.replace(/_/g, " ").toLowerCase()} (required):`);
      if (!rejectionReason || rejectionReason.trim().length < 3) return false;
    }
    try {
      await verify.mutateAsync({ docId: doc._id, approve, rejectionReason });
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update the document.");
      return false;
    }
  };

  return (
    <div className="card p-4">
      <p className="mb-3 font-display text-xs font-semibold uppercase tracking-wide text-graphite-500">
        Documents
      </p>
      {isLoading ?
      <p className="text-sm text-graphite-500">Loading documents…</p> :
      !docs?.length ?
      <p className="text-sm text-graphite-500">
          No documents yet — upload the worker&apos;s identity documents below, or the worker can
          upload them from the mobile app.
        </p> :
      <ul className="divide-y divide-steel-200">
          {docs.map((doc) =>
        <li key={doc._id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
              <span className="font-medium text-graphite-900">{doc.type.replace(/_/g, " ")}</span>
              <StatusBadge status={doc.verificationStatus} />
              <span className="text-xs text-graphite-500">
                {doc.metadata?.sizeBytes ? `${Math.round(doc.metadata.sizeBytes / 1024)} KB · ` : ""}
                {formatDate(doc.createdAt)}
              </span>
              {doc.rejectionReason &&
          <span className="text-xs text-rust">“{doc.rejectionReason}”</span>
          }
              <span className="ml-auto flex items-center gap-2">
                <button
                  type="button"
                  className="btn-primary inline-flex items-center gap-1.5 !px-3 !py-1.5 text-xs"
                  onClick={() => setPreviewDoc(doc)}
                >
                  <Eye size={14} /> Preview &amp; verify
                </button>
                {doc.verificationStatus === "PENDING" &&
          <>
                    <button className="btn-ghost text-xs" disabled={verify.isPending} onClick={() => decide(doc, true)}>
                      Verify
                    </button>
                    <button className="btn-ghost text-xs text-rust" disabled={verify.isPending} onClick={() => decide(doc, false)}>
                      Reject
                    </button>
                  </>
          }
              </span>
            </li>
        )}
        </ul>
      }

      <div className="mt-4 flex flex-wrap items-end gap-2 border-t border-steel-200 pt-4">
        <div>
          <label className="mb-1 block text-xs text-graphite-500">Document type</label>
          <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
            {DOCUMENT_TYPES.map((t) =>
        <option key={t} value={t}>
                {t.replace(/_/g, " ")}
              </option>
        )}
          </select>
        </div>
        <div className="min-w-48 flex-1">
          <label className="mb-1 block text-xs text-graphite-500">File (JPEG/PNG/WebP/PDF, up to 8MB)</label>
          <input
        className="input"
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        ref={fileRef} />
        </div>
        <button className="btn-primary" onClick={onUpload} disabled={upload.isPending}>
          {upload.isPending ? "Uploading…" : "Upload"}
        </button>
      </div>
      {error &&
      <p className="mt-2 text-sm text-rust">
          {error}
        </p>
      }
      {previewDoc && (
        <DocumentPreviewModal
          doc={previewDoc}
          busy={verify.isPending}
          onClose={() => setPreviewDoc(null)}
          onDecide={async (approve) => {
            const ok = await decide(previewDoc, approve);
            if (ok !== false) setPreviewDoc(null);
          }}
        />
      )}
      {allVerified && verificationStatus === "PENDING_VERIFICATION" &&
      <p className="mt-2 text-sm text-emerald-700">
          All documents verified — use “Verify documents” above to complete the step.
        </p>
      }
    </div>
  );
}

/**
 * In-admin document preview: the admin SEES the actual uploaded file before
 * pressing Verify/Reject. JPG/PNG/WebP render inline as an image; PDFs render
 * in an embedded viewer. The declared document type, file type/size and
 * upload date are shown above the preview so the admin can confirm e.g.
 * "this really is an Aadhaar card" before approving it.
 */
function DocumentPreviewModal({ doc, busy, onClose, onDecide }) {
  const mime = doc.metadata?.mimeType ?? "";
  const isPdf = mime === "application/pdf" || /\.pdf($|\?)/i.test(doc.url ?? "");
  const isImage = mime.startsWith("image/") || /\.(jpe?g|png|webp)($|\?)/i.test(doc.url ?? "");
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-graphite-950/70 p-0 sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label={`Preview ${doc.type}`}>
      <div className="flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
        <div className="flex flex-wrap items-start gap-3 border-b border-steel-200 px-5 py-4">
          <div className="min-w-0 flex-1">
            <p className="font-display text-base font-semibold text-graphite-900">{doc.type.replace(/_/g, " ")}</p>
            <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-graphite-500">
              <StatusBadge status={doc.verificationStatus} />
              <span>{mime || "Unknown file type"}</span>
              {doc.metadata?.sizeBytes ? <span>· {Math.round(doc.metadata.sizeBytes / 1024)} KB</span> : null}
              <span>· Uploaded {formatDate(doc.createdAt)}</span>
            </p>
            <p className="mt-1 text-xs text-graphite-500">Check that the file clearly matches this document type before verifying it.</p>
          </div>
          <a className="btn-ghost inline-flex items-center gap-1.5 text-xs" href={doc.url} target="_blank" rel="noreferrer">
            <ExternalLink size={14} /> Open original
          </a>
          <button type="button" className="btn-ghost inline-flex items-center gap-1 text-xs" onClick={onClose} aria-label="Close preview">
            <X size={16} /> Close
          </button>
        </div>

        <div className="flex min-h-[320px] flex-1 items-center justify-center overflow-auto bg-steel-100 p-4">
          {!doc.url ? (
            <p className="text-sm text-graphite-500">No preview URL is available for this document.</p>
          ) : isPdf ? (
            <iframe title={`${doc.type} PDF preview`} src={doc.url} className="h-[68vh] w-full rounded-lg bg-white" />
          ) : isImage ? (
            <img src={doc.url} alt={`${doc.type.replace(/_/g, " ")} uploaded by worker`} className="max-h-[68vh] max-w-full rounded-lg object-contain shadow" />
          ) : (
            <div className="text-center">
              <FileText className="mx-auto mb-2 text-graphite-400" size={36} />
              <p className="text-sm text-graphite-500">This file type cannot be previewed inline.</p>
              <a className="mt-2 inline-block text-sm font-medium text-teal hover:underline" href={doc.url} target="_blank" rel="noreferrer">Open the document</a>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-steel-200 px-5 py-4">
          {doc.rejectionReason && <p className="mr-auto text-xs text-rust">Previous rejection: “{doc.rejectionReason}”</p>}
          {doc.verificationStatus === "PENDING" ? (
            <>
              <button type="button" className="btn-ghost text-rust" disabled={busy} onClick={() => onDecide(false)}>Reject document</button>
              <button type="button" className="btn-primary" disabled={busy} onClick={() => onDecide(true)}>{busy ? "Saving…" : "Verify document"}</button>
            </>
          ) : (
            <p className="text-xs text-graphite-500">This document has already been {doc.verificationStatus.toLowerCase()}.</p>
          )}
          <button type="button" className="btn-ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
