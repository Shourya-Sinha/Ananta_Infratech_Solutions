const {
  decideDuplicateRegistration,
  isWorkerDocumentVerified,
  DUPLICATE_ACTIONS
} = require("../../src/modules/workers/duplicatePolicy");
const { workerRegisterSchema } = require("@ananta/validation");

const unverifiedWorker = {
  name: "Ramesh Kumar",
  employeeId: "EMP-0007",
  verificationStatus: "PENDING_VERIFICATION",
  verifiedDocumentCount: 0
};
const verifiedWorker = {
  name: "Suresh Yadav",
  employeeId: "EMP-0003",
  verificationStatus: "DOCUMENT_VERIFIED",
  verifiedDocumentCount: 2
};

describe("isWorkerDocumentVerified", () => {
  test.each(["DOCUMENT_VERIFIED", "WORK_TYPE_VERIFIED", "ACTIVE"])(
    "profile status %s counts as verified",
    (status) => {
      expect(isWorkerDocumentVerified({ verificationStatus: status, verifiedDocumentCount: 0 })).toBe(true);
    }
  );

  test("PENDING_VERIFICATION with zero verified docs is NOT verified", () => {
    expect(isWorkerDocumentVerified(unverifiedWorker)).toBe(false);
  });

  test("even PENDING profiles count as verified once a document is individually VERIFIED", () => {
    expect(isWorkerDocumentVerified({ verificationStatus: "PENDING_VERIFICATION", verifiedDocumentCount: 1 })).toBe(true);
  });

  test("missing account is not verified", () => {
    expect(isWorkerDocumentVerified(null)).toBe(false);
  });
});

describe("decideDuplicateRegistration", () => {
  test("no match → proceed with a fresh registration", () => {
    const d = decideDuplicateRegistration({
      matches: { phone: false, email: false },
      confirmDuplicate: false,
      existing: null
    });
    expect(d.action).toBe(DUPLICATE_ACTIONS.PROCEED_NEW);
  });

  test("unverified duplicate + no confirmation → WARN with the number/owner in the message", () => {
    const d = decideDuplicateRegistration({
      matches: { phone: true, email: false },
      confirmDuplicate: false,
      existing: unverifiedWorker
    });
    expect(d.action).toBe(DUPLICATE_ACTIONS.WARN_CONFIRM_REQUIRED);
    expect(d.message).toContain("already registered");
    expect(d.message).toContain("Ramesh Kumar");
    expect(d.message).toContain("EMP-0007");
    expect(d.message).toContain("NOT verified");
    expect(d.message).toContain("phone number");
  });

  test("unverified duplicate + admin confirmed → UPDATE_EXISTING (overwrite allowed)", () => {
    const d = decideDuplicateRegistration({
      matches: { phone: true, email: true },
      confirmDuplicate: true,
      existing: unverifiedWorker
    });
    expect(d.action).toBe(DUPLICATE_ACTIONS.UPDATE_EXISTING);
  });

  test.each([
    ["DOCUMENT_VERIFIED profile", verifiedWorker],
    ["PENDING profile but one VERIFIED document", { ...unverifiedWorker, verifiedDocumentCount: 1 }]
  ])("verified duplicate (%s) → BLOCK with hard 'already exists' error, even when confirmed", (_label, existing) => {
    const warned = decideDuplicateRegistration({
      matches: { phone: true, email: false },
      confirmDuplicate: false,
      existing
    });
    const confirmed = decideDuplicateRegistration({
      matches: { phone: true, email: false },
      confirmDuplicate: true,
      existing
    });
    expect(warned.action).toBe(DUPLICATE_ACTIONS.BLOCK_VERIFIED);
    expect(confirmed.action).toBe(DUPLICATE_ACTIONS.BLOCK_VERIFIED);
    expect(confirmed.message).toContain("already exists");
  });

  test("email-only match names the email in the warning", () => {
    const d = decideDuplicateRegistration({
      matches: { phone: false, email: true },
      confirmDuplicate: false,
      existing: unverifiedWorker
    });
    expect(d.action).toBe(DUPLICATE_ACTIONS.WARN_CONFIRM_REQUIRED);
    expect(d.message).toContain("email");
    expect(d.message).not.toContain("phone");
  });
});

describe("workerRegisterSchema duplicate confirmation flag", () => {
  const base = { name: "Ramesh Kumar", phone: "9876543210", workTypeId: "507f1f77bcf86cd799439011" };

  test("accepts confirmDuplicate=true for the overwrite flow", () => {
    expect(workerRegisterSchema.parse({ ...base, confirmDuplicate: true }).confirmDuplicate).toBe(true);
  });

  test("confirmDuplicate stays optional", () => {
    expect(workerRegisterSchema.parse(base).confirmDuplicate).toBeUndefined();
  });

  test("rejects non-boolean confirmDuplicate", () => {
    expect(() => workerRegisterSchema.parse({ ...base, confirmDuplicate: "yes" })).toThrow();
  });
});
