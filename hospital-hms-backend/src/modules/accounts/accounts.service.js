const prisma = require('../../config/db');
// Same shared Prisma client — reusing Clinic's own revenue aggregation here
// (rather than re-deriving it) so "Income" for the Non-Corporate entity always
// matches what the Clinic Revenue Dashboard itself shows for patient revenue.
const clinicSvc = require('../clinic/clinic.service');

// ── Main GL ───────────────────────────────────────────────────────────────────

async function getMainGLs(entityType) {
  return prisma.accMainGL.findMany({
    where: { entityType },
    orderBy: { id: 'asc' },
  });
}

async function createMainGL({ name, entityType }) {
  // `code` is globally unique (not scoped by entityType — see schema), so the
  // sequence has to be counted across ALL Main GLs, not just this entityType's
  // — counting only this entityType's rows would regenerate "E-1" for the
  // first Corporate Main GL even though Non-Corporate already has one.
  const count = await prisma.accMainGL.count();
  const code = `E-${count + 1}`;
  return prisma.accMainGL.create({ data: { code, name: name.trim(), entityType } });
}

async function updateMainGL(id, { name }) {
  return prisma.accMainGL.update({
    where: { id: Number(id) },
    data: { name: name.trim() },
  });
}

async function deleteMainGL(id) {
  return prisma.accMainGL.delete({ where: { id: Number(id) } });
}

// ── Sub GL ────────────────────────────────────────────────────────────────────

async function getSubGLs(entityType, mainGlId) {
  return prisma.accSubGL.findMany({
    where: {
      entityType,
      ...(mainGlId ? { mainGlId: Number(mainGlId) } : {}),
    },
    include: { mainGL: { select: { id: true, code: true, name: true } } },
    orderBy: { id: 'asc' },
  });
}

async function createSubGL({ name, mainGlId, entityType }) {
  const parent = await prisma.accMainGL.findUnique({ where: { id: Number(mainGlId) } });
  if (!parent) throw new Error('Main GL not found');
  const count = await prisma.accSubGL.count({ where: { mainGlId: Number(mainGlId) } });
  const code = `${parent.code}.${count + 1}`;
  return prisma.accSubGL.create({ data: { code, name: name.trim(), mainGlId: Number(mainGlId), entityType } });
}

async function updateSubGL(id, { name }) {
  return prisma.accSubGL.update({ where: { id: Number(id) }, data: { name: name.trim() } });
}

async function deleteSubGL(id) {
  return prisma.accSubGL.delete({ where: { id: Number(id) } });
}

// ── Main Account ──────────────────────────────────────────────────────────────

async function getMainAccounts(entityType, subGlId) {
  return prisma.accMainAccount.findMany({
    where: {
      entityType,
      ...(subGlId ? { subGlId: Number(subGlId) } : {}),
    },
    include: { subGL: { select: { id: true, code: true, name: true } } },
    orderBy: { id: 'asc' },
  });
}

async function createMainAccount({ name, subGlId, entityType }) {
  const parent = await prisma.accSubGL.findUnique({ where: { id: Number(subGlId) } });
  if (!parent) throw new Error('Sub GL not found');
  const count = await prisma.accMainAccount.count({ where: { subGlId: Number(subGlId) } });
  const code = `${parent.code}.${count + 1}`;
  return prisma.accMainAccount.create({ data: { code, name: name.trim(), subGlId: Number(subGlId), entityType } });
}

async function updateMainAccount(id, { name }) {
  return prisma.accMainAccount.update({ where: { id: Number(id) }, data: { name: name.trim() } });
}

async function deleteMainAccount(id) {
  return prisma.accMainAccount.delete({ where: { id: Number(id) } });
}

// ── Sub Account ───────────────────────────────────────────────────────────────

async function getSubAccounts(entityType, mainAccountId) {
  return prisma.accSubAccount.findMany({
    where: {
      entityType,
      ...(mainAccountId ? { mainAccountId: Number(mainAccountId) } : {}),
    },
    include: { mainAccount: { select: { id: true, code: true, name: true } } },
    orderBy: { id: 'asc' },
  });
}

async function createSubAccount({ name, mainAccountId, entityType }) {
  const parent = await prisma.accMainAccount.findUnique({ where: { id: Number(mainAccountId) } });
  if (!parent) throw new Error('Main Account not found');
  const count = await prisma.accSubAccount.count({ where: { mainAccountId: Number(mainAccountId) } });
  const code = `${parent.code}.${count + 1}`;
  return prisma.accSubAccount.create({ data: { code, name: name.trim(), mainAccountId: Number(mainAccountId), entityType } });
}

async function updateSubAccount(id, { name }) {
  return prisma.accSubAccount.update({ where: { id: Number(id) }, data: { name: name.trim() } });
}

async function deleteSubAccount(id) {
  return prisma.accSubAccount.delete({ where: { id: Number(id) } });
}

// ── Voucher Expense — pending GRN queue (auto-popup) ────────────────────────
// Powers the "clear the backlog" popup on the Voucher Expense screen: every
// still-unpaid GRN that a "Vendors / Suppliers" head or an "Inventory" head
// (List Attachments) is wired up to for this entityType, flattened into one
// list, most-recent first, each row carrying the full Main GL → Sub GL →
// Main Account → Sub Account chain so the form can auto-fill itself the
// moment a row is picked. A head only contributes rows once it's actually
// linked to a Sub Account (AccPayeeHeadAccount) — that link is what tells us
// which account chain to auto-select, so an unlinked head has nowhere to
// land and is skipped. The same underlying GRN can legitimately appear
// twice (once under "Vendors / Suppliers", once under a more specific
// Inventory Head covering its subcategory) — that's intentional, it lets
// the user book it under whichever chain is correct.
async function getPendingGrnQueue(entityType) {
  const paymentMode = entityType === 'corporate' ? 'panel' : 'cash';

  const heads = await prisma.accPayeeHead.findMany({
    where: { entityType, sourceType: { in: ['vendor', 'inventory'] } },
    include: {
      linkedAccounts: {
        take: 1,
        orderBy: { id: 'asc' },
        include: {
          subAccount: {
            select: {
              id: true, code: true, name: true,
              mainAccount: {
                select: {
                  id: true, code: true, name: true,
                  subGL: {
                    select: {
                      id: true, code: true, name: true,
                      mainGL: { select: { id: true, code: true, name: true } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  const rows = [];
  for (const head of heads) {
    const link = head.linkedAccounts[0];
    if (!link) continue; // not wired to any Sub Account yet — nothing to auto-fill into
    if (head.sourceType === 'inventory' && !head.inventorySubcategoryId) continue;

    const sub = link.subAccount;
    const main = sub.mainAccount;
    const subGl = main.subGL;
    const mainGl = subGl.mainGL;

    const grns = await prisma.inventoryGRN.findMany({
      where: {
        isPaid: false,
        paymentMode,
        ...(head.sourceType === 'inventory' ? { subcategoryId: head.inventorySubcategoryId } : {}),
      },
      include: { supplier: { select: { name: true } }, item: { select: { name: true } } },
      orderBy: [{ billDate: 'desc' }, { receivedDate: 'desc' }],
    });

    for (const g of grns) {
      rows.push({
        id: `grn-${g.id}-head-${head.id}`,
        grnId: g.id,
        headId: head.id,
        headName: head.name,
        supplierName: g.supplier.name,
        itemName: g.item.name,
        code: g.code,
        amount: g.totalAmount,
        date: g.billDate || g.receivedDate,
        chain: {
          mainGlId: mainGl.id, mainGlCode: mainGl.code, mainGlName: mainGl.name,
          subGlId: subGl.id, subGlCode: subGl.code, subGlName: subGl.name,
          mainAccountId: main.id, mainAccountCode: main.code, mainAccountName: main.name,
          subAccountId: sub.id, subAccountCode: sub.code, subAccountName: sub.name,
        },
      });
    }
  }

  rows.sort((a, b) => new Date(b.date) - new Date(a.date));
  return rows;
}

// One-time seed: clones the entire Non-Corporate Main GL → Sub GL → Main
// Account → Sub Account tree into brand-new Corporate rows (own ids/codes,
// no link back to the source) so Corporate starts from the same structure
// instead of being built by hand from scratch. Guarded to only run while
// Corporate is still empty — after that, each side is edited independently
// via its own Parameters screens (no re-sync).
async function copyChartToCorporate() {
  const alreadyCopied = await prisma.accMainGL.findFirst({ where: { entityType: 'corporate' } });
  if (alreadyCopied) {
    throw new Error('Corporate chart of accounts already has data — copy already done. Edit it directly from the Corporate Parameters screens.');
  }

  const sourceMainGLs = await prisma.accMainGL.findMany({
    where: { entityType: 'non-corporate' },
    orderBy: { id: 'asc' },
    include: {
      subGLs: {
        orderBy: { id: 'asc' },
        include: {
          mainAccounts: {
            orderBy: { id: 'asc' },
            include: { subAccounts: { orderBy: { id: 'asc' } } },
          },
        },
      },
    },
  });
  if (sourceMainGLs.length === 0) {
    throw new Error('Non-Corporate chart of accounts is empty — nothing to copy.');
  }

  const counts = { mainGL: 0, subGL: 0, mainAccount: 0, subAccount: 0 };

  await prisma.$transaction(async (tx) => {
    // `code` is globally unique (not scoped by entityType), so Main GL codes
    // continue the existing global sequence (same rule as createMainGL above)
    // — e.g. Non-Corporate's E-1..E-3 become Corporate's E-4..E-6. Every
    // level below derives its code from its own *new* parent's new code, so
    // uniqueness falls out automatically without extra checks.
    let mainGlSeq = await tx.accMainGL.count();

    for (const srcGL of sourceMainGLs) {
      mainGlSeq += 1;
      const newGL = await tx.accMainGL.create({
        data: { code: `E-${mainGlSeq}`, name: srcGL.name, entityType: 'corporate' },
      });
      counts.mainGL += 1;

      let subGlSeq = 0;
      for (const srcSubGL of srcGL.subGLs) {
        subGlSeq += 1;
        const newSubGL = await tx.accSubGL.create({
          data: { code: `${newGL.code}.${subGlSeq}`, name: srcSubGL.name, mainGlId: newGL.id, entityType: 'corporate' },
        });
        counts.subGL += 1;

        let mainAccSeq = 0;
        for (const srcMA of srcSubGL.mainAccounts) {
          mainAccSeq += 1;
          const newMA = await tx.accMainAccount.create({
            data: { code: `${newSubGL.code}.${mainAccSeq}`, name: srcMA.name, subGlId: newSubGL.id, entityType: 'corporate' },
          });
          counts.mainAccount += 1;

          let subAccSeq = 0;
          for (const srcSA of srcMA.subAccounts) {
            subAccSeq += 1;
            await tx.accSubAccount.create({
              data: { code: `${newMA.code}.${subAccSeq}`, name: srcSA.name, mainAccountId: newMA.id, entityType: 'corporate' },
            });
            counts.subAccount += 1;
          }
        }
      }
    }
  });

  return counts;
}

// ── Payee Heads ───────────────────────────────────────────────────────────────

const SYSTEM_HEAD_DEFS = [
  { sourceType: 'employee',        name: 'Employees' },
  { sourceType: 'employee-manual', name: 'Employees (Manual Amount)' },
  { sourceType: 'vendor',          name: 'Vendors / Suppliers' },
  { sourceType: 'doctor',          name: 'Doctors / Consultants' },
  // No payee list of its own — just a single Link-to-Account target. When an
  // Advance/Loan is created (Employee Management), the backend looks up
  // whichever Sub Account is linked to this head (see
  // getAdvanceLoanVoucherAccountChain) and posts the auto Voucher Expense
  // against it. Left unlinked = no auto-voucher, just a warning back to HR.
  { sourceType: 'advance-loan',    name: 'Employee Advance/Loan' },
  // Same Link-to-Account-only pattern as advance-loan above. When a Slip
  // Refund or an Admission's Refund amount is processed (Clinic), the
  // backend posts an auto Voucher Expense against whichever Sub Account is
  // linked here — see getRefundVoucherAccountChain — in the SAME book
  // (Corporate/Panel vs Non-Corporate) as the original slip/admission, so
  // this head exists once per entityType, each linked separately.
  { sourceType: 'slip-admission-refund', name: 'Slip/Admission Refund' },
];

async function ensureSystemHeads(entityType) {
  for (const def of SYSTEM_HEAD_DEFS) {
    const exists = await prisma.accPayeeHead.findFirst({ where: { sourceType: def.sourceType, entityType } });
    if (!exists) await prisma.accPayeeHead.create({ data: { name: def.name, sourceType: def.sourceType, entityType } });
  }
}

const LINKED_ACCOUNTS_INCLUDE = {
  linkedAccounts: {
    orderBy: { id: 'asc' },
    include: {
      subAccount: {
        select: {
          id: true, code: true, name: true,
          mainAccount: {
            select: {
              id: true, code: true, name: true,
              subGL: {
                select: {
                  id: true, code: true, name: true,
                  mainGL: { select: { id: true, code: true, name: true } },
                },
              },
            },
          },
        },
      },
    },
  },
  inventorySubcategory: { select: { id: true, code: true, name: true, category: { select: { id: true, name: true } } } },
  linkedMainAccounts: {
    orderBy: { id: 'asc' },
    include: { mainAccount: { select: { id: true, code: true, name: true } } },
  },
  staffCategoryLinks: {
    orderBy: { id: 'asc' },
    include: { staffCategory: { select: { id: true, name: true } } },
  },
  // sourceType='inventory' only — Custom (manual) Heads merged into this
  // head's own Payee list (see linkCustomHeadToInventoryHead).
  linkedCustomHeads: {
    orderBy: { id: 'asc' },
    include: { customHead: { select: { id: true, name: true } } },
  },
};

async function getPayeeHeads(entityType) {
  await ensureSystemHeads(entityType);
  return prisma.accPayeeHead.findMany({
    where: { entityType },
    orderBy: { id: 'asc' },
    include: LINKED_ACCOUNTS_INCLUDE,
  });
}

async function createPayeeHead({ name, sourceType = 'manual', entityType, inventorySubcategoryId, mainAccountId }) {
  const data = { name: name.trim(), sourceType, entityType };
  if (inventorySubcategoryId) data.inventorySubcategoryId = Number(inventorySubcategoryId);
  if (mainAccountId)          data.mainAccountId          = Number(mainAccountId);
  return prisma.accPayeeHead.create({ data, include: LINKED_ACCOUNTS_INCLUDE });
}

async function getInventoryHeadForMainAccount(mainAccountId) {
  const link = await prisma.accPayeeHeadMainAccount.findFirst({
    where: { mainAccountId: Number(mainAccountId) },
    include: { payeeHead: { select: { id: true, name: true, inventorySubcategoryId: true, sourceType: true } } },
  });
  if (!link?.payeeHead || link.payeeHead.sourceType !== 'inventory') return null;
  return link.payeeHead;
}

// ── Surgery/Anesthesia payee head (sourceType='surgery') ───────────────────
// Same shape as the Inventory head above, but the "catalog" is Clinic staff
// categories (Surgeon, Anaesthetic, …) instead of an inventory subcategory —
// reuses the exact same AccPayeeHeadMainAccount link, so no new link route
// was needed for it.

async function getSurgeryHeadForMainAccount(mainAccountId) {
  const link = await prisma.accPayeeHeadMainAccount.findFirst({
    where: { mainAccountId: Number(mainAccountId) },
    include: {
      payeeHead: {
        select: {
          id: true, name: true, sourceType: true,
          staffCategoryLinks: { include: { staffCategory: { select: { id: true, name: true } } } },
        },
      },
    },
  });
  if (!link?.payeeHead || link.payeeHead.sourceType !== 'surgery') return null;
  return link.payeeHead;
}

async function addPayeeHeadStaffCategory(headId, staffCategoryId) {
  return prisma.accPayeeHeadStaffCategory.create({
    data: { payeeHeadId: Number(headId), staffCategoryId: Number(staffCategoryId) },
    include: { staffCategory: { select: { id: true, name: true } } },
  });
}

async function removePayeeHeadStaffCategory(headId, staffCategoryId) {
  return prisma.accPayeeHeadStaffCategory.deleteMany({
    where: { payeeHeadId: Number(headId), staffCategoryId: Number(staffCategoryId) },
  });
}

// Payee list for a surgery/anesthesia head — doctors whose staff category is
// one of the ones linked to this head, tagged with that category's name so
// the picker can show e.g. "Dr X (Surgeon)". Pass staffCategoryId to narrow
// it down to just that one role (e.g. the user picked "Surgery" vs
// "Anesthesia" for this particular payment) — must still be one of the
// categories actually linked to this head.
async function getSurgeryPayeesForHead(headId, staffCategoryId) {
  const head = await prisma.accPayeeHead.findUnique({ where: { id: Number(headId) }, select: { sourceType: true } });

  // IPD Consultant Fee doesn't gate its payee list by Staff Category — a
  // doctor's actual pending amount comes entirely from whichever
  // ClinicDoctorSubDept links they have (see getPendingConsultantFees, which
  // has no category filter either), and plenty of doctors who bill through
  // Final Bill sub-departments (X-Ray/Lab providers etc.) have no Staff
  // Category set at all — filtering here would silently hide them even
  // though they have real pending fees. Show every active doctor instead;
  // one with nothing pending just shows an empty list on click, same as today.
  if (head?.sourceType === 'ipd-consultant') {
    const rows = await prisma.clinicDoctor.findMany({
      where: { status: 'active' },
      select: { id: true, name: true, code: true, staffCategory: { select: { name: true } } },
      orderBy: { name: 'asc' },
    });
    return rows.map((d) => ({ id: d.id, name: d.name, code: d.code, categoryName: d.staffCategory?.name || null }));
  }

  const links = await prisma.accPayeeHeadStaffCategory.findMany({
    where: { payeeHeadId: Number(headId) },
    select: { staffCategoryId: true },
  });
  let categoryIds = links.map((l) => l.staffCategoryId);
  if (staffCategoryId && categoryIds.includes(Number(staffCategoryId))) {
    categoryIds = [Number(staffCategoryId)];
  }
  if (categoryIds.length === 0) return [];
  const rows = await prisma.clinicDoctor.findMany({
    where: { status: 'active', staffCategoryId: { in: categoryIds } },
    select: { id: true, name: true, code: true, staffCategory: { select: { name: true } } },
    orderBy: { name: 'asc' },
  });
  return rows.map((d) => ({ id: d.id, name: d.name, code: d.code, categoryName: d.staffCategory?.name || null }));
}

// ── IPD Consultant Fee payee head (sourceType='ipd-consultant') ────────────
// Same Main-Account link + staff-category filter as Surgery/Anesthesia above
// (reuses getSurgeryPayeesForHead as-is — it only cares about linked staff
// categories, not sourceType). What's different is where the Amount comes
// from: not typed by hand, but summed from that consultant's own unpaid
// Const Fee doctorFee rows already sitting in admissions' Final Bills.
async function getIpdConsultantHeadForMainAccount(mainAccountId) {
  const link = await prisma.accPayeeHeadMainAccount.findFirst({
    where: { mainAccountId: Number(mainAccountId) },
    include: {
      payeeHead: {
        select: {
          id: true, name: true, sourceType: true,
          staffCategoryLinks: { include: { staffCategory: { select: { id: true, name: true } } } },
        },
      },
    },
  });
  if (!link?.payeeHead || link.payeeHead.sourceType !== 'ipd-consultant') return null;
  return link.payeeHead;
}

// Whichever Sub Account is linked to the 'advance-loan' system head for this
// entityType (set up once via List Attachments → "Employee Advance/Loan" →
// Link to Account) — the posting target for auto-vouchers created from
// Employee Management when an Advance/Loan is saved. Returns null if the
// head hasn't been linked to an account yet (caller should skip the
// auto-voucher and surface that to the user rather than guessing an account).
async function getAdvanceLoanVoucherAccountChain(entityType) {
  const head = await prisma.accPayeeHead.findFirst({ where: { sourceType: 'advance-loan', entityType } });
  if (!head) return null;
  const link = await prisma.accPayeeHeadAccount.findFirst({
    where: { payeeHeadId: head.id },
    include: {
      subAccount: {
        include: { mainAccount: { include: { subGL: { include: { mainGL: true } } } } },
      },
    },
  });
  if (!link?.subAccount) return null;
  const sa = link.subAccount;
  return {
    subAccountId: sa.id,
    accountCode:  sa.code,
    accountName:  sa.name,
    mainAccountId: sa.mainAccount.id,
    subGlId:      sa.mainAccount.subGL.id,
    mainGlId:     sa.mainAccount.subGL.mainGL.id,
  };
}

// Same lookup as getAdvanceLoanVoucherAccountChain above, for the
// 'slip-admission-refund' system head instead — see clinic/refundVoucher.service.js.
async function getRefundVoucherAccountChain(entityType) {
  const head = await prisma.accPayeeHead.findFirst({ where: { sourceType: 'slip-admission-refund', entityType } });
  if (!head) return null;
  const link = await prisma.accPayeeHeadAccount.findFirst({
    where: { payeeHeadId: head.id },
    include: {
      subAccount: {
        include: { mainAccount: { include: { subGL: { include: { mainGL: true } } } } },
      },
    },
  });
  if (!link?.subAccount) return null;
  const sa = link.subAccount;
  return {
    subAccountId: sa.id,
    accountCode:  sa.code,
    accountName:  sa.name,
    mainAccountId: sa.mainAccount.id,
    subGlId:      sa.mainAccount.subGL.id,
    mainGlId:     sa.mainAccount.subGL.mainGL.id,
  };
}

// Laboratory/Radiology/Ultrasound Final Bill charges are billed as ONE
// collapsed row per department (see getDischargeBillDetail's diagByDept),
// which never carries a doctor — so their per-test doctor fees can only be
// found at the source: ClinicOpdVisitDoctor rows on the admission-linked OPD
// visit. Matches clinic.service.js's own Laboratory + DIAGNOSTIC_DEPTS scope.
const OPD_DOCTOR_FEE_DEPTS = ['Laboratory', 'Radiology', 'Ultra Sound, Echo & Color Doppler'];

// Unpaid doctor fees for one doctor, optionally narrowed to a date range —
// merged from two sources so Voucher Expense's IPD Consultant Fee picker
// shows everything payable without the Final Bill screen itself changing:
//   "dbi-<id>"  — ClinicDischargeBillItem rows (Const Fee, or any row added
//                 manually via the Doctor+Sub-Department picker — not
//                 Const-Fee-only, billHead.refDepartmentId also covers
//                 Laboratory/Ultrasound/X-Ray, see that model's subDeptId
//                 comment). doctorFee is already split and stored.
//   "opdv-<id>" — ClinicOpdVisitDoctor rows from Laboratory/Radiology/
//                 Ultrasound OPD visits linked to this admission
//                 (visit.admitNo), which the Final Bill collapses into one
//                 lump-sum row per department and never assigns a doctor to.
//                 doctorFee is computed here the same way
//                 addDischargeBillItem does — from that doctor+sub-dept's
//                 configured %/amount (ClinicDoctorSubDept).
// Both use string-prefixed ids since they're picked from the same list and
// need to resolve back to two different tables on payment (see
// linkConsultantFeeItems).
// entityType, when passed, narrows both sources by patientCategory the same
// way GRN/Doctor payments and the Surgery/Anesthesia admission picker already
// split Cash vs Panel elsewhere in Accounts ('corporate' book = Panel
// admissions only, 'non-corporate' book = everything except Panel).
async function getPendingConsultantFees(doctorId, fromDate, toDate, entityType) {
  const docId = Number(doctorId);
  const dateRange = {};
  if (fromDate) dateRange.gte = new Date(`${fromDate}T00:00:00`);
  if (toDate) dateRange.lte = new Date(`${toDate}T23:59:59`);
  const patientCategoryWhere = entityType === 'corporate' ? { equals: 'panel' }
    : entityType === 'non-corporate' ? { not: 'panel' }
    : undefined;

  // ── Source 1: Discharge Bill rows ──────────────────────────────────────
  const dbiWhere = { doctorId: docId, isPaid: false, doctorFee: { not: null } };
  if (fromDate || toDate) dbiWhere.createdAt = dateRange;
  if (patientCategoryWhere) dbiWhere.admission = { patientCategory: patientCategoryWhere };
  const dbiRows = await prisma.clinicDischargeBillItem.findMany({
    where: dbiWhere,
    orderBy: { createdAt: 'desc' },
    include: {
      admission: {
        select: {
          id: true, admissionNo: true, patientTitle: true, patientName: true,
          dischargeCertificate: { select: { dischargeDate: true } },
        },
      },
    },
  });

  // subDeptId has no declared Prisma relation on this model (loose FK,
  // matches an existing ClinicSubDepartment.id) — resolved with a small
  // follow-up lookup instead of an include.
  const dbiSubDeptIds = [...new Set(dbiRows.map((r) => r.subDeptId).filter(Boolean))];
  const dbiSubDepts = dbiSubDeptIds.length
    ? await prisma.clinicSubDepartment.findMany({ where: { id: { in: dbiSubDeptIds } }, select: { id: true, name: true } })
    : [];
  const dbiSubDeptNameById = new Map(dbiSubDepts.map((s) => [s.id, s.name]));

  const dbiResults = dbiRows.map((r) => ({
    id: `dbi-${r.id}`,
    admissionId: r.admission?.id,
    admissionNo: r.admission?.admissionNo || '',
    patientName: r.admission ? `${r.admission.patientTitle || ''} ${r.admission.patientName}`.trim() : '',
    date: r.createdAt,
    // Only set once the Discharge Certificate is actually issued — a row can
    // be pending before that happens, so this legitimately shows blank for
    // still-admitted patients rather than a guessed/wrong date.
    dischargeDate: r.admission?.dischargeCertificate?.dischargeDate || null,
    subDeptName: r.subDeptId ? (dbiSubDeptNameById.get(r.subDeptId) || null) : null,
    rate: Number(r.rate) || 0,
    amount: Number(r.doctorFee) || 0,
  }));

  // ── Source 2: Laboratory/Radiology/Ultrasound OPD visit-doctor rows ────
  const opdWhere = {
    doctorId: docId,
    isPaid: false,
    visit: { admitNo: { not: null }, adjustPayment: true, department: { in: OPD_DOCTOR_FEE_DEPTS } },
  };
  if (fromDate || toDate) opdWhere.createdAt = dateRange;
  const opdRows = await prisma.clinicOpdVisitDoctor.findMany({
    where: opdWhere,
    orderBy: { createdAt: 'desc' },
    include: {
      visit: { select: { admitNo: true, patientName: true } },
      subDept: { select: { id: true, name: true } },
    },
  });

  let opdResults = [];
  if (opdRows.length) {
    const subDeptIds = [...new Set(opdRows.map((r) => r.subDeptId))];
    const links = await prisma.clinicDoctorSubDept.findMany({ where: { doctorId: docId, subDeptId: { in: subDeptIds } } });
    const linkBySubDept = new Map(links.map((l) => [l.subDeptId, l]));

    const admitNos = [...new Set(opdRows.map((r) => r.visit.admitNo).filter(Boolean))];
    const admissions = admitNos.length
      ? await prisma.clinicAdmission.findMany({
          where: { admissionNo: { in: admitNos } },
          select: { id: true, admissionNo: true, patientCategory: true, dischargeCertificate: { select: { dischargeDate: true } } },
        })
      : [];
    const admissionByNo = new Map(admissions.map((a) => [a.admissionNo, a]));

    opdResults = opdRows.map((r) => {
      const link = linkBySubDept.get(r.subDeptId);
      // No pricing link configured for this doctor+sub-dept pair — can't
      // split a real amount, so skip rather than showing 0/wrong.
      if (!link) return null;
      const admission = admissionByNo.get(r.visit.admitNo);
      // Can't classify Cash vs Panel without a resolved admission — exclude
      // rather than guess, same as an actual category mismatch.
      if (entityType === 'corporate' && admission?.patientCategory !== 'panel') return null;
      if (entityType === 'non-corporate' && (!admission || admission.patientCategory === 'panel')) return null;
      const split = clinicSvc.calcFeeSplit(Number(r.amount) || 0, link.paymentType, link.normalFees);
      return {
        id: `opdv-${r.id}`,
        admissionId: admission?.id || null,
        admissionNo: r.visit.admitNo || '',
        patientName: r.visit.patientName || '',
        date: r.createdAt,
        dischargeDate: admission?.dischargeCertificate?.dischargeDate || null,
        subDeptName: r.subDept?.name || null,
        rate: Number(r.amount) || 0,
        amount: split.doctorFee,
      };
    }).filter(Boolean);
  }

  return [...dbiResults, ...opdResults].sort((a, b) => new Date(b.date) - new Date(a.date));
}

async function getInventorySubcategories() {
  return prisma.inventorySubcategory.findMany({
    where: { status: 'active' },
    select: { id: true, code: true, name: true, category: { select: { id: true, name: true } } },
    orderBy: [{ category: { name: 'asc' } }, { name: 'asc' }],
  });
}

async function getInventoryItemsBySubcategory(subcategoryId) {
  return prisma.inventoryItem.findMany({
    where: { subcategoryId: Number(subcategoryId), status: 'active' },
    select: { id: true, code: true, name: true },
    orderBy: { name: 'asc' },
  });
}

// Inventory Head's picker list = its own inventory items PLUS the manually-
// typed entries of every Custom Head linked to it (see
// AccPayeeHeadLinkedCustomHead) — merged into one list. `optionValue` is a
// prefixed string (not the raw numeric id) since InventoryItem ids and
// AccPayeeEntry ids are separate id spaces that can collide; the frontend
// matches on this instead of id, and `kind` tells it whether picking that
// row should fill Account Name/Code (an item) or Payee Name (a person).
async function getInventoryItemsForHead(headId) {
  const head = await prisma.accPayeeHead.findUnique({
    where: { id: Number(headId) },
    include: { linkedCustomHeads: { select: { customHeadId: true } } },
  });
  if (!head) throw Object.assign(new Error('Head not found'), { status: 404 });

  const [items, entries] = await Promise.all([
    head.inventorySubcategoryId ? getInventoryItemsBySubcategory(head.inventorySubcategoryId) : [],
    head.linkedCustomHeads.length
      ? prisma.accPayeeEntry.findMany({
          where: { payeeHeadId: { in: head.linkedCustomHeads.map((l) => l.customHeadId) } },
          orderBy: { name: 'asc' },
        })
      : [],
  ]);

  return [
    ...items.map((i) => ({ optionValue: `item-${i.id}`, id: i.id, code: i.code, name: i.name, kind: 'item' })),
    ...entries.map((e) => ({ optionValue: `payee-${e.id}`, id: e.id, code: '', name: e.name, kind: 'payee' })),
  ];
}

async function linkCustomHeadToInventoryHead(headId, customHeadId) {
  const [head, customHead] = await Promise.all([
    prisma.accPayeeHead.findUnique({ where: { id: Number(headId) } }),
    prisma.accPayeeHead.findUnique({ where: { id: Number(customHeadId) } }),
  ]);
  if (!head || head.sourceType !== 'inventory') throw Object.assign(new Error('Target head must be an Inventory Head'), { status: 400 });
  if (!customHead || customHead.sourceType !== 'manual') throw Object.assign(new Error('Linked head must be a Custom Head'), { status: 400 });

  return prisma.accPayeeHeadLinkedCustomHead.create({
    data: { headId: Number(headId), customHeadId: Number(customHeadId) },
  });
}

async function unlinkCustomHeadFromInventoryHead(headId, customHeadId) {
  return prisma.accPayeeHeadLinkedCustomHead.deleteMany({
    where: { headId: Number(headId), customHeadId: Number(customHeadId) },
  });
}

async function updatePayeeHead(id, body) {
  const data = {};
  if (body.name !== undefined) data.name = body.name.trim();
  return prisma.accPayeeHead.update({
    where: { id: Number(id) },
    data,
    include: LINKED_ACCOUNTS_INCLUDE,
  });
}

async function addInventoryHeadMainAccount(headId, mainAccountId) {
  return prisma.accPayeeHeadMainAccount.create({
    data: { payeeHeadId: Number(headId), mainAccountId: Number(mainAccountId) },
    include: { mainAccount: { select: { id: true, code: true, name: true } } },
  });
}

async function removeInventoryHeadMainAccount(headId, mainAccountId) {
  return prisma.accPayeeHeadMainAccount.deleteMany({
    where: { payeeHeadId: Number(headId), mainAccountId: Number(mainAccountId) },
  });
}

async function deletePayeeHead(id) {
  return prisma.accPayeeHead.delete({ where: { id: Number(id) } });
}

async function addHeadAccount(headId, subAccountId) {
  return prisma.accPayeeHeadAccount.create({
    data: { payeeHeadId: Number(headId), subAccountId: Number(subAccountId) },
    include: {
      subAccount: { select: { id: true, code: true, name: true } },
    },
  });
}

async function removeHeadAccount(headId, subAccountId) {
  return prisma.accPayeeHeadAccount.deleteMany({
    where: { payeeHeadId: Number(headId), subAccountId: Number(subAccountId) },
  });
}

// Mirrors the frontend's prevMonthInfo() (VoucherExpenseForm.jsx) — the
// Salary modal always pays out *last* calendar month's payslip, so "already
// paid" has to be checked against that same month/year.
function getPrevMonthYear() {
  const now = new Date();
  const m = now.getMonth(); // 0-11
  const month = String(m === 0 ? 12 : m).padStart(2, '0');
  const year = String(m === 0 ? now.getFullYear() - 1 : now.getFullYear());
  return { month, year };
}

async function getPayeeEntriesBySubAccount(subAccountId, entityType) {
  const link = await prisma.accPayeeHeadAccount.findFirst({
    where: { subAccountId: Number(subAccountId), payeeHead: { entityType } },
    include: { payeeHead: { include: { inventorySubcategory: { select: { id: true, name: true } } } } },
  });
  const head = link?.payeeHead;
  if (!head) return { type: null, headName: null, headId: null, entries: [], checkedNames: [] };

  if (head.sourceType === 'employee') {
    const checkedEntries = await prisma.accPayeeEntry.findMany({
      where: { payeeHeadId: head.id, subAccountId: Number(subAccountId) },
      select: { name: true },
    });
    const checkedNames = checkedEntries.map((e) => e.name);
    const rows = await prisma.employee.findMany({
      where: { status: 'Active' },
      select: { id: true, firstName: true, lastName: true, empCode: true },
      orderBy: { firstName: 'asc' },
    });
    const allEmps = rows.map((e) => ({ id: e.id, name: `${e.firstName} ${e.lastName}`, code: e.empCode }));
    // Once an employee's previous-month salary voucher has been paid, drop
    // them from the pay-list — they only reappear once a new (unpaid) month
    // rolls around, same idea as the isPaid gates below for vendor/doctor.
    const { month: prevMonth, year: prevYear } = getPrevMonthYear();
    const paidRows = await prisma.employeeSalaryPayment.findMany({
      where: { salaryMonth: prevMonth, salaryYear: prevYear },
      select: { empCode: true },
    });
    const paidCodes = new Set(paidRows.map((r) => r.empCode));
    const dueEmps = allEmps.filter((e) => !paidCodes.has(e.code));
    const filteredEntries = checkedNames.length > 0
      ? dueEmps.filter((e) => checkedNames.includes(e.name))
      : dueEmps;
    return { type: 'employee', headName: head.name, headId: head.id, entries: filteredEntries, allEntries: dueEmps, checkedNames };
  }

  // Same employee source as above, but deliberately NOT gated by salary-paid
  // status — this head is for one-off manual payments to an employee (e.g.
  // reimbursement, bonus) where the amount isn't derived from a payslip, so
  // clicking a payee in Voucher Expense just fills the name and leaves Amount
  // for manual entry (no Salary Verification popup — see linkedHeadType
  // handling in VoucherExpenseForm.jsx, which only auto-opens that popup for
  // sourceType==='employee').
  if (head.sourceType === 'employee-manual') {
    const checkedEntries = await prisma.accPayeeEntry.findMany({
      where: { payeeHeadId: head.id, subAccountId: Number(subAccountId) },
      select: { name: true },
    });
    const checkedNames = checkedEntries.map((e) => e.name);
    const rows = await prisma.employee.findMany({
      where: { status: 'Active' },
      select: { id: true, firstName: true, lastName: true, empCode: true },
      orderBy: { firstName: 'asc' },
    });
    const allEmps = rows.map((e) => ({ id: e.id, name: `${e.firstName} ${e.lastName}`, code: e.empCode }));
    const filteredEntries = checkedNames.length > 0
      ? allEmps.filter((e) => checkedNames.includes(e.name))
      : allEmps;
    return { type: 'employee-manual', headName: head.name, headId: head.id, entries: filteredEntries, allEntries: allEmps, checkedNames };
  }

  if (head.sourceType === 'vendor') {
    const checkedEntries = await prisma.accPayeeEntry.findMany({
      where: { payeeHeadId: head.id, subAccountId: Number(subAccountId) },
      select: { name: true },
    });
    const checkedNames = checkedEntries.map((e) => e.name);
    const allSuppliers = await prisma.inventorySupplier.findMany({
      where: { status: 'active' },
      select: { id: true, name: true, code: true },
      orderBy: { name: 'asc' },
    });
    // Only suppliers with at least one unpaid GRN belong in the pay-list —
    // once every GRN is paid off, the supplier drops out until a new GRN
    // comes in. Which GRNs count depends on the GRN's own Payment Mode
    // radio (Cash / Panel): Cash GRNs are a Non-Corporate expense, Panel
    // GRNs are a Corporate expense — so each entity's Voucher Expense only
    // ever offers suppliers with unpaid GRNs of its own mode.
    const dueSupplierRows = await prisma.inventoryGRN.findMany({
      where: { isPaid: false, paymentMode: entityType === 'corporate' ? 'panel' : 'cash' },
      select: { supplierId: true },
      distinct: ['supplierId'],
    });
    const dueSupplierIds = new Set(dueSupplierRows.map((r) => r.supplierId));
    const dueSuppliers = allSuppliers.filter((s) => dueSupplierIds.has(s.id));
    const filteredEntries = checkedNames.length > 0
      ? dueSuppliers.filter((s) => checkedNames.includes(s.name))
      : dueSuppliers;
    return { type: 'vendor', headName: head.name, headId: head.id, entries: filteredEntries, allSuppliers: dueSuppliers, checkedNames };
  }

  if (head.sourceType === 'doctor') {
    const checkedEntries = await prisma.accPayeeEntry.findMany({
      where: { payeeHeadId: head.id, subAccountId: Number(subAccountId) },
      select: { name: true },
    });
    const checkedNames = checkedEntries.map((e) => e.name);
    const rows = await prisma.clinicDoctor.findMany({
      where: { status: 'active' },
      select: { id: true, name: true, code: true },
      orderBy: { name: 'asc' },
    });
    const allDoctors = rows.map((d) => ({ id: d.id, name: d.name, code: d.code }));
    // Same idea as vendor above — a doctor only belongs in the pay-list while
    // they have at least one unpaid, non-Panel visit (mirrors the exact
    // filter getConsultantVisits uses, so "shows in list" always means
    // "clicking it shows something to pay").
    const dueDoctorRows = await prisma.patientVisit.findMany({
      where: { isPaid: false, paymentType: { not: 'Panel' }, doctor: { not: null } },
      select: { doctor: true },
      distinct: ['doctor'],
    });
    const dueDoctorNames = new Set(dueDoctorRows.map((r) => r.doctor));
    const dueDoctors = allDoctors.filter((d) => dueDoctorNames.has(d.name));
    const filteredEntries = checkedNames.length > 0
      ? dueDoctors.filter((d) => checkedNames.includes(d.name))
      : dueDoctors;
    return { type: 'doctor', headName: head.name, headId: head.id, entries: filteredEntries, allEntries: dueDoctors, checkedNames };
  }

  if (head.sourceType === 'inventory') {
    if (!head.inventorySubcategoryId) return { type: 'inventory', headName: head.name, headId: head.id, entries: [], checkedNames: [] };
    const rows = await prisma.inventoryItem.findMany({
      where: { subcategoryId: head.inventorySubcategoryId, status: 'active' },
      select: { id: true, code: true, name: true },
      orderBy: { name: 'asc' },
    });
    return { type: 'inventory', headName: head.name, headId: head.id, entries: rows.map((i) => ({ id: i.id, name: i.name, code: i.code })), checkedNames: [] };
  }

  const rows = await prisma.accPayeeEntry.findMany({ where: { payeeHeadId: head.id }, orderBy: { name: 'asc' } });
  return { type: 'manual', headName: head.name, entries: rows.map((e) => ({ id: e.id, name: e.name, code: null })) };
}

// ── Payee Entries ─────────────────────────────────────────────────────────────

async function getPayeeEntries(headId, subAccountId) {
  const where = { payeeHeadId: Number(headId) };
  if (subAccountId) where.subAccountId = Number(subAccountId);
  return prisma.accPayeeEntry.findMany({ where, orderBy: { id: 'asc' } });
}

async function createPayeeEntry({ payeeHeadId, name }) {
  return prisma.accPayeeEntry.create({ data: { payeeHeadId: Number(payeeHeadId), name: name.trim() } });
}

async function deletePayeeEntry(id) {
  return prisma.accPayeeEntry.delete({ where: { id: Number(id) } });
}

async function bulkSavePayeeEntries({ payeeHeadId, subAccountId, names }) {
  const where = { payeeHeadId: Number(payeeHeadId) };
  if (subAccountId) where.subAccountId = Number(subAccountId);
  await prisma.accPayeeEntry.deleteMany({ where });
  if (names && names.length > 0) {
    await prisma.accPayeeEntry.createMany({
      data: names.map((name) => ({
        payeeHeadId: Number(payeeHeadId),
        subAccountId: subAccountId ? Number(subAccountId) : null,
        name: name.trim(),
      })),
    });
  }
  return { saved: names?.length || 0 };
}

async function getEmployeeList() {
  return prisma.employee.findMany({
    select: { id: true, firstName: true, lastName: true },
    orderBy: { firstName: 'asc' },
  });
}

async function getSupplierList() {
  return prisma.inventorySupplier.findMany({
    where: { status: 'active' },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });
}

async function getDoctorList() {
  return prisma.clinicDoctor.findMany({
    where: { status: 'active' },
    select: { id: true, name: true, code: true },
    orderBy: { name: 'asc' },
  });
}

// ── Bank Accounts ─────────────────────────────────────────────────────────────

async function getBankAccounts(entityType) {
  return prisma.accBankAccount.findMany({ where: { entityType }, orderBy: { id: 'asc' } });
}

async function createBankAccount({ bankName, accountNumber, entityType }) {
  return prisma.accBankAccount.create({ data: { bankName: bankName.trim(), accountNumber: accountNumber.trim(), entityType } });
}

async function updateBankAccount(id, { bankName, accountNumber }) {
  return prisma.accBankAccount.update({
    where: { id: Number(id) },
    data: { bankName: bankName.trim(), accountNumber: accountNumber.trim() },
  });
}

async function deleteBankAccount(id) {
  return prisma.accBankAccount.delete({ where: { id: Number(id) } });
}

// ── Cheque Serials ────────────────────────────────────────────────────────────

async function getChequeSerials(entityType, bankAccountId) {
  return prisma.accChequeSerial.findMany({
    where: bankAccountId
      ? { bankAccountId: Number(bankAccountId) }
      : { bankAccount: { entityType } },
    include: { bankAccount: { select: { bankName: true, accountNumber: true } } },
    orderBy: { id: 'asc' },
  });
}

async function createChequeSerial({ bankAccountId, fromSerial, toSerial }) {
  return prisma.accChequeSerial.create({
    data: { bankAccountId: Number(bankAccountId), fromSerial: fromSerial.trim(), toSerial: toSerial.trim() },
    include: { bankAccount: { select: { bankName: true, accountNumber: true } } },
  });
}

async function deleteChequeSerial(id) {
  return prisma.accChequeSerial.delete({ where: { id: Number(id) } });
}

async function getNextChequeSerial(bankAccountId) {
  const ranges = await prisma.accChequeSerial.findMany({
    where: { bankAccountId: Number(bankAccountId) },
    orderBy: { id: 'asc' },
  });
  if (ranges.length === 0) return null;

  const lastEntry = await prisma.accVoucherExpenseEntry.findFirst({
    where: { voucher: { bankId: Number(bankAccountId) }, chequeNo: { not: null } },
    orderBy: { id: 'desc' },
    select: { chequeNo: true },
  });

  if (!lastEntry?.chequeNo) return ranges[0].fromSerial;

  const lastNum = parseInt(lastEntry.chequeNo, 10);
  if (isNaN(lastNum)) return ranges[0].fromSerial;

  const next = lastNum + 1;
  for (const range of ranges) {
    const from = parseInt(range.fromSerial, 10);
    const to   = parseInt(range.toSerial,   10);
    if (!isNaN(from) && !isNaN(to) && next >= from && next <= to) {
      return String(next);
    }
  }
  return String(next);
}

// ── Income Categories ─────────────────────────────────────────────────────────

// ── Voucher Expense ───────────────────────────────────────────────────────────

async function getNextCashSerial(entityType) {
  const lastEntry = await prisma.accVoucherExpenseEntry.findFirst({
    where: { voucher: { mode: 'cash', entityType } },
    orderBy: { id: 'desc' },
    select: { chequeNo: true },
  });
  const last = lastEntry?.chequeNo ? parseInt(lastEntry.chequeNo, 10) : 0;
  return isNaN(last) ? 1 : last + 1;
}

async function getAllPayeeEntries(entityType) {
  return prisma.accPayeeEntry.findMany({
    where: { payeeHead: { entityType } },
    include: { payeeHead: { select: { name: true } } },
    orderBy: [{ payeeHead: { name: 'asc' } }, { name: 'asc' }],
  });
}

// ─── Business Date Helper ─────────────────────────────────────────────────────
// Hospital day runs 8 AM → 7:59:59 AM next day. Entries made before 8 AM
// still belong to the previous business day.
function getBusinessDate() {
  const now = new Date();
  if (now.getHours() < 8) now.setDate(now.getDate() - 1);
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

// ─── Expense Draft ────────────────────────────────────────────────────────────

// `date` is the voucher's own Date field from the form — when it's a real
// backdated entry (e.g. today is 11 Sept but the form's Date says 1 Sept),
// the draft now posts under THAT day instead of always today's business
// date. A blank/invalid/future date falls back to today's business date
// (never post something dated ahead of when it was actually entered).
async function saveDraftExpenseEntry({ entityType, mode, bankId, mainGlId, mainGlName, subGlId, subGlName, mainAccountId, accountCode, accountName, subAccountId, subAccountName, payeeName, amount, chequeNo, chequeDate, chequeType, particulars, date, createdByUserId, createdByName }) {
  const today = getBusinessDate();
  const businessDate = (date && /^\d{4}-\d{2}-\d{2}$/.test(date) && date <= today) ? date : today;
  return prisma.accVoucherExpenseDraft.create({
    data: {
      businessDate, entityType, mode: mode || 'cash',
      bankId: bankId ? Number(bankId) : null,
      mainGlId: Number(mainGlId), mainGlName: mainGlName || '',
      subGlId: Number(subGlId),   subGlName:  subGlName  || '',
      mainAccountId: Number(mainAccountId), accountCode: accountCode || '', accountName: accountName || '',
      subAccountId:  subAccountId ? Number(subAccountId) : null, subAccountName: subAccountName || null,
      payeeName: payeeName || null,
      amount: Number(amount),
      chequeNo: chequeNo || null, chequeDate: chequeDate ? new Date(chequeDate) : null, chequeType: chequeType || null,
      particulars: particulars || null,
      createdByUserId: createdByUserId != null ? String(createdByUserId) : null,
      createdByName: createdByName || null,
    },
  });
}

// Every still-pending draft, not just today's — a backdated one must stay
// visible/manageable here until it's actually posted, not disappear from
// view just because its date isn't today. userId narrows to "my own"
// drafts — used by Cashier Handover to total up one cashier's pending
// payments for the day; omitted everywhere else (unscoped, as before).
async function getDraftExpenses(entityType, userId) {
  return prisma.accVoucherExpenseDraft.findMany({
    where: { entityType, status: 'pending', ...(userId ? { createdByUserId: String(userId) } : {}) },
    orderBy: [{ businessDate: 'asc' }, { mainGlName: 'asc' }, { createdAt: 'asc' }],
  });
}

async function deleteDraftExpense(id) {
  const draft = await prisma.accVoucherExpenseDraft.findUnique({ where: { id: Number(id) } });
  if (!draft) throw Object.assign(new Error('Draft not found'), { status: 404 });
  if (draft.status === 'posted') throw Object.assign(new Error('Posted draft cannot be deleted'), { status: 400 });
  return prisma.accVoucherExpenseDraft.delete({ where: { id: Number(id) } });
}

// Called by day-close job (and the manual "Post Now" button): flashes every
// PENDING draft dated `date` or EARLIER — not just exactly `date` — so a
// backdated draft (Date field set to an earlier day than it was actually
// saved) still gets swept up and posted under its own real date, and any
// draft a missed day-close run left behind also self-heals on the next run
// instead of being stuck forever. Grouped by (businessDate, Main GL) — not
// Main GL alone — so each day's entries become their own voucher(s), dated
// correctly, rather than every backdated entry getting stamped with `date`.
async function flashDraftsToVouchers(date, entityType = 'non-corporate') {
  const drafts = await prisma.accVoucherExpenseDraft.findMany({
    where: { entityType, businessDate: { lte: date }, status: 'pending' },
    orderBy: { createdAt: 'asc' },
  });
  if (!drafts.length) return [];

  // Group by businessDate + mainGlId
  const groups = {};
  for (const d of drafts) {
    const key = `${d.businessDate}|${d.mainGlId}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(d);
  }

  const vouchers = [];
  for (const entries of Object.values(groups)) {
    const groupDate = entries[0].businessDate;
    const totalAmount = entries.reduce((s, e) => s + Number(e.amount), 0);
    const voucherNo   = await generateVoucherNo(entityType, groupDate);
    const voucher = await prisma.accVoucherExpense.create({
      data: {
        voucherNo, voucherType: 'CASH', voucherDate: new Date(groupDate),
        mode: 'cash', entityType, totalAmount, source: 'draft-auto',
        entries: {
          create: entries.map((e) => ({
            mainGlId:     e.mainGlId,     subGlId:      e.subGlId,
            mainAccountId: e.mainAccountId, subAccountId: e.subAccountId,
            accountCode:  e.accountCode,  accountName:  e.accountName,
            payeeName:    e.payeeName,    amount:       Number(e.amount),
            chequeNo:     e.chequeNo,     chequeDate:   e.chequeDate,
            chequeType:   e.chequeType,   particulars:  e.particulars,
          })),
        },
      },
    });
    // Mark all group's drafts as posted
    await prisma.accVoucherExpenseDraft.updateMany({
      where: { id: { in: entries.map((e) => e.id) } },
      data:  { status: 'posted', postedVoucherId: voucher.id },
    });
    vouchers.push({ voucherNo: voucher.voucherNo, mainGlName: entries[0].mainGlName, businessDate: groupDate, entriesCount: entries.length, totalAmount });
  }
  return vouchers;
}

async function generateVoucherNo(entityType, voucherDate) {
  const d = new Date(voucherDate);
  const dateStr = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const prefix = `VE-${dateStr}`;
  const count = await prisma.accVoucherExpense.count({ where: { voucherNo: { startsWith: prefix }, entityType } });
  return `${prefix}-${String(count + 1).padStart(3, '0')}`;
}

async function createVoucherExpense({ entityType, mode, bankId, voucherDate, entries }) {
  const voucherType = mode === 'cash' ? 'CASH' : 'BANK';
  const voucherNo = await generateVoucherNo(entityType, voucherDate);
  const totalAmount = entries.reduce((s, e) => s + Number(e.amount), 0);

  const voucher = await prisma.accVoucherExpense.create({
    data: {
      voucherNo, voucherType,
      voucherDate: new Date(voucherDate),
      mode,
      bankId: bankId ? Number(bankId) : null,
      entityType, totalAmount,
      entries: {
        create: entries.map((e) => ({
          mainGlId: Number(e.mainGlId),
          subGlId: Number(e.subGlId),
          mainAccountId: Number(e.mainAccountId),
          subAccountId: e.subAccountId ? Number(e.subAccountId) : null,
          accountCode: e.accountCode,
          accountName: e.accountName,
          payeeName: e.payeeName || null,
          amount: Number(e.amount),
          chequeNo: e.chequeNo || null,
          chequeDate: e.chequeDate ? new Date(e.chequeDate) : null,
          chequeType: e.chequeType || null,
          particulars: e.particulars || null,
          admissionNo: e.admissionNo || null,
        })),
      },
    },
    include: { entries: true },
  });

  const visitIds = entries.flatMap((e) => Array.isArray(e.visitIds) ? e.visitIds.map(Number) : []).filter(Boolean);
  if (visitIds.length > 0) {
    await prisma.patientVisit.updateMany({ where: { id: { in: visitIds } }, data: { isPaid: true } });
  }

  await linkGrnPayments(entries, voucher.entries);

  for (const e of entries) {
    if (e.salaryEmpCode && e.salaryMonth && e.salaryYear) {
      await prisma.employeeSalaryPayment.upsert({
        where: { empCode_salaryMonth_salaryYear: { empCode: e.salaryEmpCode, salaryMonth: e.salaryMonth, salaryYear: e.salaryYear } },
        update: {},
        create: { empCode: e.salaryEmpCode, salaryMonth: e.salaryMonth, salaryYear: e.salaryYear, voucherNo: voucher.voucherNo },
      });
    }
  }

  await linkConsultantFeeItems(entries, voucher.entries);

  return voucher;
}

// IPD Consultant Fee payee type — an entry can carry which Final Bill Const
// Fee rows (ClinicDischargeBillItem) its Amount was summed from (multiple
// admissions picked into one payment); record that link and flip each one
// isPaid so it stops showing as still-owed. `createdEntries` must be in the
// same order as `entries` — true for a fresh nested `create`, which always
// preserves input order.
// itemIds come prefixed ("dbi-123" / "opdv-45") — see getPendingConsultantFees
// for why there are two source tables — so each id is routed to its own
// table's link-record + isPaid flip instead of assuming one shape.
async function linkConsultantFeeItems(entries, createdEntries) {
  for (let i = 0; i < entries.length; i++) {
    const rawIds = Array.isArray(entries[i].consultantFeeItemIds) ? entries[i].consultantFeeItemIds : [];
    if (!rawIds.length) continue;

    const dbiIds = rawIds.filter((id) => String(id).startsWith('dbi-')).map((id) => Number(String(id).slice(4))).filter(Boolean);
    const opdIds = rawIds.filter((id) => String(id).startsWith('opdv-')).map((id) => Number(String(id).slice(5))).filter(Boolean);

    if (dbiIds.length) {
      const items = await prisma.clinicDischargeBillItem.findMany({ where: { id: { in: dbiIds } } });
      await prisma.accVoucherExpenseEntryConsultantFee.createMany({
        data: items.map((it) => ({
          voucherExpenseEntryId: createdEntries[i].id,
          dischargeBillItemId: it.id,
          amount: Number(it.doctorFee) || 0,
        })),
      });
      await prisma.clinicDischargeBillItem.updateMany({ where: { id: { in: dbiIds } }, data: { isPaid: true } });
    }

    if (opdIds.length) {
      const rows = await prisma.clinicOpdVisitDoctor.findMany({ where: { id: { in: opdIds } } });
      const links = await prisma.clinicDoctorSubDept.findMany({
        where: { OR: rows.map((r) => ({ doctorId: r.doctorId, subDeptId: r.subDeptId })) },
      });
      const linkByKey = new Map(links.map((l) => [`${l.doctorId}-${l.subDeptId}`, l]));
      await prisma.accVoucherExpenseEntryOpdDoctorFee.createMany({
        data: rows.map((r) => {
          const link = linkByKey.get(`${r.doctorId}-${r.subDeptId}`);
          const split = link ? clinicSvc.calcFeeSplit(Number(r.amount) || 0, link.paymentType, link.normalFees) : { doctorFee: 0 };
          return {
            voucherExpenseEntryId: createdEntries[i].id,
            opdVisitDoctorId: r.id,
            amount: split.doctorFee,
          };
        }),
      });
      await prisma.clinicOpdVisitDoctor.updateMany({ where: { id: { in: opdIds } }, data: { isPaid: true } });
    }
  }
}

// Supplier/GRN payment picker — same idea as linkConsultantFeeItems above,
// against InventoryGRN this time (see migration 015). Records exactly which
// voucher entry paid which GRN(s), at each GRN's own totalAmount, then flips
// isPaid so it stops showing as still-owed. Before this, the picker only
// ever bulk-flipped isPaid with no link back to the voucher — see
// getSupplierPaymentHistory's "Paid" side for why that mattered.
async function linkGrnPayments(entries, createdEntries) {
  for (let i = 0; i < entries.length; i++) {
    const grnIds = Array.isArray(entries[i].grnIds) ? entries[i].grnIds.map(Number).filter(Boolean) : [];
    if (!grnIds.length) continue;

    const grns = await prisma.inventoryGRN.findMany({ where: { id: { in: grnIds } } });
    await prisma.accVoucherExpenseEntryGrn.createMany({
      data: grns.map((g) => ({
        voucherExpenseEntryId: createdEntries[i].id,
        grnId: g.id,
        amount: Number(g.totalAmount) || 0,
      })),
    });
    await prisma.inventoryGRN.updateMany({ where: { id: { in: grnIds } }, data: { isPaid: true } });
  }
}

async function getVoucherExpenses(entityType) {
  return prisma.accVoucherExpense.findMany({
    where: { entityType },
    include: { entries: true },
    orderBy: { createdAt: 'desc' },
  });
}

// Voucher # embeds its date (VE-YYYYMMDD-NNN) and generateVoucherNo scopes
// the running count to that same date — so changing the Voucher Date on edit
// must re-slot the voucher under its new date's next free number, exactly as
// if it had been created there in the first place (e.g. edit to a date that
// already has 6 vouchers → this one becomes #7). Only regenerates when the
// date-part actually changed; saving mode/bank/entries with the date left
// alone keeps the existing number, so it isn't reassigned on every edit.
async function updateVoucherExpense(id, { mode, bankId, voucherDate, entries }) {
  const existing = await prisma.accVoucherExpense.findUnique({ where: { id: Number(id) } });
  if (!existing) throw Object.assign(new Error('Voucher not found'), { status: 404 });
  if (!Array.isArray(entries) || entries.length === 0) {
    throw Object.assign(new Error('At least one entry is required'), { status: 400 });
  }

  const voucherType = mode === 'cash' ? 'CASH' : 'BANK';
  const totalAmount = entries.reduce((s, e) => s + Number(e.amount), 0);

  const dateKey = (d) => {
    const dt = new Date(d);
    return `${dt.getFullYear()}${String(dt.getMonth() + 1).padStart(2, '0')}${String(dt.getDate()).padStart(2, '0')}`;
  };
  const dateChanged = dateKey(voucherDate) !== dateKey(existing.voucherDate);
  const voucherNo = dateChanged
    ? await generateVoucherNo(existing.entityType, voucherDate)
    : existing.voucherNo;

  // Entries get wholesale deleted/recreated below — any Const Fee rows this
  // voucher had previously marked isPaid must go back to unpaid first, or
  // they'd be stuck "paid" forever even if this edit drops them from the form.
  const oldLinks = await prisma.accVoucherExpenseEntryConsultantFee.findMany({
    where: { voucherExpenseEntry: { voucherId: Number(id) } },
    select: { dischargeBillItemId: true },
  });
  if (oldLinks.length) {
    await prisma.clinicDischargeBillItem.updateMany({
      where: { id: { in: oldLinks.map((l) => l.dischargeBillItemId) } },
      data: { isPaid: false },
    });
  }

  await prisma.accVoucherExpenseEntry.deleteMany({ where: { voucherId: Number(id) } });

  const voucher = await prisma.accVoucherExpense.update({
    where: { id: Number(id) },
    data: {
      voucherNo,
      voucherType,
      voucherDate: new Date(voucherDate),
      mode,
      bankId: bankId ? Number(bankId) : null,
      totalAmount,
      entries: {
        create: entries.map((e) => ({
          mainGlId: Number(e.mainGlId),
          subGlId: Number(e.subGlId),
          mainAccountId: Number(e.mainAccountId),
          subAccountId: e.subAccountId ? Number(e.subAccountId) : null,
          accountCode: e.accountCode,
          accountName: e.accountName,
          payeeName: e.payeeName || null,
          amount: Number(e.amount),
          chequeNo: e.chequeNo || null,
          chequeDate: e.chequeDate ? new Date(e.chequeDate) : null,
          chequeType: e.chequeType || null,
          particulars: e.particulars || null,
          admissionNo: e.admissionNo || null,
        })),
      },
    },
    include: { entries: true },
  });

  await linkConsultantFeeItems(entries, voucher.entries);

  return voucher;
}

async function deleteVoucherExpense(id) {
  const existing = await prisma.accVoucherExpense.findUnique({ where: { id: Number(id) } });
  if (!existing) throw Object.assign(new Error('Voucher not found'), { status: 404 });

  // Reset isPaid on any consultant-fee discharge bill items this voucher had paid
  const oldLinks = await prisma.accVoucherExpenseEntryConsultantFee.findMany({
    where: { voucherExpenseEntry: { voucherId: Number(id) } },
    select: { dischargeBillItemId: true },
  });
  if (oldLinks.length) {
    await prisma.clinicDischargeBillItem.updateMany({
      where: { id: { in: oldLinks.map((l) => l.dischargeBillItemId) } },
      data: { isPaid: false },
    });
  }

  // Same reset for any GRNs this voucher had paid (see migration 015 /
  // linkGrnPayments) — otherwise a deleted voucher would leave the GRN
  // stuck "Paid" forever with no way to actually pay it again.
  const oldGrnLinks = await prisma.accVoucherExpenseEntryGrn.findMany({
    where: { voucherExpenseEntry: { voucherId: Number(id) } },
    select: { grnId: true },
  });
  if (oldGrnLinks.length) {
    await prisma.inventoryGRN.updateMany({
      where: { id: { in: oldGrnLinks.map((l) => l.grnId) } },
      data: { isPaid: false },
    });
  }

  // AccVoucherExpenseEntry (and its children) cascade-delete automatically
  await prisma.accVoucherExpense.delete({ where: { id: Number(id) } });
  return { deleted: true, id: Number(id) };
}

async function getIncomeCategories(entityType) {
  return prisma.accIncomeCategory.findMany({ where: { entityType }, orderBy: { id: 'asc' } });
}

async function createIncomeCategory({ name, entityType }) {
  return prisma.accIncomeCategory.create({ data: { name: name.trim(), entityType } });
}

async function updateIncomeCategory(id, { name }) {
  return prisma.accIncomeCategory.update({ where: { id: Number(id) }, data: { name: name.trim() } });
}

async function deleteIncomeCategory(id) {
  return prisma.accIncomeCategory.delete({ where: { id: Number(id) } });
}

function normDoctorRateName(s) {
  return String(s || '').toLowerCase().replace(/[-._]/g, ' ').replace(/\s+/g, ' ').trim();
}

async function getConsultantVisits(doctorName, dateFrom, dateTo) {
  // Panel patients are billed to the panel/company, not paid in cash by the
  // patient — the doctor/consultant is not paid out of these visits, so they
  // must never show up (or count toward the amount) in the voucher expense
  // payment list.
  const where = { doctor: doctorName, isPaid: false, paymentType: { not: 'Panel' } };
  if (dateFrom) where.visitDate = { ...(where.visitDate || {}), gte: new Date(dateFrom) };
  if (dateTo)   where.visitDate = { ...(where.visitDate || {}), lte: new Date(dateTo) };

  const [visits, rateRows] = await Promise.all([
    prisma.patientVisit.findMany({
      where,
      orderBy: [{ visitDate: 'asc' }, { visitTime: 'asc' }],
      select: { id: true, serialNo: true, visitDate: true, visitTime: true, patientName: true, subDepartment: true, paymentType: true, received: true },
    }),
    // Same doctor/sub-department fee-share table the Consultant Wise Report
    // uses (Clinic → Doctors → Sub-Department Rates) — reused here so the
    // voucher amount matches that report instead of paying out the full
    // patient-collected amount.
    clinicSvc.getDoctorSubDeptRates(),
  ]);

  const dk = normDoctorRateName(doctorName);
  const bySubDept = {};
  let firstRate = null;
  for (const r of rateRows) {
    if (normDoctorRateName(r.doctorName) !== dk) continue;
    const sk = normDoctorRateName(r.subDeptName);
    if (!bySubDept[sk]) bySubDept[sk] = r;
    if (!firstRate) firstRate = r;
  }

  return visits.map((v) => {
    const received = Number(v.received || 0);
    const rate = bySubDept[normDoctorRateName(v.subDepartment)] || firstRate;
    const hasRate = !!(rate && rate.normalFees);
    const payableAmount = hasRate
      ? (rate.paymentType === 'percent' ? received * rate.normalFees / 100 : rate.normalFees)
      : received;
    return { ...v, received, payableAmount, hasRate, ratePercent: hasRate && rate.paymentType === 'percent' ? rate.normalFees : null };
  });
}

async function getSupplierGRNs(supplierId, entityType) {
  return prisma.inventoryGRN.findMany({
    where: {
      supplierId: Number(supplierId),
      isPaid: false,
      paymentMode: entityType === 'corporate' ? 'panel' : 'cash',
    },
    include: { item: { select: { name: true } } },
    orderBy: { receivedDate: 'desc' },
  });
}

// ── Voucher Income ────────────────────────────────────────────────────────────

async function generateIncomeVoucherNo(entityType, voucherDate) {
  const d = new Date(voucherDate);
  const dateStr = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const prefix = `VI-${dateStr}`;
  const count = await prisma.accVoucherIncome.count({ where: { voucherNo: { startsWith: prefix }, entityType } });
  return `${prefix}-${String(count + 1).padStart(3, '0')}`;
}

async function createVoucherIncome({ entityType, mode, bankId, voucherDate, entries }) {
  const voucherType = mode === 'cash' ? 'CASH' : mode === 'card' ? 'CARD' : 'BANK';
  const voucherNo = await generateIncomeVoucherNo(entityType, voucherDate);
  const totalAmount = entries.reduce((s, e) => s + Number(e.amount), 0);
  return prisma.accVoucherIncome.create({
    data: {
      voucherNo, voucherType,
      voucherDate: new Date(voucherDate),
      mode,
      bankId: bankId ? Number(bankId) : null,
      entityType, totalAmount,
      entries: {
        create: entries.map((e) => ({
          incomeCategoryId:   e.incomeCategoryId ? Number(e.incomeCategoryId) : null,
          incomeCategoryName: e.incomeCategoryName || null,
          amount:             Number(e.amount),
          particulars:        e.particulars || null,
        })),
      },
    },
    include: { entries: true },
  });
}

// Reports > GL Balance Report — all 5 Report Types (Summary, Summary Sub,
// Detail Voucher, Detail Summary, Account Level Summary) come off the same
// Main GL > Sub GL > Payee tree; the type just controls how deep it renders
// and whether individual vouchers stay separate or get summed per payee.
// There is no per-payee "Account" row in this chart of accounts (see the
// Payee Name filter's own comment above) — Payee Name is the leaf, always.
async function getGLBalanceReport({ entityType, mainGlId, subGlId, mainAccountId, subAccountId, payeeName, dateFrom, dateTo, reportType }) {
  const voucherFilter = { entityType };
  if (dateFrom || dateTo) {
    voucherFilter.voucherDate = {};
    if (dateFrom) voucherFilter.voucherDate.gte = new Date(dateFrom);
    if (dateTo) voucherFilter.voucherDate.lte = new Date(dateTo + 'T23:59:59');
  }
  const entryWhere = { voucher: voucherFilter };
  if (mainGlId) entryWhere.mainGlId = Number(mainGlId);
  if (subGlId) entryWhere.subGlId = Number(subGlId);
  if (mainAccountId) entryWhere.mainAccountId = Number(mainAccountId);
  if (subAccountId) entryWhere.subAccountId = Number(subAccountId);
  if (payeeName) entryWhere.payeeName = payeeName;

  const entries = await prisma.accVoucherExpenseEntry.findMany({
    where: entryWhere,
    include: { voucher: { select: { voucherNo: true, voucherDate: true } } },
    orderBy: { id: 'asc' },
  });
  if (!entries.length) return { reportType, groups: [], grandTotal: 0 };

  const mainGlIds = [...new Set(entries.map((e) => e.mainGlId))];
  const subGlIdsAll = [...new Set(entries.map((e) => e.subGlId))];
  const [mainGLs, subGLs] = await Promise.all([
    prisma.accMainGL.findMany({ where: { id: { in: mainGlIds } } }),
    prisma.accSubGL.findMany({ where: { id: { in: subGlIdsAll } } }),
  ]);
  const mainGlById = new Map(mainGLs.map((g) => [g.id, g]));
  const subGlById = new Map(subGLs.map((g) => [g.id, g]));

  const wantsSubGl = reportType !== 'Summary';
  const wantsPayeeRows = ['Detail Voucher', 'Detail Summary', 'Account Level Summary'].includes(reportType);
  const wantsVoucherRows = reportType === 'Detail Voucher';

  // Main GL -> Sub GL -> payeeName, each level's Map preserves first-seen
  // (i.e. chronological voucher) order, which Account Level Summary then
  // re-sorts at the payee level only.
  const mainMap = new Map();
  for (const e of entries) {
    const amt = Number(e.amount);
    if (!mainMap.has(e.mainGlId)) mainMap.set(e.mainGlId, { total: 0, subMap: new Map() });
    const mg = mainMap.get(e.mainGlId);
    mg.total += amt;
    if (!wantsSubGl) continue;

    if (!mg.subMap.has(e.subGlId)) mg.subMap.set(e.subGlId, { total: 0, payeeMap: new Map() });
    const sg = mg.subMap.get(e.subGlId);
    sg.total += amt;
    if (!wantsPayeeRows) continue;

    const key = e.payeeName || '(no name)';
    if (!sg.payeeMap.has(key)) sg.payeeMap.set(key, { total: 0, rows: [] });
    const p = sg.payeeMap.get(key);
    p.total += amt;
    if (wantsVoucherRows) {
      p.rows.push({
        payeeName: e.payeeName || '',
        voucherNo: e.voucher.voucherNo,
        voucherDate: e.voucher.voucherDate,
        chequeNo: e.chequeNo || '',
        amount: amt,
      });
    }
  }

  const groups = [...mainMap.entries()].map(([mgId, mg]) => {
    const glInfo = mainGlById.get(mgId);
    let subGroups = [];
    if (wantsSubGl) {
      subGroups = [...mg.subMap.entries()].map(([sgId, sg]) => {
        const sgInfo = subGlById.get(sgId);
        let payeeRows = [];
        if (wantsPayeeRows) {
          payeeRows = [...sg.payeeMap.entries()].map(([name, p]) => ({
            payeeName: name, amount: p.total, rows: p.rows,
          }));
          if (reportType === 'Account Level Summary') {
            payeeRows.sort((a, b) => a.payeeName.localeCompare(b.payeeName));
          }
        }
        return { code: sgInfo?.code || '', name: sgInfo?.name || '', total: sg.total, payeeRows };
      });
    }
    return { code: glInfo?.code || '', name: glInfo?.name || '', total: mg.total, subGroups };
  });

  const grandTotal = groups.reduce((s, g) => s + g.total, 0);
  return { reportType, groups, grandTotal };
}

// Reports > GL Balance Report's 5th filter (Payee Name) — the chart of
// accounts has no per-payee code (see e.g. every Salary entry sharing one
// Sub Account, distinguished only by payeeName), so instead of a formal
// lookup table this just surfaces every distinct payeeName actually used in
// this entityType's Expense vouchers.
async function getDistinctPayeeNames(entityType) {
  const rows = await prisma.accVoucherExpenseEntry.findMany({
    where: { payeeName: { not: null }, voucher: { entityType } },
    select: { payeeName: true },
    distinct: ['payeeName'],
    orderBy: { payeeName: 'asc' },
  });
  return rows.map((r) => r.payeeName).filter(Boolean);
}

// Reports > Consultant Payment History — two status groups (Un-Paid/Payable,
// Paid), each broken down by consultant. Un-Paid never has a real voucher
// (nothing to pay it with yet), so per explicit decision it's exempt from
// the Voucher Date/Voucher # filters entirely — only Paid rows, which do
// have a real voucher behind them, get filtered by those.
//   IPD  -> ClinicDischargeBillItem (Const Fee rows, doctorFee != null),
//           paid via AccVoucherExpenseEntryConsultantFee.
//   OPD  -> ClinicOpdVisitDoctor rows, paid via
//           AccVoucherExpenseEntryOpdDoctorFee.
// These names match the two Payee Head types this system already has
// ("IPD Consultant Fee" / "OPD Doctor Fee") — not literally "is this
// patient an OPD or Indoor patient".
async function getConsultantPaymentHistory({
  entityType, consultantFrom, consultantTo, dateFrom, dateTo, voucherFrom, voucherTo, reportType, opdIndoor, paymentType,
}) {
  const doctorWhere = {};
  if (consultantFrom || consultantTo) {
    doctorWhere.code = {};
    if (consultantFrom) doctorWhere.code.gte = consultantFrom;
    if (consultantTo) doctorWhere.code.lte = consultantTo;
  }
  const doctors = await prisma.clinicDoctor.findMany({ where: doctorWhere, select: { id: true, code: true, name: true } });
  const doctorIds = doctors.map((d) => d.id);
  const doctorById = new Map(doctors.map((d) => [d.id, d]));
  if (!doctorIds.length) return { reportType, statusGroups: [], grandTotal: 0 };

  const wantsUnpaid = paymentType !== 'Paid';
  const wantsPaid = paymentType !== 'Payable';
  const isIpd = opdIndoor === 'IPD';

  const voucherFilter = { entityType };
  if (dateFrom || dateTo) {
    voucherFilter.voucherDate = {};
    if (dateFrom) voucherFilter.voucherDate.gte = new Date(dateFrom);
    if (dateTo) voucherFilter.voucherDate.lte = new Date(dateTo + 'T23:59:59');
  }
  if (voucherFrom || voucherTo) {
    voucherFilter.voucherNo = {};
    if (voucherFrom) voucherFilter.voucherNo.gte = voucherFrom;
    if (voucherTo) voucherFilter.voucherNo.lte = voucherTo;
  }

  let unpaidRows = [];
  let paidRows = [];

  if (isIpd) {
    if (wantsUnpaid) {
      const items = await prisma.clinicDischargeBillItem.findMany({
        where: { doctorId: { in: doctorIds }, doctorFee: { not: null }, isPaid: false },
        include: { admission: { select: { admissionNo: true, patientName: true, patientTitle: true, createdAt: true } } },
      });
      unpaidRows = items.map((i) => ({
        doctorId: i.doctorId,
        admitNo: i.admission?.admissionNo || '',
        patName: `${i.admission?.patientTitle || ''} ${i.admission?.patientName || ''}`.trim(),
        opDate: i.admission?.createdAt || null,
        amount: Number(i.doctorFee || 0),
        voucherNo: '',
      }));
    }
    if (wantsPaid) {
      const links = await prisma.accVoucherExpenseEntryConsultantFee.findMany({
        where: {
          dischargeBillItem: { doctorId: { in: doctorIds } },
          voucherExpenseEntry: { voucher: voucherFilter },
        },
        include: {
          dischargeBillItem: { include: { admission: { select: { admissionNo: true, patientName: true, patientTitle: true } } } },
          voucherExpenseEntry: { include: { voucher: { select: { voucherNo: true, voucherDate: true } } } },
        },
      });
      paidRows = links.map((l) => ({
        doctorId: l.dischargeBillItem.doctorId,
        admitNo: l.dischargeBillItem.admission?.admissionNo || '',
        patName: `${l.dischargeBillItem.admission?.patientTitle || ''} ${l.dischargeBillItem.admission?.patientName || ''}`.trim(),
        opDate: l.voucherExpenseEntry.voucher.voucherDate,
        amount: Number(l.amount || 0),
        voucherNo: l.voucherExpenseEntry.voucher.voucherNo,
      }));
    }
  } else {
    if (wantsUnpaid) {
      const items = await prisma.clinicOpdVisitDoctor.findMany({
        where: { doctorId: { in: doctorIds }, isPaid: false },
        include: { visit: { select: { patientName: true, createdAt: true } } },
      });
      unpaidRows = items.map((i) => ({
        doctorId: i.doctorId,
        admitNo: '',
        patName: i.visit?.patientName || '',
        opDate: i.visit?.createdAt || null,
        amount: Number(i.amount || 0),
        voucherNo: '',
      }));
    }
    if (wantsPaid) {
      const links = await prisma.accVoucherExpenseEntryOpdDoctorFee.findMany({
        where: {
          opdVisitDoctor: { doctorId: { in: doctorIds } },
          voucherExpenseEntry: { voucher: voucherFilter },
        },
        include: {
          opdVisitDoctor: { include: { visit: { select: { patientName: true } } } },
          voucherExpenseEntry: { include: { voucher: { select: { voucherNo: true, voucherDate: true } } } },
        },
      });
      paidRows = links.map((l) => ({
        doctorId: l.opdVisitDoctor.doctorId,
        admitNo: '',
        patName: l.opdVisitDoctor.visit?.patientName || '',
        opDate: l.voucherExpenseEntry.voucher.voucherDate,
        amount: Number(l.amount || 0),
        voucherNo: l.voucherExpenseEntry.voucher.voucherNo,
      }));
    }
  }

  function buildGroup(status, label, rows) {
    const byDoctor = new Map();
    for (const r of rows) {
      if (!byDoctor.has(r.doctorId)) byDoctor.set(r.doctorId, []);
      byDoctor.get(r.doctorId).push(r);
    }
    const consultants = [...byDoctor.entries()].map(([docId, rws]) => {
      const doc = doctorById.get(docId);
      const total = rws.reduce((s, r) => s + r.amount, 0);
      return {
        code: doc?.code || '', name: doc?.name || '', count: rws.length, total,
        rows: reportType === 'Detail' ? rws : [],
      };
    });
    const total = consultants.reduce((s, c) => s + c.total, 0);
    return { status, label, consultants, total };
  }

  const statusGroups = [];
  if (wantsUnpaid) statusGroups.push(buildGroup('N', 'Un-Paid', unpaidRows));
  if (wantsPaid) statusGroups.push(buildGroup('Y', 'Paid', paidRows));

  const grandTotal = statusGroups.reduce((s, g) => s + g.total, 0);
  return { reportType, statusGroups, grandTotal };
}

// Reports > Supplier Payment History — same shape as Consultant Payment
// History (two status groups, Un-Paid exempt from the Voucher Date/# filters
// since it has no real voucher yet). Source is InventoryGRN throughout:
//   Un-Paid -> GRN rows with isPaid = false.
//   Paid    -> AccVoucherExpenseEntryGrn links (see migration 015 /
//              linkGrnPayments) — only covers GRNs paid from that point on;
//              earlier ones have isPaid=true with no recoverable Voucher No.
async function getSupplierPaymentHistory({
  entityType, supplierFrom, supplierTo, dateFrom, dateTo, voucherFrom, voucherTo, reportType, paymentType,
}) {
  const supplierWhere = {};
  if (supplierFrom || supplierTo) {
    supplierWhere.code = {};
    if (supplierFrom) supplierWhere.code.gte = supplierFrom;
    if (supplierTo) supplierWhere.code.lte = supplierTo;
  }
  const suppliers = await prisma.inventorySupplier.findMany({ where: supplierWhere, select: { id: true, code: true, name: true } });
  const supplierIds = suppliers.map((s) => s.id);
  const supplierById = new Map(suppliers.map((s) => [s.id, s]));
  if (!supplierIds.length) return { reportType, statusGroups: [], grandTotal: 0 };

  const wantsUnpaid = paymentType !== 'Paid';
  const wantsPaid = paymentType !== 'Payable';

  const voucherFilter = { entityType };
  if (dateFrom || dateTo) {
    voucherFilter.voucherDate = {};
    if (dateFrom) voucherFilter.voucherDate.gte = new Date(dateFrom);
    if (dateTo) voucherFilter.voucherDate.lte = new Date(dateTo + 'T23:59:59');
  }
  if (voucherFrom || voucherTo) {
    voucherFilter.voucherNo = {};
    if (voucherFrom) voucherFilter.voucherNo.gte = voucherFrom;
    if (voucherTo) voucherFilter.voucherNo.lte = voucherTo;
  }

  let unpaidRows = [];
  let paidRows = [];

  if (wantsUnpaid) {
    const grns = await prisma.inventoryGRN.findMany({
      where: { supplierId: { in: supplierIds }, isPaid: false },
      include: { item: { select: { name: true } } },
    });
    unpaidRows = grns.map((g) => ({
      supplierId: g.supplierId,
      grnCode: g.code,
      itemName: g.item?.name || '',
      opDate: g.billDate || g.receivedDate,
      amount: Number(g.totalAmount || 0),
      voucherNo: '',
    }));
  }
  if (wantsPaid) {
    const links = await prisma.accVoucherExpenseEntryGrn.findMany({
      where: {
        grn: { supplierId: { in: supplierIds } },
        voucherExpenseEntry: { voucher: voucherFilter },
      },
      include: {
        grn: { include: { item: { select: { name: true } } } },
        voucherExpenseEntry: { include: { voucher: { select: { voucherNo: true, voucherDate: true } } } },
      },
    });
    paidRows = links.map((l) => ({
      supplierId: l.grn.supplierId,
      grnCode: l.grn.code,
      itemName: l.grn.item?.name || '',
      opDate: l.voucherExpenseEntry.voucher.voucherDate,
      amount: Number(l.amount || 0),
      voucherNo: l.voucherExpenseEntry.voucher.voucherNo,
    }));
  }

  function buildGroup(status, label, rows) {
    const bySupplier = new Map();
    for (const r of rows) {
      if (!bySupplier.has(r.supplierId)) bySupplier.set(r.supplierId, []);
      bySupplier.get(r.supplierId).push(r);
    }
    const items = [...bySupplier.entries()].map(([supId, rws]) => {
      const sup = supplierById.get(supId);
      const total = rws.reduce((s, r) => s + r.amount, 0);
      return {
        code: sup?.code || '', name: sup?.name || '', count: rws.length, total,
        rows: reportType === 'Detail' ? rws : [],
      };
    });
    const total = items.reduce((s, c) => s + c.total, 0);
    return { status, label, suppliers: items, total };
  }

  const statusGroups = [];
  if (wantsUnpaid) statusGroups.push(buildGroup('N', 'Un-Paid', unpaidRows));
  if (wantsPaid) statusGroups.push(buildGroup('Y', 'Paid', paidRows));

  const grandTotal = statusGroups.reduce((s, g) => s + g.total, 0);
  return { reportType, statusGroups, grandTotal };
}

async function getVoucherIncomes(entityType) {
  return prisma.accVoucherIncome.findMany({
    where: { entityType },
    include: { entries: true },
    orderBy: { createdAt: 'desc' },
  });
}

// Auto-generated (Day Close) vouchers are meant to stay frozen — reject the
// edit outright rather than silently letting one drift from what was booked.
// Voucher # embeds its date (VI-YYYYMMDD-NNN, see generateIncomeVoucherNo) —
// changing the Voucher Date on edit re-slots it under the new date's next
// free number, same reasoning as updateVoucherExpense.
async function updateVoucherIncome(id, { mode, bankId, voucherDate, entries }) {
  const existing = await prisma.accVoucherIncome.findUnique({ where: { id: Number(id) } });
  if (!existing) throw Object.assign(new Error('Voucher not found'), { status: 404 });
  if (existing.source === 'auto') {
    throw Object.assign(new Error('Auto-generated (Day Close) vouchers cannot be edited'), { status: 403 });
  }
  if (!Array.isArray(entries) || entries.length === 0) {
    throw Object.assign(new Error('At least one entry is required'), { status: 400 });
  }

  const voucherType = mode === 'cash' ? 'CASH' : mode === 'card' ? 'CARD' : 'BANK';
  const totalAmount = entries.reduce((s, e) => s + Number(e.amount), 0);

  const dateKey = (d) => {
    const dt = new Date(d);
    return `${dt.getFullYear()}${String(dt.getMonth() + 1).padStart(2, '0')}${String(dt.getDate()).padStart(2, '0')}`;
  };
  const dateChanged = dateKey(voucherDate) !== dateKey(existing.voucherDate);
  const voucherNo = dateChanged
    ? await generateIncomeVoucherNo(existing.entityType, voucherDate)
    : existing.voucherNo;

  await prisma.accVoucherIncomeEntry.deleteMany({ where: { voucherId: Number(id) } });

  return prisma.accVoucherIncome.update({
    where: { id: Number(id) },
    data: {
      voucherNo,
      voucherType,
      voucherDate: new Date(voucherDate),
      mode,
      bankId: bankId ? Number(bankId) : null,
      totalAmount,
      entries: {
        create: entries.map((e) => ({
          incomeCategoryId:   e.incomeCategoryId ? Number(e.incomeCategoryId) : null,
          incomeCategoryName: e.incomeCategoryName || null,
          amount:             Number(e.amount),
          particulars:        e.particulars || null,
        })),
      },
    },
    include: { entries: true },
  });
}

async function getVouchersForReprint({ type, entityType, voucherFrom, voucherTo, dateFrom, dateTo }) {
  const where = { entityType };
  if (voucherFrom || voucherTo) {
    where.voucherNo = {};
    if (voucherFrom) where.voucherNo.gte = voucherFrom;
    if (voucherTo)   where.voucherNo.lte = voucherTo;
  }
  if (dateFrom || dateTo) {
    where.voucherDate = {};
    if (dateFrom) where.voucherDate.gte = new Date(dateFrom);
    if (dateTo)   where.voucherDate.lte = new Date(new Date(dateTo).setHours(23, 59, 59, 999));
  }

  if (type === 'expense') {
    const vouchers = await prisma.accVoucherExpense.findMany({
      where, include: { entries: true }, orderBy: { voucherNo: 'desc' },
    });

    const allEntries = vouchers.flatMap((v) => v.entries);
    const mainGlIds  = [...new Set(allEntries.map((e) => e.mainGlId).filter(Boolean))];
    const subGlIds   = [...new Set(allEntries.map((e) => e.subGlId).filter(Boolean))];
    const mainAccIds = [...new Set(allEntries.map((e) => e.mainAccountId).filter(Boolean))];
    const subAccIds  = [...new Set(allEntries.map((e) => e.subAccountId).filter(Boolean))];

    const [mainGLs, subGLs, mainAccs, subAccs] = await Promise.all([
      mainGlIds.length  ? prisma.accMainGL.findMany({ where: { id: { in: mainGlIds } } })        : [],
      subGlIds.length   ? prisma.accSubGL.findMany({ where: { id: { in: subGlIds } } })          : [],
      mainAccIds.length ? prisma.accMainAccount.findMany({ where: { id: { in: mainAccIds } } })  : [],
      subAccIds.length  ? prisma.accSubAccount.findMany({ where: { id: { in: subAccIds } } })    : [],
    ]);

    const mgMap = Object.fromEntries(mainGLs.map((x) => [x.id, x.name]));
    const sgMap = Object.fromEntries(subGLs.map((x) => [x.id, x.name]));
    const maMap = Object.fromEntries(mainAccs.map((x) => [x.id, x.name]));
    const saMap = Object.fromEntries(subAccs.map((x) => [x.id, x.name]));

    return vouchers.map((v) => ({
      ...v,
      entries: v.entries.map((e) => ({
        ...e,
        mainGlName:      mgMap[e.mainGlId]      || '',
        subGlName:       sgMap[e.subGlId]       || '',
        mainAccountName: maMap[e.mainAccountId] || '',
        subAccountName:  saMap[e.subAccountId]  || '',
      })),
    }));
  }

  return prisma.accVoucherIncome.findMany({ where, include: { entries: true }, orderBy: { voucherNo: 'desc' } });
}

async function getNextVoucherNo(type, entityType, voucherDate) {
  if (type === 'expense') return generateVoucherNo(entityType, voucherDate);
  if (type === 'income')  return generateIncomeVoucherNo(entityType, voucherDate);
  throw new Error('Invalid type');
}

async function createBankDeposit({ bankAccountId, depositOf, depositDate, depositSlipNo, depositedBy, amount, entityType }) {
  return prisma.accBankDeposit.create({
    data: {
      bankAccountId: Number(bankAccountId),
      depositOf:     new Date(depositOf),
      depositDate:   new Date(depositDate),
      depositSlipNo: depositSlipNo?.trim() || null,
      depositedBy:   depositedBy?.trim()   || null,
      amount:        Number(amount),
      entityType,
    },
    include: { bankAccount: { select: { bankName: true, accountNumber: true } } },
  });
}

// Looks up the actual recorded Bank Deposit for a bank+date so the Deposit
// Adjustment form can auto-fill its "POSTED" column instead of having the
// user re-type numbers that already exist in the system.
async function getBankDepositForDate({ entityType, bankAccountId, depositOf }) {
  if (!bankAccountId || !depositOf) return null;
  return prisma.accBankDeposit.findFirst({
    where: { entityType, bankAccountId: Number(bankAccountId), depositOf: new Date(depositOf) },
    orderBy: { createdAt: 'desc' },
  });
}

async function createBankDepositAdj({ bankAccountId, postedDepositOf, postedDepositDate, postedDepositSlipNo, postedDepositedBy, postedAmount, adjDepositDate, adjDepositSlipNo, adjDepositedBy, adjAmount, adjustedBy, entityType }) {
  return prisma.accBankDepositAdj.create({
    data: {
      bankAccountId:      Number(bankAccountId),
      postedDepositOf:    new Date(postedDepositOf),
      postedDepositDate:  new Date(postedDepositDate),
      postedDepositSlipNo: postedDepositSlipNo?.trim() || null,
      postedDepositedBy:  postedDepositedBy?.trim()   || null,
      postedAmount:       Number(postedAmount),
      adjDepositDate:     new Date(adjDepositDate),
      adjDepositSlipNo:   adjDepositSlipNo?.trim()    || null,
      adjDepositedBy:     adjDepositedBy?.trim()      || null,
      adjAmount:          Number(adjAmount),
      adjustedBy:         adjustedBy?.trim()          || null,
      entityType,
    },
    include: { bankAccount: { select: { bankName: true, accountNumber: true } } },
  });
}

async function getBankDepositAdjs(entityType) {
  return prisma.accBankDepositAdj.findMany({
    where: { entityType },
    orderBy: { createdAt: 'desc' },
    include: { bankAccount: { select: { bankName: true, accountNumber: true } } },
  });
}

// Reports > Voucher (Expense) Summary Matrix — same crosstab shape as
// getIncomeSummaryMatrix: one row per calendar day in the range, one column
// per Main GL (instead of Account Category), cell = that day's Expense
// total for that GL. Every calendar day is emitted, even zero-expense ones.
async function getVoucherSummaryMatrix({ entityType, mainGlFrom, mainGlTo, dateFrom, dateTo }) {
  const glWhere = { entityType };
  if (mainGlFrom || mainGlTo) {
    glWhere.code = {};
    if (mainGlFrom) glWhere.code.gte = mainGlFrom;
    if (mainGlTo) glWhere.code.lte = mainGlTo;
  }
  const mainGLs = await prisma.accMainGL.findMany({ where: glWhere, orderBy: { code: 'asc' } });
  const glIds = new Set(mainGLs.map((g) => g.id));

  const where = { entityType };
  if (dateFrom || dateTo) {
    where.voucherDate = {};
    if (dateFrom) where.voucherDate.gte = new Date(dateFrom);
    if (dateTo) where.voucherDate.lte = new Date(dateTo + 'T23:59:59');
  }
  const vouchers = await prisma.accVoucherExpense.findMany({ where, include: { entries: true } });

  const byDate = {};
  if (dateFrom && dateTo) {
    const d = new Date(dateFrom);
    const end = new Date(dateTo);
    while (d <= end) {
      byDate[d.toISOString().slice(0, 10)] = {};
      d.setDate(d.getDate() + 1);
    }
  }

  for (const v of vouchers) {
    const day = v.voucherDate.toISOString().slice(0, 10);
    if (!byDate[day]) byDate[day] = {};
    for (const e of v.entries) {
      if (!e.mainGlId || !glIds.has(e.mainGlId)) continue;
      byDate[day][e.mainGlId] = (byDate[day][e.mainGlId] || 0) + Number(e.amount);
    }
  }

  const rows = Object.keys(byDate).sort().map((date) => {
    const amounts = byDate[date];
    const total = Object.values(amounts).reduce((s, a) => s + a, 0);
    return { date, amounts, total };
  });

  const columnTotals = {};
  let grandTotal = 0;
  for (const row of rows) {
    for (const gl of mainGLs) {
      const amt = row.amounts[gl.id] || 0;
      columnTotals[gl.id] = (columnTotals[gl.id] || 0) + amt;
    }
    grandTotal += row.total;
  }

  return { mainGLs, rows, columnTotals, grandTotal };
}

// Reports > Income Summary Matrix — one row per calendar day in the range,
// one column per Account Category (AccIncomeCategory), cell = that day's
// income for that category (Auto day-close AND manual Voucher Income
// entries both count — a category is a category regardless of how the
// voucher behind it was created). Mirrors getVoucherSummaryMatrix's
// day-then-dimension grouping shape, keyed by incomeCategoryId instead of
// mainGlId, plus every calendar day is emitted (even zero-income ones) since
// the legacy report this replaces always printed a full date range.
async function getIncomeSummaryMatrix({ entityType, categoryFrom, categoryTo, dateFrom, dateTo }) {
  const catWhere = { entityType };
  if (categoryFrom || categoryTo) {
    catWhere.name = {};
    if (categoryFrom) catWhere.name.gte = categoryFrom;
    if (categoryTo) catWhere.name.lte = categoryTo;
  }
  const categories = await prisma.accIncomeCategory.findMany({ where: catWhere, orderBy: { name: 'asc' } });
  const categoryIds = new Set(categories.map((c) => c.id));

  const where = { entityType };
  if (dateFrom || dateTo) {
    where.voucherDate = {};
    if (dateFrom) where.voucherDate.gte = new Date(dateFrom);
    if (dateTo) where.voucherDate.lte = new Date(dateTo + 'T23:59:59');
  }
  const vouchers = await prisma.accVoucherIncome.findMany({ where, include: { entries: true } });

  // Seed every calendar day in [dateFrom, dateTo] up front so days with zero
  // income still print a row (matches the legacy layout's blank/0.00 rows).
  const byDate = {};
  if (dateFrom && dateTo) {
    const d = new Date(dateFrom);
    const end = new Date(dateTo);
    while (d <= end) {
      byDate[d.toISOString().slice(0, 10)] = {};
      d.setDate(d.getDate() + 1);
    }
  }

  for (const v of vouchers) {
    const day = v.voucherDate.toISOString().slice(0, 10);
    if (!byDate[day]) byDate[day] = {};
    for (const e of v.entries) {
      if (!e.incomeCategoryId || !categoryIds.has(e.incomeCategoryId)) continue;
      byDate[day][e.incomeCategoryId] = (byDate[day][e.incomeCategoryId] || 0) + Number(e.amount);
    }
  }

  const rows = Object.keys(byDate).sort().map((date) => {
    const amounts = byDate[date];
    const total = Object.values(amounts).reduce((s, a) => s + a, 0);
    return { date, amounts, total };
  });

  const columnTotals = {};
  let grandTotal = 0;
  for (const row of rows) {
    for (const cat of categories) {
      const amt = row.amounts[cat.id] || 0;
      columnTotals[cat.id] = (columnTotals[cat.id] || 0) + amt;
    }
    grandTotal += row.total;
  }

  return { categories, rows, columnTotals, grandTotal };
}

// Reports > Income Summary Matrix > Import Excel — bulk-loads historical
// data in the exact shape the matrix prints (one row per date, one column
// per Account Category). One Voucher Income per date is created (same "one
// line per category" shape as generateAutoIncomeVoucherForDate), tagged
// source:'import' so it stays editable like any manual voucher but is still
// distinguishable in the data from a real day-close or a hand-typed entry.
// A date that already has ANY voucher for this entityType (auto, manual, or
// a previous import) is skipped outright — re-importing the same file, or a
// file overlapping a real day-close, must never double that day's total.
// Unmatched category names in the file get a new AccIncomeCategory created
// on the spot (ensureClinicIncomeCategories is generic despite its name —
// see Day Close section above).
async function bulkImportIncomeSummary({ entityType, rows }) {
  if (!Array.isArray(rows) || !rows.length) {
    throw Object.assign(new Error('No rows to import'), { status: 400 });
  }

  const allNames = [...new Set(rows.flatMap((r) => Object.keys(r.amounts || {})))];
  const categories = await ensureClinicIncomeCategories(entityType, allNames);

  let imported = 0;
  const skipped = [];
  for (const row of rows) {
    const voucherDate = new Date(row.date);
    if (isNaN(voucherDate.getTime())) { skipped.push({ date: row.date, reason: 'invalid date' }); continue; }

    const existing = await prisma.accVoucherIncome.findFirst({
      where: { entityType, voucherDate: { gte: new Date(row.date), lte: new Date(row.date + 'T23:59:59') } },
    });
    if (existing) { skipped.push({ date: row.date, reason: `already has ${existing.voucherNo}` }); continue; }

    const entries = Object.entries(row.amounts || {})
      .filter(([, amt]) => Number(amt) > 0)
      .map(([name, amt]) => ({
        incomeCategoryId: categories.get(name)?.id || null,
        incomeCategoryName: name,
        amount: Number(amt),
        particulars: 'Bulk import — Income Summary Matrix',
      }));
    if (!entries.length) { skipped.push({ date: row.date, reason: 'no non-zero amounts' }); continue; }

    const totalAmount = entries.reduce((s, e) => s + e.amount, 0);
    const voucherNo = await generateIncomeVoucherNo(entityType, voucherDate);
    await prisma.accVoucherIncome.create({
      data: {
        voucherNo, voucherType: 'CASH', voucherDate, mode: 'cash',
        entityType, totalAmount, source: 'import',
        entries: { create: entries },
      },
    });
    imported++;
  }

  return { imported, skipped };
}

async function getBankDeposits(entityType) {
  return prisma.accBankDeposit.findMany({
    where: { entityType },
    orderBy: { createdAt: 'desc' },
    include: { bankAccount: { select: { bankName: true, accountNumber: true } } },
  });
}

// ─── Upload Bank Statement ─────────────────────────────────────────────────
// Stores the bank's own statement exactly as exported (Date/Value Date/
// Instrument No./Particulars/Debit/Credit/Balance) — no matching/
// reconciliation logic yet, this is just the upload + a plain listing to
// confirm what landed. Every upload gets a fresh uploadBatchId (timestamp-
// based, good enough — not a real UUID lib dependency) so a bad upload can
// be identified/removed as one unit without guessing which rows came from it.

async function bulkImportBankStatement({ bankAccountId, entityType, rows }) {
  if (!bankAccountId) throw Object.assign(new Error('Bank Account required'), { status: 400 });
  if (!Array.isArray(rows) || !rows.length) {
    throw Object.assign(new Error('No rows to import'), { status: 400 });
  }
  const uploadBatchId = `bsu-${Date.now()}`;
  const data = rows
    .filter((r) => r.date)
    .map((r) => ({
      bankAccountId: Number(bankAccountId),
      entityType,
      date: new Date(r.date),
      valueDate: r.valueDate ? new Date(r.valueDate) : null,
      instrumentNo: r.instrumentNo || null,
      particulars: r.particulars || null,
      debit: Number(r.debit) || 0,
      credit: Number(r.credit) || 0,
      balance: r.balance !== undefined && r.balance !== null && r.balance !== '' ? Number(r.balance) : null,
      uploadBatchId,
    }));
  if (!data.length) throw Object.assign(new Error('No valid rows (missing Date) to import'), { status: 400 });

  await prisma.accBankStatementLine.createMany({ data });
  const { autoMatched } = await matchBankStatementCheques(entityType);
  return { imported: data.length, uploadBatchId, autoMatched };
}

// ─── Un-Presented Cheque List ───────────────────────────────────────────────
// A cheque-mode Voucher Expense entry is "Un-Presented" until its Bank
// Statement debit line is matched to it. Matched by (Amount, Cheque Date)
// only — no Instrument No. requirement, per explicit decision — and only
// auto-linked when that (amount, date) pair is unambiguous on BOTH sides
// (exactly one un-presented cheque AND exactly one un-matched statement
// line share it); anything with 2+ on either side is surfaced instead for
// manual confirmation rather than guessed.
async function computeChequeMatchGroups(entityType) {
  const entries = await prisma.accVoucherExpenseEntry.findMany({
    where: {
      matchedStatementLineId: null,
      chequeNo: { not: null },
      chequeDate: { not: null },
      voucher: { entityType, mode: 'cheque' },
    },
    include: { voucher: { select: { voucherNo: true, voucherDate: true } } },
    orderBy: { chequeDate: 'asc' },
  });

  const usedLineIdRows = await prisma.accVoucherExpenseEntry.findMany({
    where: { matchedStatementLineId: { not: null } },
    select: { matchedStatementLineId: true },
  });
  const usedSet = new Set(usedLineIdRows.map((r) => r.matchedStatementLineId));
  const debitLines = await prisma.accBankStatementLine.findMany({ where: { entityType, debit: { gt: 0 } } });
  const unmatchedLines = debitLines.filter((l) => !usedSet.has(l.id));

  const dayKey = (d) => new Date(d).toISOString().slice(0, 10);
  const groupKey = (amount, date) => `${Number(amount)}|${dayKey(date)}`;

  const entriesByKey = new Map();
  for (const e of entries) {
    const k = groupKey(e.amount, e.chequeDate);
    if (!entriesByKey.has(k)) entriesByKey.set(k, []);
    entriesByKey.get(k).push(e);
  }
  const linesByKey = new Map();
  for (const l of unmatchedLines) {
    const k = groupKey(l.debit, l.date);
    if (!linesByKey.has(k)) linesByKey.set(k, []);
    linesByKey.get(k).push(l);
  }

  const autoMatchable = [];
  const ambiguous = [];
  for (const [k, es] of entriesByKey) {
    const ls = linesByKey.get(k) || [];
    if (!ls.length) continue; // no statement line yet — plain un-presented, nothing to review
    if (es.length === 1 && ls.length === 1) {
      autoMatchable.push({ entry: es[0], line: ls[0] });
    } else {
      ambiguous.push({ key: k, entries: es, lines: ls });
    }
  }

  return { entries, autoMatchable, ambiguous };
}

async function matchBankStatementCheques(entityType) {
  const { autoMatchable } = await computeChequeMatchGroups(entityType);
  for (const { entry, line } of autoMatchable) {
    await prisma.accVoucherExpenseEntry.update({ where: { id: entry.id }, data: { matchedStatementLineId: line.id } });
  }
  return { autoMatched: autoMatchable.length };
}

async function getUnpresentedChequeList({ entityType }) {
  await matchBankStatementCheques(entityType);
  const { entries, ambiguous } = await computeChequeMatchGroups(entityType);

  return {
    unpresented: entries.map((e) => ({
      id: e.id,
      voucherNo: e.voucher.voucherNo,
      voucherDate: e.voucher.voucherDate,
      chequeNo: e.chequeNo,
      chequeDate: e.chequeDate,
      payeeName: e.payeeName,
      amount: Number(e.amount),
    })),
    needsReview: ambiguous.map((g) => ({
      key: g.key,
      candidateEntries: g.entries.map((e) => ({
        id: e.id, voucherNo: e.voucher.voucherNo, chequeNo: e.chequeNo, chequeDate: e.chequeDate, payeeName: e.payeeName, amount: Number(e.amount),
      })),
      candidateLines: g.lines.map((l) => ({
        id: l.id, date: l.date, instrumentNo: l.instrumentNo, particulars: l.particulars, debit: Number(l.debit),
      })),
    })),
  };
}

async function confirmChequeMatch({ voucherExpenseEntryId, statementLineId }) {
  if (!voucherExpenseEntryId || !statementLineId) {
    throw Object.assign(new Error('voucherExpenseEntryId and statementLineId are required'), { status: 400 });
  }
  return prisma.accVoucherExpenseEntry.update({
    where: { id: Number(voucherExpenseEntryId) },
    data: { matchedStatementLineId: Number(statementLineId) },
  });
}

// Reports > Cheque Wise Voucher Summary — every Expense entry in the date
// range, across whichever modes are selected (Cash/Online/Cheque; all three
// by default). Cash and Online rows always show — those modes have no
// "presented" concept. Cheque rows are filtered to only the still
// Un-Presented ones (matchedStatementLineId still null) — once a cheque
// clears it drops off this list, same definition as Un-Presented Cheque
// List, just folded into this wider report alongside Cash/Online.
async function getChequeWiseVoucherSummary({ entityType, modes, dateFrom, dateTo }) {
  const modeList = Array.isArray(modes) && modes.length ? modes : ['cash', 'online', 'cheque'];

  const where = { entityType, mode: { in: modeList } };
  if (dateFrom || dateTo) {
    where.voucherDate = {};
    if (dateFrom) where.voucherDate.gte = new Date(dateFrom);
    if (dateTo) where.voucherDate.lte = new Date(dateTo + 'T23:59:59');
  }

  const vouchers = await prisma.accVoucherExpense.findMany({
    where,
    include: { entries: true },
    orderBy: [{ voucherDate: 'asc' }, { id: 'asc' }],
  });

  const bankIds = [...new Set(vouchers.map((v) => v.bankId).filter(Boolean))];
  const bankAccounts = bankIds.length
    ? await prisma.accBankAccount.findMany({ where: { id: { in: bankIds } } })
    : [];
  const bankById = new Map(bankAccounts.map((b) => [b.id, b]));

  const rows = [];
  for (const v of vouchers) {
    const bankLabel = v.mode === 'cash' ? 'CASH' : v.mode === 'online' ? 'ONLINE' : (bankById.get(v.bankId)?.bankName || '');
    for (const e of v.entries) {
      if (v.mode === 'cheque' && e.matchedStatementLineId) continue; // already presented — drops off
      // chequeNo doubles as a plain running serial for Cash entries too (see
      // VoucherExpenseForm's cashSerial) — only a real Cheque # for
      // mode:'cheque', so only show it there.
      const isCheque = v.mode === 'cheque';
      rows.push({
        voucherDate: v.voucherDate,
        voucherNo: v.voucherNo,
        mode: v.mode,
        chequeNo: isCheque ? (e.chequeNo || '') : '',
        chequeDate: isCheque ? (e.chequeDate || null) : null,
        bankAccount: bankLabel,
        accountCode: e.accountCode,
        description: e.particulars || '',
        amount: Number(e.amount),
      });
    }
  }

  const grandTotal = rows.reduce((s, r) => s + r.amount, 0);
  return { rows, grandTotal };
}

async function getBankStatementLines({ bankAccountId, entityType, dateFrom, dateTo }) {
  const where = { entityType };
  if (bankAccountId) where.bankAccountId = Number(bankAccountId);
  if (dateFrom || dateTo) {
    where.date = {};
    if (dateFrom) where.date.gte = new Date(dateFrom);
    if (dateTo) where.date.lte = new Date(dateTo + 'T23:59:59');
  }
  return prisma.accBankStatementLine.findMany({
    where,
    orderBy: [{ date: 'asc' }, { id: 'asc' }],
  });
}

// ─── Inquiry Dashboard (Expense + Income vouchers, calendar-style) ────────────
// Same shape as the Clinic Revenue Dashboard's response (date/totalPatients/
// totalAmount/cashPatients.../panelPatients...) so the frontend calendar
// component ports over almost unchanged — "cash" slot carries Expense,
// "panel" slot carries Income here.
async function getAccountsInquiryDashboard({ entityType, period, year, month }) {
  entityType = entityType || 'non-corporate';
  year   = parseInt(year)  || new Date().getFullYear();
  month  = parseInt(month) || (new Date().getMonth() + 1);
  period = period || 'monthly_daily';

  let dateFrom = null, dateTo = null;
  if (period === 'monthly_daily') {
    const daysInMonth = new Date(year, month, 0).getDate();
    dateFrom = new Date(year, month - 1, 1);
    dateTo   = new Date(year, month - 1, daysInMonth, 23, 59, 59, 999);
  } else if (period === 'yearly_monthly' || period === 'yearly_daily') {
    dateFrom = new Date(year, 0, 1);
    dateTo   = new Date(year, 11, 31, 23, 59, 59, 999);
  }

  const where = { entityType };
  if (dateFrom && dateTo) where.voucherDate = { gte: dateFrom, lte: dateTo };

  const [expenses, incomes] = await Promise.all([
    prisma.accVoucherExpense.findMany({ where, select: { voucherDate: true, totalAmount: true } }),
    prisma.accVoucherIncome.findMany({ where, select: { voucherDate: true, totalAmount: true, source: true } }),
  ]);

  // Dates that already have an auto day-close voucher — the real voucher above
  // (via the `incomes` loop) already carries that day's Clinic revenue, so the
  // live Clinic merge below must skip these dates to avoid double-counting.
  const closedDates = new Set(
    incomes.filter((v) => v.source === 'auto').map((v) => v.voucherDate.toISOString().slice(0, 10))
  );

  const bucketKey = (d) => {
    const dt = new Date(d);
    if (period === 'monthly_daily') return dt.toISOString().slice(0, 10);
    if (period === 'yearly_monthly' || period === 'yearly_daily') return dt.getMonth() + 1;
    return dt.getFullYear();
  };

  const map = new Map();
  // clinicPatients is tracked separately from incomeCount (which mixes voucher
  // counts with patient counts for the calendar's "In" badge) — it exists purely
  // so the summary bar can show a real patient headcount alongside the amounts.
  function bumpKey(key, count, amount, isExpense, clinicPatientCount = 0) {
    if (!map.has(key)) map.set(key, { key, totalCount: 0, totalAmount: 0, expenseCount: 0, expenseAmount: 0, incomeCount: 0, incomeAmount: 0, clinicPatients: 0 });
    const e = map.get(key);
    e.totalCount += count;
    e.totalAmount += amount;
    if (isExpense) { e.expenseCount += count; e.expenseAmount += amount; }
    else { e.incomeCount += count; e.incomeAmount += amount; }
    e.clinicPatients += clinicPatientCount;
  }
  function bump(dateVal, amount, isExpense) {
    bumpKey(bucketKey(dateVal), 1, amount, isExpense);
  }
  for (const v of expenses) bump(v.voucherDate, Number(v.totalAmount) || 0, true);
  for (const v of incomes)  bump(v.voucherDate, Number(v.totalAmount) || 0, false);

  // "Income" for the Non-Corporate entity also includes Clinic patient revenue
  // (OPD + Admission), on top of manually-entered Voucher Income — pulled
  // straight from the Clinic Revenue Dashboard's own aggregation so the two
  // always agree.
  if (entityType === 'non-corporate') {
    const clinicRes = await clinicSvc.getRevenueDashboard({
      period, year, month,
      department: 'ALL', subDept: 'ALL', consultant: 'ALL', paymentType: 'ALL',
    });
    const keyField = period === 'monthly_daily' ? 'date' : period === 'multi_year' ? 'year' : 'month';
    for (const row of clinicRes.data) {
      const patients = Number(row.totalPatients) || 0;
      if (period === 'monthly_daily' && closedDates.has(row.date)) {
        // Amount is already booked via the real auto voucher (summed above) —
        // only add the live patient headcount so "Total Patients" stays accurate.
        bumpKey(row[keyField], 0, 0, false, patients);
        continue;
      }
      bumpKey(row[keyField], patients, Number(row.totalAmount) || 0, false, patients);
    }
  }

  // "Income" for the Corporate entity also includes Panel Cheque receipts
  // (see receivePanelCheque) — the actual received amount posted against a
  // panel/insurance company's cheque, keyed by that cheque's own Cheque Date
  // (same convention as Voucher's own voucherDate driving the calendar, not
  // when it was entered into the system).
  if (entityType === 'corporate') {
    const chequeWhere = {};
    if (dateFrom && dateTo) chequeWhere.chequeDate = { gte: dateFrom, lte: dateTo };
    const cheques = await prisma.clinicPanelChequeReceipt.findMany({
      where: chequeWhere,
      select: { chequeDate: true, receivedAmount: true },
    });
    for (const c of cheques) {
      bump(c.chequeDate, Number(c.receivedAmount) || 0, false);
    }
  }

  const toRow = (e, keyField) => ({
    [keyField]: e.key,
    totalPatients: e.totalCount, totalAmount: e.totalAmount,
    cashPatients: e.expenseCount, cashAmount: e.expenseAmount,
    panelPatients: e.incomeCount, panelAmount: e.incomeAmount,
    clinicPatients: e.clinicPatients,
    ccPatients: 0, ccAmount: 0,
  });

  let data = [];
  if (period === 'monthly_daily') {
    data = [...map.values()].map(e => toRow(e, 'date')).sort((a, b) => a.date.localeCompare(b.date));
  } else if (period === 'yearly_monthly' || period === 'yearly_daily') {
    for (let m = 1; m <= 12; m++) {
      const e = map.get(m) || { key: m, totalCount: 0, totalAmount: 0, expenseCount: 0, expenseAmount: 0, incomeCount: 0, incomeAmount: 0 };
      data.push(toRow(e, 'month'));
    }
  } else {
    data = [...map.values()].map(e => toRow(e, 'year')).sort((a, b) => a.year - b.year);
  }

  const totalAmount = data.reduce((s, d) => s + d.totalAmount, 0);
  const totalPatients  = data.reduce((s, d) => s + (d.clinicPatients || 0), 0);
  const incomeAmount   = data.reduce((s, d) => s + d.panelAmount, 0);
  const expenseAmount  = data.reduce((s, d) => s + d.cashAmount, 0);
  const netAmount       = incomeAmount - expenseAmount;
  const daysWithData = data.filter(d => d.totalAmount > 0).length;
  const dailyAvg = daysWithData > 0 ? totalAmount / daysWithData : 0;

  // Prognosis (monthly_daily only): today's run-rate projected across the month.
  let prognosis = 0;
  if (period === 'monthly_daily') {
    const today = new Date();
    const isCurrentMonth = today.getFullYear() === year && (today.getMonth() + 1) === month;
    const dayOfMonth = isCurrentMonth ? today.getDate() : new Date(year, month, 0).getDate();
    const soFar = data.filter(d => Number(d.date.slice(-2)) <= dayOfMonth).reduce((s, d) => s + d.totalAmount, 0);
    const daysInMonth = new Date(year, month, 0).getDate();
    prognosis = dayOfMonth > 0 ? (soFar / dayOfMonth) * daysInMonth : 0;
  }

  // Same month, previous year — for the sidebar comparison box.
  const lastYearWhere = { entityType };
  let lastYearAmount = 0;
  if (period === 'monthly_daily') {
    const lyFrom = new Date(year - 1, month - 1, 1);
    const lyTo   = new Date(year - 1, month - 1, new Date(year - 1, month, 0).getDate(), 23, 59, 59, 999);
    lastYearWhere.voucherDate = { gte: lyFrom, lte: lyTo };
    const [lyExp, lyInc] = await Promise.all([
      prisma.accVoucherExpense.findMany({ where: lastYearWhere, select: { totalAmount: true } }),
      prisma.accVoucherIncome.findMany({ where: lastYearWhere, select: { totalAmount: true } }),
    ]);
    lastYearAmount = [...lyExp, ...lyInc].reduce((s, v) => s + (Number(v.totalAmount) || 0), 0);

    if (entityType === 'non-corporate') {
      const lyClinic = await clinicSvc.getRevenueDashboard({
        period: 'monthly_daily', year: year - 1, month,
        department: 'ALL', subDept: 'ALL', consultant: 'ALL', paymentType: 'ALL',
      });
      lastYearAmount += lyClinic.data.reduce((s, d) => s + (Number(d.totalAmount) || 0), 0);
    }

    if (entityType === 'corporate') {
      const lyCheques = await prisma.clinicPanelChequeReceipt.findMany({
        where: { chequeDate: { gte: lyFrom, lte: lyTo } },
        select: { receivedAmount: true },
      });
      lastYearAmount += lyCheques.reduce((s, c) => s + (Number(c.receivedAmount) || 0), 0);
    }
  }

  const MN = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const trendData = period === 'monthly_daily'
    ? data.map(d => ({ label: d.date.slice(-2), totalPatients: d.totalPatients, totalAmount: d.totalAmount }))
    : period === 'multi_year'
    ? data.map(d => ({ label: String(d.year), totalPatients: d.totalPatients, totalAmount: d.totalAmount }))
    : data.map(d => ({ label: MN[d.month - 1], totalPatients: d.totalPatients, totalAmount: d.totalAmount }));

  return {
    period, year, month, data,
    summary: { totalPatients, totalAmount, incomeAmount, expenseAmount, netAmount, dailyAvg, prognosis, lastYearAmount, daysWithData },
    trendData,
  };
}

// Thin passthrough to Clinic's own per-department daily statement — used by
// the Inquiry calendar's double-click modal to show WHERE the Clinic-side
// "Income" for that day actually came from. Once a day is auto-closed, that
// revenue is already booked as a real Voucher Income (shown as its own card
// in the modal) — return null so it isn't shown/counted twice.
async function getClinicRevenueForDate(date) {
  const autoVoucher = await prisma.accVoucherIncome.findFirst({
    where: { entityType: 'non-corporate', source: 'auto', voucherDate: new Date(date) },
    select: { id: true },
  });
  if (autoVoucher) return null;
  return clinicSvc.getDailyDepartmentStatement(date);
}

// Corporate's equivalent of getClinicRevenueForDate above — used by the
// Inquiry calendar's double-click modal to show WHICH Panel Cheques made up
// that day's Income (see getAccountsInquiryDashboard's Corporate merge).
// Each cheque can cover several admissions' Panel Billing at once — that
// count, plus the cheque's own totalAmount/deduction, is included so the
// modal shows exactly what was posted, not just a bare total.
async function getPanelChequeRevenueForDate(date) {
  const receipts = await prisma.clinicPanelChequeReceipt.findMany({
    where: { chequeDate: new Date(date) },
    include: { items: { select: { id: true } } },
    orderBy: { id: 'asc' },
  });
  if (!receipts.length) return { rows: [], total: { amount: 0, count: 0 } };

  // ClinicPanelChequeReceipt.panelCompanyId has no declared Prisma relation
  // (raw FK only) — same manual join clinic.service.js's own
  // getPanelChequeSummary already uses for this exact table.
  const companyIds = [...new Set(receipts.map((r) => r.panelCompanyId).filter(Boolean))];
  const companies = companyIds.length
    ? await prisma.clinicPanelCompany.findMany({ where: { id: { in: companyIds } }, select: { id: true, name: true } })
    : [];
  const companyById = new Map(companies.map((c) => [c.id, c.name]));

  const rows = receipts.map((r) => ({
    id: r.id,
    companyName: companyById.get(r.panelCompanyId) || '—',
    chequeNo: r.chequeNo,
    billingMonth: r.billingMonth,
    billingYear: r.billingYear,
    admissionsCount: r.items.length,
    totalAmount: Number(r.totalAmount) || 0,
    receivedAmount: Number(r.receivedAmount) || 0,
    deduction: Number(r.deduction) || 0,
  }));

  const total = { amount: rows.reduce((s, r) => s + r.receivedAmount, 0), count: rows.length };
  return { rows, total };
}

// Single-day Income/Expense/Diff — same numbers the Inquiry calendar's day
// cell shows for that date, used to pre-fill the read-only diff hint on the
// Bank Deposit form when a "Deposit Of" date is picked.
async function getDailyIncomeExpenseDiff(date, entityType) {
  if (!date) throw Object.assign(new Error('Date is required'), { status: 400 });
  entityType = entityType || 'non-corporate';

  const where = { entityType, voucherDate: new Date(date) };
  const [expenses, incomes] = await Promise.all([
    prisma.accVoucherExpense.findMany({ where, select: { totalAmount: true } }),
    prisma.accVoucherIncome.findMany({ where, select: { totalAmount: true, source: true } }),
  ]);
  const expenseAmount = expenses.reduce((s, v) => s + (Number(v.totalAmount) || 0), 0);
  let incomeAmount = incomes.reduce((s, v) => s + (Number(v.totalAmount) || 0), 0);

  // Once the day is auto-closed, its Clinic revenue is already inside `incomes`
  // above (the frozen auto voucher) — only live-merge for still-open days.
  const alreadyClosed = incomes.some((v) => v.source === 'auto');
  if (entityType === 'non-corporate' && !alreadyClosed) {
    const clinic = await clinicSvc.getDailyDepartmentStatement(date);
    incomeAmount += Number(clinic.total.amount) || 0;
  }

  return { date, entityType, incomeAmount, expenseAmount, diff: incomeAmount - expenseAmount };
}

// ─── Day Close — auto Income Voucher generation ───────────────────────────────
// Every night at 8:00 AM (the hospital's business-day boundary) the previous
// business day is "closed": its Clinic patient revenue is booked as a real,
// frozen Voucher Income (one line per department) instead of being merged
// live into the dashboard on every request. See dayClose.job.js for the
// scheduler that calls this once a day.

async function ensureClinicIncomeCategories(entityType, departmentNames) {
  const names = [...new Set(departmentNames)];
  if (!names.length) return new Map();
  const existing = await prisma.accIncomeCategory.findMany({ where: { entityType, name: { in: names } } });
  const byName = new Map(existing.map((c) => [c.name, c]));
  for (const name of names) {
    if (byName.has(name)) continue;
    const created = await prisma.accIncomeCategory.create({ data: { name, entityType } });
    byName.set(name, created);
  }
  return byName;
}

async function generateAutoIncomeVoucherForDate(date, entityType = 'non-corporate') {
  const existing = await prisma.accVoucherIncome.findFirst({
    where: { entityType, source: 'auto', voucherDate: new Date(date) },
    include: { entries: true },
  });
  if (existing) return existing;

  const stmt = await clinicSvc.getDailyDepartmentStatement(date);
  const amount = Number(stmt.total.amount) || 0;
  if (amount <= 0) return null;

  const rows = stmt.rows.filter((r) => Number(r.amount) > 0);
  const categories = await ensureClinicIncomeCategories(entityType, rows.map((r) => r.department));
  const voucherNo = await generateIncomeVoucherNo(entityType, date);

  return prisma.accVoucherIncome.create({
    data: {
      voucherNo,
      voucherType: 'AUTO',
      voucherDate: new Date(date),
      mode: 'system',
      entityType,
      totalAmount: amount,
      source: 'auto',
      entries: {
        create: rows.map((r) => ({
          incomeCategoryId:   categories.get(r.department)?.id || null,
          incomeCategoryName: r.department,
          amount:             r.amount,
          particulars:        `Auto day-close — ${r.count} patient(s)`,
        })),
      },
    },
    include: { entries: true },
  });
}

module.exports = {
  getMainGLs, createMainGL, updateMainGL, deleteMainGL,
  getSubGLs, createSubGL, updateSubGL, deleteSubGL,
  getMainAccounts, createMainAccount, updateMainAccount, deleteMainAccount,
  getSubAccounts, createSubAccount, updateSubAccount, deleteSubAccount,
  copyChartToCorporate, getPendingGrnQueue,
  getPayeeHeads, createPayeeHead, updatePayeeHead, deletePayeeHead, addHeadAccount, removeHeadAccount, addInventoryHeadMainAccount, removeInventoryHeadMainAccount,
  getSurgeryHeadForMainAccount, addPayeeHeadStaffCategory, removePayeeHeadStaffCategory, getSurgeryPayeesForHead,
  getIpdConsultantHeadForMainAccount, getPendingConsultantFees, getAdvanceLoanVoucherAccountChain, getRefundVoucherAccountChain,
  getPayeeEntries, createPayeeEntry, deletePayeeEntry, bulkSavePayeeEntries, getEmployeeList, getSupplierList, getDoctorList, getInventorySubcategories, getInventoryItemsBySubcategory, getInventoryItemsForHead, linkCustomHeadToInventoryHead, unlinkCustomHeadFromInventoryHead, getInventoryHeadForMainAccount,
  getBankAccounts, createBankAccount, updateBankAccount, deleteBankAccount,
  getChequeSerials, createChequeSerial, deleteChequeSerial, getNextChequeSerial, getNextCashSerial,
  getIncomeCategories, createIncomeCategory, updateIncomeCategory, deleteIncomeCategory,
  getAllPayeeEntries, createVoucherExpense, getVoucherExpenses, updateVoucherExpense, deleteVoucherExpense,
  saveDraftExpenseEntry, getDraftExpenses, deleteDraftExpense, flashDraftsToVouchers,
  getPayeeEntriesBySubAccount, getSupplierGRNs, getConsultantVisits,
  createVoucherIncome, getVoucherIncomes, updateVoucherIncome,
  getNextVoucherNo,
  getVouchersForReprint, getVoucherSummaryMatrix, getIncomeSummaryMatrix, bulkImportIncomeSummary, getDistinctPayeeNames, getGLBalanceReport, getConsultantPaymentHistory, getSupplierPaymentHistory,
  createBankDeposit, getBankDeposits, getBankDepositForDate,
  bulkImportBankStatement, getBankStatementLines,
  getUnpresentedChequeList, confirmChequeMatch, getChequeWiseVoucherSummary,
  createBankDepositAdj, getBankDepositAdjs,
  getVoucherSummary,
  getAccountsInquiryDashboard,
  getClinicRevenueForDate,
  getPanelChequeRevenueForDate,
  getDailyIncomeExpenseDiff,
  generateAutoIncomeVoucherForDate,
};

async function getVoucherSummary({ entityType, voucherFrom, voucherTo, supplierId, mainAccountId, dateFrom, dateTo }) {
  const where = { entityType };
  if (voucherFrom || voucherTo) {
    where.voucherNo = {};
    if (voucherFrom) where.voucherNo.gte = voucherFrom;
    if (voucherTo)   where.voucherNo.lte = voucherTo;
  }
  if (dateFrom || dateTo) {
    where.voucherDate = {};
    if (dateFrom) where.voucherDate.gte = new Date(dateFrom);
    if (dateTo)   where.voucherDate.lte = new Date(new Date(dateTo).setHours(23, 59, 59, 999));
  }

  let vouchers = await prisma.accVoucherExpense.findMany({
    where,
    include: { entries: true },
    orderBy: [{ voucherDate: 'asc' }, { voucherNo: 'asc' }],
  });

  if (supplierId) {
    const supplier = await prisma.inventorySupplier.findUnique({ where: { id: Number(supplierId) }, select: { name: true } });
    if (supplier) {
      vouchers = vouchers.filter((v) => v.entries.some((e) => e.payeeName === supplier.name));
    }
  }

  if (mainAccountId) {
    vouchers = vouchers.filter((v) => v.entries.some((e) => e.mainAccountId === Number(mainAccountId)));
  }

  if (!vouchers.length) return [];

  const allEntries = vouchers.flatMap((v) => v.entries);
  const mainGlIds  = [...new Set(allEntries.map((e) => e.mainGlId).filter(Boolean))];
  const subGlIds   = [...new Set(allEntries.map((e) => e.subGlId).filter(Boolean))];
  const mainAccIds = [...new Set(allEntries.map((e) => e.mainAccountId).filter(Boolean))];
  const subAccIds  = [...new Set(allEntries.map((e) => e.subAccountId).filter(Boolean))];

  const [mainGLs, subGLs, mainAccs, subAccs] = await Promise.all([
    mainGlIds.length  ? prisma.accMainGL.findMany({ where: { id: { in: mainGlIds } } })       : [],
    subGlIds.length   ? prisma.accSubGL.findMany({ where: { id: { in: subGlIds } } })         : [],
    mainAccIds.length ? prisma.accMainAccount.findMany({ where: { id: { in: mainAccIds } } }) : [],
    subAccIds.length  ? prisma.accSubAccount.findMany({ where: { id: { in: subAccIds } } })   : [],
  ]);

  const mgMap = Object.fromEntries(mainGLs.map((x) => [x.id, x.name]));
  const sgMap = Object.fromEntries(subGLs.map((x) => [x.id, x.name]));
  const maMap = Object.fromEntries(mainAccs.map((x) => [x.id, x.name]));
  const saMap = Object.fromEntries(subAccs.map((x) => [x.id, x.name]));

  return vouchers.map((v) => ({
    ...v,
    entries: v.entries.map((e) => ({
      ...e,
      mainGlName:      mgMap[e.mainGlId]      || '',
      subGlName:       sgMap[e.subGlId]       || '',
      mainAccountName: maMap[e.mainAccountId] || '',
      subAccountName:  saMap[e.subAccountId]  || '',
    })),
  }));
}
