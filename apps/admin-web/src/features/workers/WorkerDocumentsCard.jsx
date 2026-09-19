import { useRef, useState } from "react";
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
      if (!rejectionReason || rejectionReason.trim().length < 3) return;
    }
    try {
      await verify.mutateAsync({ docId: doc._id, approve, rejectionReason });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update the document.");
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
                <a className="text-xs font-medium text-teal hover:underline" href={doc.url} target="_blank" rel="noreferrer">
                  View
                </a>
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
      {allVerified && verificationStatus === "PENDING_VERIFICATION" &&
      <p className="mt-2 text-sm text-emerald-700">
          All documents verified — use “Verify documents” above to complete the step.
        </p>
      }
    </div>
  );
}