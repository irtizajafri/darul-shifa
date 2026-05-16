const prisma = require('../../config/db');

const ACTIVE = 'active';
const INACTIVE = 'inactive';
const USEFUL_LIFE_UNITS = ['years', 'months', 'hours'];

let usefulLifeUnitColumnEnsured = false;
let masterCodesNormalized = false;

async function ensureUsefulLifeUnitColumn() {
  if (usefulLifeUnitColumnEnsured) return;

  await prisma.$executeRawUnsafe(
    "ALTER TABLE \"InventoryItem\" ADD COLUMN IF NOT EXISTS \"usefulLifeUnit\" TEXT DEFAULT 'years'"
  );

  usefulLifeUnitColumnEnsured = true;
}

function normalizeStatus(value) {
  const v = String(value || ACTIVE).trim().toLowerCase();
  return v === INACTIVE ? INACTIVE : ACTIVE;
}

function padSequence(num) {
  return String(num).padStart(3, '0');
}

function padTwo(num) {
  return String(num).padStart(2, '0');
}

function parseTwoDigitCode(value) {
  const raw = String(value || '').trim();
  if (!/^\d{2}$/.test(raw)) return null;
  return raw;
}

function getDatePrefix(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

function normalizeCodeSuffix(value) {
  return String(value || '').trim().toLowerCase();
}

async function generateDateCode(modelKey, codeField = 'code') {
  const prefix = getDatePrefix();
  const latest = await prisma[modelKey].findFirst({
    where: {
      [codeField]: {
        startsWith: prefix,
      },
    },
    orderBy: {
      [codeField]: 'desc',
    },
    select: {
      [codeField]: true,
    },
  });

  let nextSeq = 1;
  if (latest?.[codeField]) {
    const tail = String(latest[codeField]).slice(8);
    const parsed = Number(tail);
    nextSeq = Number.isFinite(parsed) && parsed > 0 ? parsed + 1 : 1;
  }

  return `${prefix}${padSequence(nextSeq)}`;
}

async function generateDocCode(modelKey, suffix, codeField = 'code') {
  const prefix = getDatePrefix();
  const safeSuffix = normalizeCodeSuffix(suffix);
  const latest = await prisma[modelKey].findFirst({
    where: {
      [codeField]: {
        startsWith: prefix,
      },
    },
    orderBy: {
      [codeField]: 'desc',
    },
    select: {
      [codeField]: true,
    },
  });

  let nextSeq = 1;
  if (latest?.[codeField]) {
    const code = String(latest[codeField]);
    const [head] = code.split('-');
    const tail = String(head || '').slice(8);
    const parsed = Number(tail);
    nextSeq = Number.isFinite(parsed) && parsed > 0 ? parsed + 1 : 1;
  }

  return `${prefix}${padSequence(nextSeq)}-${safeSuffix}`;
}

async function generateTwoDigitMasterCode(modelKey, extraWhere = {}) {
  const existing = await prisma[modelKey].findMany({
    where: extraWhere,
    select: { code: true },
  });

  let maxCode = 0;
  existing.forEach((row) => {
    const parsed = Number(parseTwoDigitCode(row?.code));
    if (Number.isFinite(parsed)) {
      maxCode = Math.max(maxCode, parsed);
    }
  });

  return padTwo(maxCode + 1);
}

async function ensureMasterCodeNormalization() {
  if (masterCodesNormalized) return;

  await prisma.$transaction(async (tx) => {
    const categories = await tx.inventoryCategory.findMany({
      orderBy: [{ id: 'asc' }],
      select: { id: true, code: true },
    });

    const subcategories = await tx.inventorySubcategory.findMany({
      orderBy: [{ categoryId: 'asc' }, { id: 'asc' }],
      select: { id: true, categoryId: true, code: true },
    });

    const categoriesNeedNormalization = categories.some((row) => !parseTwoDigitCode(row.code));
    const subcategoriesNeedNormalization = subcategories.some((row) => !parseTwoDigitCode(row.code));

    if (!categoriesNeedNormalization && !subcategoriesNeedNormalization) {
      return;
    }

    await Promise.all(categories.map((row) =>
      tx.inventoryCategory.update({
        where: { id: row.id },
        data: { code: `TMP-CAT-${row.id}` },
      })
    ));

    await Promise.all(subcategories.map((row) =>
      tx.inventorySubcategory.update({
        where: { id: row.id },
        data: { code: `TMP-SUB-${row.id}` },
      })
    ));

    await Promise.all(categories.map((row, index) =>
      tx.inventoryCategory.update({
        where: { id: row.id },
        data: { code: padTwo(index + 1) },
      })
    ));

    await Promise.all(subcategories.map((row, index) =>
      tx.inventorySubcategory.update({
        where: { id: row.id },
        data: { code: padTwo(index + 1) },
      })
    ));
  });

  masterCodesNormalized = true;
}

async function generateInventoryItemCode({ categoryId, subcategoryId }) {
  await ensureMasterCodeNormalization();

  const parsedCategoryId = Number(categoryId);
  const parsedSubcategoryId = Number(subcategoryId);

  const [categoryRow, subcategoryRow] = await Promise.all([
    prisma.inventoryCategory.findUnique({ where: { id: parsedCategoryId }, select: { id: true, code: true } }),
    prisma.inventorySubcategory.findUnique({ where: { id: parsedSubcategoryId }, select: { id: true, code: true, categoryId: true } }),
  ]);

  if (!categoryRow) throw new Error('Selected category does not exist');
  if (!subcategoryRow) throw new Error('Selected subcategory does not exist');
  if (Number(subcategoryRow.categoryId) !== parsedCategoryId) {
    throw new Error('Selected subcategory does not belong to selected category');
  }

  const [categorySequence, subcategorySequence] = await Promise.all([
    prisma.inventoryCategory.count({ where: { id: { lte: parsedCategoryId } } }),
    prisma.inventorySubcategory.count({ where: { categoryId: parsedCategoryId, id: { lte: parsedSubcategoryId } } }),
  ]);

  const categoryPart = parseTwoDigitCode(categoryRow.code) || padTwo(categorySequence);
  const subcategoryPart = parseTwoDigitCode(subcategoryRow.code) || padTwo(subcategorySequence);
  const itemPrefix = `PD${categoryPart}${subcategoryPart}`;

  const latestInSubcategory = await prisma.inventoryItem.findFirst({
    where: {
      categoryId: parsedCategoryId,
      subcategoryId: parsedSubcategoryId,
      code: {
        startsWith: itemPrefix,
      },
    },
    orderBy: { code: 'desc' },
    select: { code: true },
  });

  let nextItemSequence = 1;
  if (latestInSubcategory?.code) {
    const tail = String(latestInSubcategory.code).slice(itemPrefix.length);
    const parsedTail = Number(tail);
    if (Number.isFinite(parsedTail) && parsedTail > 0) {
      nextItemSequence = parsedTail + 1;
    }
  }

  // Retry mechanism to ensure uniqueness
  let generatedCode = `${itemPrefix}${padSequence(nextItemSequence)}`;
  let retries = 0;
  const maxRetries = 10;

  while (retries < maxRetries) {
    const existingCode = await prisma.inventoryItem.findUnique({ where: { code: generatedCode } });
    if (!existingCode) {
      return generatedCode;
    }
    // Code exists, increment and try again
    nextItemSequence += 1;
    generatedCode = `${itemPrefix}${padSequence(nextItemSequence)}`;
    retries += 1;
  }

  throw new Error('Could not generate unique item code after multiple attempts');
}

function normalizeSearch(search) {
  return String(search || '').trim();
}

function parsePositiveNumber(value, fallback = null) {
  if (value === undefined || value === null || value === '') return fallback;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return n;
}

function parseOptionalDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseOptionalString(value) {
  const v = String(value || '').trim();
  return v ? v : null;
}

function normalizeCustomerType(value) {
  const v = String(value || 'walking').trim().toLowerCase();
  if (v === 'customer') return 'customer';
  return 'walking';
}

function buildSearchFilter(search, fields) {
  const q = normalizeSearch(search);
  if (!q) return {};

  return {
    OR: fields.map((f) => ({
      [f]: { contains: q, mode: 'insensitive' },
    })),
  };
}

function buildStatusFilter(status) {
  if (!status) return {};
  const normalized = String(status).toLowerCase();
  if (normalized !== ACTIVE && normalized !== INACTIVE) return {};
  return { status: normalized };
}

async function listCategories({ search, status }) {
  await ensureMasterCodeNormalization();

  return prisma.inventoryCategory.findMany({
    where: {
      ...buildSearchFilter(search, ['code', 'name']),
      ...buildStatusFilter(status),
    },
    include: {
      _count: {
        select: { subcategories: true, items: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

async function createCategory(payload) {
  await ensureMasterCodeNormalization();

  const name = String(payload.name || '').trim();
  const status = normalizeStatus(payload.status);
  const code = parseTwoDigitCode(payload.code) || await generateTwoDigitMasterCode('inventoryCategory');

  return prisma.inventoryCategory.create({
    data: {
      code,
      name,
      status,
    },
  });
}

async function listSubcategories({ search, status, categoryId }) {
  await ensureMasterCodeNormalization();

  const parsedCategoryId = parsePositiveNumber(categoryId);
  return prisma.inventorySubcategory.findMany({
    where: {
      ...buildSearchFilter(search, ['code', 'name']),
      ...buildStatusFilter(status),
      ...(parsedCategoryId ? { categoryId: parsedCategoryId } : {}),
    },
    include: {
      category: true,
      _count: {
        select: { items: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

async function createSubcategory(payload) {
  await ensureMasterCodeNormalization();

  const name = String(payload.name || '').trim();
  const status = normalizeStatus(payload.status);
  const code = parseTwoDigitCode(payload.code) || await generateTwoDigitMasterCode('inventorySubcategory');

  return prisma.inventorySubcategory.create({
    data: {
      code,
      name,
      status,
      categoryId: Number(payload.categoryId),
    },
  });
}

async function listSuppliers({ search, status }) {
  return prisma.inventorySupplier.findMany({
    where: {
      ...buildSearchFilter(search, ['code', 'name', 'address', 'contactDetails', 'bankingDetails']),
      ...buildStatusFilter(status),
    },
    include: {
      _count: {
        select: { items: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

async function createSupplier(payload) {
  const status = normalizeStatus(payload.status);
  const code = String(payload.code || '').trim() || await generateDateCode('inventorySupplier');

  return prisma.inventorySupplier.create({
    data: {
      code,
      name: String(payload.name || '').trim(),
      address: payload.address ? String(payload.address).trim() : null,
      contactDetails: payload.contactDetails ? String(payload.contactDetails).trim() : null,
      bankingDetails: payload.bankingDetails ? String(payload.bankingDetails).trim() : null,
      status,
    },
  });
}

async function listStorages({ search, status }) {
  return prisma.inventoryStorage.findMany({
    where: {
      ...buildSearchFilter(search, ['code', 'name', 'numberAllotment']),
      ...buildStatusFilter(status),
    },
    include: {
      _count: {
        select: { items: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

async function createStorage(payload) {
  const status = normalizeStatus(payload.status);
  const code = String(payload.code || '').trim() || await generateDateCode('inventoryStorage');

  return prisma.inventoryStorage.create({
    data: {
      code,
      name: String(payload.name || '').trim(),
      numberAllotment: payload.numberAllotment ? String(payload.numberAllotment).trim() : null,
      status,
    },
  });
}

async function listDepartments({ search, status }) {
  return prisma.inventoryDepartment.findMany({
    where: {
      ...buildSearchFilter(search, ['code', 'name']),
      ...buildStatusFilter(status),
    },
    include: {
      _count: {
        select: { gds: true, gins: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

async function createDepartment(payload) {
  const status = normalizeStatus(payload.status);
  const code = String(payload.code || '').trim() || await generateDateCode('inventoryDepartment');

  return prisma.inventoryDepartment.create({
    data: {
      code,
      name: String(payload.name || '').trim(),
      status,
    },
  });
}

async function listDemandCategoryTypes({ search, status }) {
  return prisma.inventoryDemandCategoryType.findMany({
    where: {
      ...buildSearchFilter(search, ['code', 'name']),
      ...buildStatusFilter(status),
    },
    include: {
      _count: {
        select: { gds: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

async function createDemandCategoryType(payload) {
  const status = normalizeStatus(payload.status);
  const code = String(payload.code || '').trim() || await generateDateCode('inventoryDemandCategoryType');

  return prisma.inventoryDemandCategoryType.create({
    data: {
      code,
      name: String(payload.name || '').trim(),
      status,
    },
  });
}

async function getLastGrnRateForItemLikeName(itemName) {
  const normalizedName = String(itemName || '').trim();
  if (!normalizedName) return null;

  const existingItem = await prisma.inventoryItem.findFirst({
    where: {
      name: { equals: normalizedName, mode: 'insensitive' },
    },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  });

  if (!existingItem) return null;

  const movement = await prisma.inventoryStockMovement.findFirst({
    where: {
      itemId: existingItem.id,
      movementType: 'IN',
      referenceType: 'GRN',
      unitRate: { not: null },
    },
    orderBy: { createdAt: 'desc' },
    select: { unitRate: true },
  });

  if (!movement?.unitRate) return null;
  return movement.unitRate;
}

async function validateActiveMasterRecords({ categoryId, subcategoryId, supplierId, storageId }) {
  const parsedStorageId = parsePositiveNumber(storageId);
  const parsedSupplierId = parsePositiveNumber(supplierId);

  const [category, subcategory, supplier, storage] = await Promise.all([
    prisma.inventoryCategory.findUnique({ where: { id: Number(categoryId) } }),
    prisma.inventorySubcategory.findUnique({ where: { id: Number(subcategoryId) } }),
    parsedSupplierId
      ? prisma.inventorySupplier.findUnique({ where: { id: parsedSupplierId } })
      : Promise.resolve(null),
    parsedStorageId
      ? prisma.inventoryStorage.findUnique({ where: { id: Number(parsedStorageId) } })
      : Promise.resolve(null),
  ]);

  if (!category) throw new Error('Selected category does not exist');
  if (!subcategory) throw new Error('Selected subcategory does not exist');
  if (parsedSupplierId && !supplier) throw new Error('Selected supplier/vendor does not exist');
  if (parsedStorageId && !storage) throw new Error('Selected storage/shelf does not exist');

  if (subcategory.categoryId !== Number(categoryId)) {
    throw new Error('Selected subcategory does not belong to selected category');
  }

  if (category.status !== ACTIVE) throw new Error('Selected category is inactive');
  if (subcategory.status !== ACTIVE) throw new Error('Selected subcategory is inactive');
  if (parsedSupplierId && supplier && supplier.status !== ACTIVE) throw new Error('Selected supplier/vendor is inactive');
  if (storage && storage.status !== ACTIVE) throw new Error('Selected storage/shelf is inactive');
}

async function listItems({ search, status, categoryId, supplierId }) {
  const parsedCategoryId = parsePositiveNumber(categoryId);
  const parsedSupplierId = parsePositiveNumber(supplierId);

  return prisma.inventoryItem.findMany({
    where: {
      ...buildStatusFilter(status),
      ...buildSearchFilter(search, ['code', 'name', 'itemType', 'unit']),
      ...(parsedCategoryId ? { categoryId: parsedCategoryId } : {}),
      ...(parsedSupplierId ? { supplierId: parsedSupplierId } : {}),
    },
    include: {
      category: true,
      subcategory: true,
      storage: true,
      reorderAlerts: {
        where: { status: 'open' },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

async function listPurchaseOrders({ search, status, supplierId, itemId, dateFrom, dateTo }) {
  const parsedSupplierId = parsePositiveNumber(supplierId);
  const parsedItemId = parsePositiveNumber(itemId);

  return prisma.inventoryPurchaseOrder.findMany({
    where: {
      ...buildStatusFilter(status),
      ...buildSearchFilter(search, ['code', 'lastPurchaseSupplier']),
      ...(parsedSupplierId ? { supplierId: parsedSupplierId } : {}),
      ...(parsedItemId ? { itemId: parsedItemId } : {}),
      ...(dateFrom || dateTo
        ? {
            poDate: {
              ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
              ...(dateTo ? { lte: new Date(dateTo) } : {}),
            },
          }
        : {}),
    },
    include: {
      supplier: true,
      item: true,
      category: true,
      subcategory: true,
      grn: true,
    },
    orderBy: { createdAt: 'desc' },
  });
}

async function createPurchaseOrderLine(tx, payload, { code } = {}) {
  const supplierId = Number(payload.supplierId);
  const itemId = Number(payload.itemId);
  const requiredQuantity = parsePositiveNumber(payload.requiredQuantity);

  if (!Number.isFinite(requiredQuantity) || requiredQuantity <= 0) {
    throw new Error('requiredQuantity must be a positive number');
  }

  const [supplier, item, latestGrn] = await Promise.all([
    prisma.inventorySupplier.findUnique({ where: { id: supplierId } }),
    prisma.inventoryItem.findUnique({ where: { id: itemId }, include: { category: true, subcategory: true } }),
    prisma.inventoryGRN.findFirst({
      where: { itemId },
      include: { supplier: true },
      orderBy: { receivedDate: 'desc' },
    }),
  ]);

  if (!supplier) throw new Error('Selected supplier does not exist');
  if (!item) throw new Error('Selected item does not exist');
  if (supplier.status !== ACTIVE) throw new Error('Selected supplier is inactive');
  if (item.status !== ACTIVE) throw new Error('Selected item is inactive');
  
  // Check if supplier is in item's suppliers array
  const itemSupplierIds = Array.isArray(item.supplierId) ? item.supplierId : [];
  if (itemSupplierIds.length > 0 && !itemSupplierIds.includes(supplierId)) {
    throw new Error('Selected item does not belong to selected supplier');
  }

  let orderedRate = parsePositiveNumber(payload.orderedRate);
  if (!Number.isFinite(orderedRate)) {
    if (latestGrn?.receivedRate) orderedRate = Number(latestGrn.receivedRate);
    else throw new Error('orderedRate is required because item has never been purchased before');
  }

  const poCode = String(code || payload.code || '').trim() || await generateDocCode('inventoryPurchaseOrder', 'po');

  return tx.inventoryPurchaseOrder.create({
    data: {
      code: poCode,
      supplierId,
      itemId,
      categoryId: item.categoryId,
      subcategoryId: item.subcategoryId,
      inHandQuantity: parsePositiveNumber(payload.inHandQuantity, item.currentStock) || 0,
      requiredQuantity,
      orderedRate,
      expectedDate: new Date(payload.expectedDate),
      poDate: payload.poDate ? new Date(payload.poDate) : new Date(),
      lastPurchaseDate: latestGrn?.receivedDate || null,
      lastPurchaseSupplier: latestGrn?.supplier?.name || null,
      lastPurchaseRate: latestGrn?.receivedRate || null,
      lastPurchaseQuantity: latestGrn?.receivedQuantity || null,
      status: 'open',
    },
    include: {
      supplier: true,
      item: true,
      category: true,
      subcategory: true,
    },
  });
}

async function createPurchaseOrder(payload) {
  const hasMultiItems = Array.isArray(payload.items) && payload.items.length > 0;

  if (!hasMultiItems) {
    return createPurchaseOrderLine(prisma, payload);
  }

  const supplierId = Number(payload.supplierId);
  const lines = payload.items.map((line) => ({
    itemId: Number(line.itemId),
    requiredQuantity: Number(line.requiredQuantity),
    orderedRate: line.orderedRate,
    inHandQuantity: line.inHandQuantity,
  }));

  if (!Number.isFinite(supplierId) || supplierId <= 0) {
    throw new Error('supplierId is required');
  }

  if (lines.length === 0) {
    throw new Error('At least one item is required');
  }

  const rootCode = String(payload.code || '').trim() || await generateDocCode('inventoryPurchaseOrder', 'po');

  return prisma.$transaction(async (tx) => {
    const created = [];

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      const lineCode = lines.length === 1
        ? rootCode
        : `${rootCode}-${String(index + 1).padStart(2, '0')}`;

      // eslint-disable-next-line no-await-in-loop
      const po = await createPurchaseOrderLine(tx, {
        ...payload,
        supplierId,
        ...line,
      }, {
        code: lineCode,
      });

      created.push(po);
    }

    return {
      batchCode: rootCode,
      supplierId,
      totalLines: created.length,
      records: created,
    };
  });
}

async function listGRNs({ search, supplierId, itemId, categoryId, subcategoryId, dateFrom, dateTo }) {
  const parsedSupplierId = parsePositiveNumber(supplierId);
  const parsedItemId = parsePositiveNumber(itemId);
  const parsedCategoryId = parsePositiveNumber(categoryId);
  const parsedSubcategoryId = parsePositiveNumber(subcategoryId);

  return prisma.inventoryGRN.findMany({
    where: {
      ...buildSearchFilter(search, ['code']),
      ...(parsedSupplierId ? { supplierId: parsedSupplierId } : {}),
  ...(parsedItemId ? { itemId: parsedItemId } : {}),
      ...(parsedCategoryId ? { categoryId: parsedCategoryId } : {}),
      ...(parsedSubcategoryId ? { subcategoryId: parsedSubcategoryId } : {}),
      ...(dateFrom || dateTo
        ? {
            receivedDate: {
              ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
              ...(dateTo ? { lte: new Date(dateTo) } : {}),
            },
          }
        : {}),
    },
    include: {
      purchaseOrder: true,
      supplier: true,
      item: true,
      category: true,
      subcategory: true,
    },
    orderBy: { createdAt: 'desc' },
  });
}

async function createGRN(payload) {
  const receivedQuantity = parsePositiveNumber(payload.receivedQuantity);
  const receivedRate = parsePositiveNumber(payload.receivedRate);

  if (!Number.isFinite(receivedQuantity) || receivedQuantity <= 0) {
    throw new Error('receivedQuantity must be a positive number');
  }
  if (!Number.isFinite(receivedRate) || receivedRate <= 0) {
    throw new Error('receivedRate must be a positive number');
  }

  const po = payload.poId
    ? await prisma.inventoryPurchaseOrder.findUnique({ where: { id: Number(payload.poId) } })
    : await prisma.inventoryPurchaseOrder.findUnique({ where: { code: String(payload.poCode || '').trim() } });

  if (!po) throw new Error('Linked PO not found');
  if (po.grn) throw new Error('A GRN already exists for this PO');

  const existingGRN = await prisma.inventoryGRN.findUnique({ where: { poId: po.id } });
  if (existingGRN) throw new Error('A GRN already exists for this PO');

  const code = String(payload.code || '').trim() || await generateDocCode('inventoryGRN', 'grn');
  const poOrderedRate = Number(po.orderedRate ?? po.lastPurchaseRate ?? receivedRate);
  const totalAmount = receivedQuantity * receivedRate;

  return prisma.$transaction(async (tx) => {
    const grn = await tx.inventoryGRN.create({
      data: {
        code,
        poId: po.id,
        supplierId: po.supplierId,
        itemId: po.itemId,
        categoryId: po.categoryId,
        subcategoryId: po.subcategoryId,
        orderedQuantity: po.requiredQuantity,
  orderedRate: poOrderedRate,
        receivedQuantity,
        receivedRate,
        totalAmount,
        receivedDate: payload.receivedDate ? new Date(payload.receivedDate) : new Date(),
      },
    });

    await tx.inventoryPurchaseOrder.update({
      where: { id: po.id },
      data: { status: 'received' },
    });

    const item = await tx.inventoryItem.findUnique({ where: { id: po.itemId } });
    const previousStock = Number(item?.currentStock || 0);
    const newStock = previousStock + receivedQuantity;

    await tx.inventoryStockMovement.create({
      data: {
        itemId: po.itemId,
        movementType: 'IN',
        quantity: receivedQuantity,
        unitRate: receivedRate,
        previousStock,
        newStock,
        referenceType: 'GRN',
        referenceId: grn.code,
        expiryDate: payload.expiryDate ? new Date(payload.expiryDate) : null,
        note: payload.note ? String(payload.note).trim() : null,
      },
    });

    const updatedItem = await tx.inventoryItem.update({
      where: { id: po.itemId },
      data: {
        currentStock: newStock,
        lastGrnRate: receivedRate,
        purchasePrice: receivedRate,
      },
    });

    await syncReorderAlert(tx, updatedItem);

    return grn;
  });
}

async function listGDs({ search, departmentId, demandCategoryTypeId, categoryId, subcategoryId, status, dateFrom, dateTo }) {
  const parsedDepartmentId = parsePositiveNumber(departmentId);
  const parsedDemandCategoryTypeId = parsePositiveNumber(demandCategoryTypeId);
  const parsedCategoryId = parsePositiveNumber(categoryId);
  const parsedSubcategoryId = parsePositiveNumber(subcategoryId);

  return prisma.inventoryGD.findMany({
    where: {
      ...buildSearchFilter(search, ['code']),
      ...buildStatusFilter(status),
      ...(parsedDepartmentId ? { departmentId: parsedDepartmentId } : {}),
      ...(parsedDemandCategoryTypeId ? { demandCategoryTypeId: parsedDemandCategoryTypeId } : {}),
      ...(parsedCategoryId ? { item: { categoryId: parsedCategoryId } } : {}),
      ...(parsedSubcategoryId ? { item: { subcategoryId: parsedSubcategoryId } } : {}),
      ...(dateFrom || dateTo
        ? {
            requestDate: {
              ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
              ...(dateTo ? { lte: new Date(dateTo) } : {}),
            },
          }
        : {}),
    },
    include: {
      item: { include: { category: true, subcategory: true } },
      department: true,
      demandCategoryType: true,
      gins: true,
    },
    orderBy: { createdAt: 'desc' },
  });
}

async function createGD(payload) {
  const itemId = Number(payload.itemId);
  const departmentId = Number(payload.departmentId);
  const quantityRequested = parsePositiveNumber(payload.quantityRequested);

  if (!Number.isFinite(quantityRequested) || quantityRequested <= 0) {
    throw new Error('quantityRequested must be a positive number');
  }

  const [item, department] = await Promise.all([
    prisma.inventoryItem.findUnique({ where: { id: itemId }, include: { category: true } }),
    prisma.inventoryDepartment.findUnique({ where: { id: departmentId } }),
  ]);

  if (!item) throw new Error('Item not found');
  if (!department) throw new Error('Department not found');
  if (department.status !== ACTIVE) throw new Error('Department is inactive');

  const requestedDemandTypeId = parsePositiveNumber(payload.demandCategoryTypeId);
  let resolvedDemandType = null;

  if (requestedDemandTypeId) {
    resolvedDemandType = await prisma.inventoryDemandCategoryType.findUnique({
      where: { id: requestedDemandTypeId },
    });
  }

  if (!resolvedDemandType) {
    resolvedDemandType = await prisma.inventoryDemandCategoryType.findFirst({
      where: { status: ACTIVE },
      orderBy: { createdAt: 'asc' },
    });
  }

  if (!resolvedDemandType) {
    const generatedCode = await generateDateCode('inventoryDemandCategoryType');
    resolvedDemandType = await prisma.inventoryDemandCategoryType.create({
      data: {
        code: generatedCode,
        name: 'General',
        status: ACTIVE,
      },
    });
  }

  const code = String(payload.code || '').trim() || await generateDocCode('inventoryGD', 'gd');
  return prisma.inventoryGD.create({
    data: {
      code,
      itemId,
      departmentId,
      demandCategoryTypeId: resolvedDemandType.id,
      quantityRequested,
      requestDate: payload.requestDate ? new Date(payload.requestDate) : new Date(),
      status: 'open',
    },
    include: {
      item: { include: { category: true, subcategory: true } },
      department: true,
      demandCategoryType: true,
    },
  });
}

async function listGINs({ search, departmentId, itemId, categoryId, subcategoryId, dateFrom, dateTo }) {
  const parsedDepartmentId = parsePositiveNumber(departmentId);
  const parsedItemId = parsePositiveNumber(itemId);
  const parsedCategoryId = parsePositiveNumber(categoryId);
  const parsedSubcategoryId = parsePositiveNumber(subcategoryId);

  return prisma.inventoryGIN.findMany({
    where: {
      ...buildSearchFilter(search, ['code']),
      ...(parsedDepartmentId ? { departmentId: parsedDepartmentId } : {}),
      ...(parsedItemId ? { itemId: parsedItemId } : {}),
      ...(parsedCategoryId ? { item: { categoryId: parsedCategoryId } } : {}),
      ...(parsedSubcategoryId ? { item: { subcategoryId: parsedSubcategoryId } } : {}),
      ...(dateFrom || dateTo
        ? {
            issueDate: {
              ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
              ...(dateTo ? { lte: new Date(dateTo) } : {}),
            },
          }
        : {}),
    },
    include: {
      gd: true,
      department: true,
      item: { include: { category: true, subcategory: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

async function createGIN(payload) {
  const issuedQuantity = parsePositiveNumber(payload.issuedQuantity);
  if (!Number.isFinite(issuedQuantity) || issuedQuantity <= 0) {
    throw new Error('issuedQuantity must be a positive number');
  }

  const gd = payload.gdId
    ? await prisma.inventoryGD.findUnique({ where: { id: Number(payload.gdId) }, include: { gins: true, item: true } })
    : await prisma.inventoryGD.findUnique({ where: { code: String(payload.gdCode || '').trim() }, include: { gins: true, item: true } });

  if (!gd) throw new Error('Linked GD not found');

  const alreadyIssued = (gd.gins || []).reduce((sum, x) => sum + (Number(x.issuedQuantity) || 0), 0);
  const remainingDemand = Number(gd.quantityRequested) - alreadyIssued;

  if (remainingDemand <= 0) {
    throw new Error('GD already fulfilled');
  }
  if (issuedQuantity > remainingDemand) {
    throw new Error('issuedQuantity cannot exceed remaining GD quantity');
  }

  const stock = Number(gd.item?.currentStock || 0);
  if (issuedQuantity > stock) {
    throw new Error('Insufficient stock for issuance');
  }

  const code = String(payload.code || '').trim() || await generateDocCode('inventoryGIN', 'gin');

  return prisma.$transaction(async (tx) => {
    const gin = await tx.inventoryGIN.create({
      data: {
        code,
        gdId: gd.id,
        itemId: gd.itemId,
        departmentId: gd.departmentId,
        issuedQuantity,
        issueDate: payload.issueDate ? new Date(payload.issueDate) : new Date(),
        status: 'issued',
      },
    });

    const item = await tx.inventoryItem.findUnique({ where: { id: gd.itemId } });
    const previousStock = Number(item?.currentStock || 0);
    const newStock = previousStock - issuedQuantity;

    await tx.inventoryStockMovement.create({
      data: {
        itemId: gd.itemId,
        movementType: 'OUT',
        quantity: issuedQuantity,
        previousStock,
        newStock,
        referenceType: 'GIN',
        referenceId: gin.code,
        note: payload.note ? String(payload.note).trim() : null,
      },
    });

    const updatedItem = await tx.inventoryItem.update({
      where: { id: gd.itemId },
      data: { currentStock: newStock },
    });

    await syncReorderAlert(tx, updatedItem);

    const totalIssuedAfter = alreadyIssued + issuedQuantity;
    await tx.inventoryGD.update({
      where: { id: gd.id },
      data: {
        status: totalIssuedAfter >= Number(gd.quantityRequested) ? 'closed' : 'partial',
      },
    });

    return gin;
  });
}

async function listSalesInvoices({ search, itemId, customerType, dateFrom, dateTo }) {
  const parsedItemId = parsePositiveNumber(itemId);
  const normalizedCustomerType = customerType ? normalizeCustomerType(customerType) : null;

  return prisma.inventorySalesInvoice.findMany({
    where: {
      ...buildSearchFilter(search, ['code', 'customerName']),
      ...(parsedItemId ? { itemId: parsedItemId } : {}),
      ...(normalizedCustomerType ? { customerType: normalizedCustomerType } : {}),
      ...(dateFrom || dateTo
        ? {
            invoiceDate: {
              ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
              ...(dateTo ? { lte: new Date(dateTo) } : {}),
            },
          }
        : {}),
    },
    include: {
      item: { include: { category: true, subcategory: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

async function createSalesInvoice(payload) {
  const itemId = Number(payload.itemId);
  const quantity = parsePositiveNumber(payload.quantity);
  const markupPercent = parsePositiveNumber(payload.markupPercent);
  const customerType = normalizeCustomerType(payload.customerType);
  const customerName = payload.customerName ? String(payload.customerName).trim() : '';

  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error('quantity must be a positive number');
  }

  if (!Number.isFinite(markupPercent) || markupPercent < 1 || markupPercent > 100) {
    throw new Error('markupPercent must be between 1 and 100');
  }

  if (customerType === 'customer' && !customerName) {
    throw new Error('customerName is required when customerType is customer');
  }

  return prisma.$transaction(async (tx) => {
    const item = await tx.inventoryItem.findUnique({
      where: { id: itemId },
      include: { category: true, subcategory: true },
    });

    if (!item) throw new Error('Item not found');
    if (item.status !== ACTIVE) throw new Error('Selected item is inactive');

    const stock = Number(item.currentStock || 0);
    if (quantity > stock) throw new Error('Insufficient stock for sales invoice');

    const purchasePrice = Number(item.purchasePrice || 0);
    const retailPrice = Number(item.lastGrnRate || item.purchasePrice || 0);
    const saleRate = retailPrice * (1 + (markupPercent / 100));
    const totalAmount = saleRate * quantity;

    const code = String(payload.code || '').trim() || await generateDocCode('inventorySalesInvoice', 'sinv');
    const invoice = await tx.inventorySalesInvoice.create({
      data: {
        code,
        itemId,
        invoiceDate: payload.invoiceDate ? new Date(payload.invoiceDate) : new Date(),
        customerType,
        customerName: customerType === 'customer' ? customerName : 'Walking Customer',
        quantity,
        purchasePrice,
        retailPrice,
        markupPercent,
        saleRate,
        totalAmount,
      },
      include: {
        item: { include: { category: true, subcategory: true } },
      },
    });

    const previousStock = stock;
    const newStock = previousStock - quantity;

    await tx.inventoryStockMovement.create({
      data: {
        itemId,
        movementType: 'OUT',
        quantity,
        unitRate: saleRate,
        previousStock,
        newStock,
        referenceType: 'SALES_INVOICE',
        referenceId: invoice.code,
        note: `Sales invoice for ${invoice.customerType}`,
      },
    });

    const updatedItem = await tx.inventoryItem.update({
      where: { id: itemId },
      data: { currentStock: newStock },
    });

    await syncReorderAlert(tx, updatedItem);

    return invoice;
  });
}

async function listGDNs({ search, itemId, categoryId, subcategoryId, dateFrom, dateTo }) {
  const parsedItemId = parsePositiveNumber(itemId);
  const parsedCategoryId = parsePositiveNumber(categoryId);
  const parsedSubcategoryId = parsePositiveNumber(subcategoryId);

  const rows = await prisma.inventoryGDN.findMany({
    where: {
      ...buildSearchFilter(search, ['code', 'reason']),
      ...(parsedItemId ? { itemId: parsedItemId } : {}),
      ...(parsedCategoryId ? { item: { categoryId: parsedCategoryId } } : {}),
      ...(parsedSubcategoryId ? { item: { subcategoryId: parsedSubcategoryId } } : {}),
      ...(dateFrom || dateTo
        ? {
            discardedDate: {
              ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
              ...(dateTo ? { lte: new Date(dateTo) } : {}),
            },
          }
        : {}),
    },
    include: {
      item: { include: { category: true, subcategory: true } },
    },
    orderBy: [{ discardedDate: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
  });

  if (!rows.length) return [];

  const itemIds = [...new Set(rows.map((row) => Number(row.itemId)).filter((id) => Number.isFinite(id) && id > 0))];
  const targetGdnCodes = new Set(rows.map((row) => String(row.code || '').trim()).filter(Boolean));

  const maxDiscardedDate = rows.reduce((latest, row) => {
    const rowDate = row?.discardedDate ? new Date(row.discardedDate) : null;
    if (!rowDate || Number.isNaN(rowDate.getTime())) return latest;
    if (!latest) return rowDate;
    return rowDate > latest ? rowDate : latest;
  }, null);

  const [itemMetaRows, stockMovements] = await Promise.all([
    prisma.inventoryItem.findMany({
      where: { id: { in: itemIds } },
      select: {
        id: true,
        code: true,
        name: true,
        purchasePrice: true,
        lastGrnRate: true,
      },
    }),
    prisma.inventoryStockMovement.findMany({
      where: {
        itemId: { in: itemIds },
        ...(maxDiscardedDate
          ? {
              createdAt: { lte: maxDiscardedDate },
            }
          : {}),
      },
      select: {
        id: true,
        itemId: true,
        movementType: true,
        quantity: true,
        unitRate: true,
        previousStock: true,
        newStock: true,
        referenceType: true,
        referenceId: true,
        createdAt: true,
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    }),
  ]);

  const itemMetaById = new Map(itemMetaRows.map((row) => [row.id, row]));
  const fifoLotsByItemId = new Map();
  const discardAmountByCode = new Map();

  itemIds.forEach((id) => {
    fifoLotsByItemId.set(id, []);
  });

  stockMovements.forEach((movement) => {
    const itemIdValue = Number(movement.itemId);
    const itemMeta = itemMetaById.get(itemIdValue);
    const lots = fifoLotsByItemId.get(itemIdValue) || [];
    const movementType = String(movement.movementType || '').trim().toUpperCase();
    const qty = Number(movement.quantity || 0);
    const fallbackRate = Number(itemMeta?.lastGrnRate ?? itemMeta?.purchasePrice ?? 0);
    const movementRate = Number(movement.unitRate);
    const effectiveRate = Number.isFinite(movementRate) && movementRate >= 0 ? movementRate : fallbackRate;

    const consumeOrThrow = (consumeQty, contextLabel) => {
      if (consumeQty <= 0) return 0;

      const consumed = consumeFifoLotsWithCost(lots, consumeQty);
      if (consumed.remaining > 0) {
        const itemLabel = itemMeta?.code
          ? `${itemMeta.code} (${itemMeta?.name || 'Unknown Item'})`
          : `${itemMeta?.name || `Item#${itemIdValue}`}`;
        throw new Error(`FIFO stock insufficient for ${itemLabel} while processing ${contextLabel}`);
      }

      fifoLotsByItemId.set(itemIdValue, lots);
      return consumed.cost;
    };

    if (movementType === 'IN') {
      if (qty > 0) {
        lots.push({ quantity: qty, rate: effectiveRate });
        fifoLotsByItemId.set(itemIdValue, lots);
      }
      return;
    }

    if (movementType === 'OUT') {
      const outCost = consumeOrThrow(qty, String(movement.referenceType || 'OUT'));
      const refType = String(movement.referenceType || '').trim().toUpperCase();
      const refId = String(movement.referenceId || '').trim();

      if (refType === 'GDN' && refId && targetGdnCodes.has(refId)) {
        discardAmountByCode.set(refId, Number(discardAmountByCode.get(refId) || 0) + outCost);
      }
      return;
    }

    if (movementType === 'ADJUSTMENT') {
      const previousStock = Number(movement.previousStock || 0);
      const newStock = Number(movement.newStock || 0);
      const delta = newStock - previousStock;

      if (delta > 0) {
        lots.push({ quantity: delta, rate: effectiveRate });
        fifoLotsByItemId.set(itemIdValue, lots);
      } else if (delta < 0) {
        consumeOrThrow(Math.abs(delta), 'ADJUSTMENT');
      }
    }
  });

  return rows
    .map((row) => {
      const amount = Number(discardAmountByCode.get(String(row.code || '').trim()) || 0);
      return {
        ...row,
        amount: Number(amount.toFixed(2)),
      };
    })
    .sort((a, b) => {
      const timeA = new Date(a.discardedDate || a.createdAt || 0).getTime();
      const timeB = new Date(b.discardedDate || b.createdAt || 0).getTime();
      return timeB - timeA;
    });
}

async function createGDN(payload) {
  const itemId = Number(payload.itemId);
  const quantity = parsePositiveNumber(payload.quantity);
  const reason = String(payload.reason || '').trim();

  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error('quantity must be a positive number');
  }
  if (!reason) {
    throw new Error('reason is required');
  }

  return prisma.$transaction(async (tx) => {
    const item = await tx.inventoryItem.findUnique({
      where: { id: itemId },
      include: { category: true, subcategory: true },
    });

    if (!item) throw new Error('Item not found');

    const previousStock = Number(item.currentStock || 0);
    if (quantity > previousStock) throw new Error('Insufficient stock for discard');

    const code = String(payload.code || '').trim() || await generateDocCode('inventoryGDN', 'gdn');

    const gdn = await tx.inventoryGDN.create({
      data: {
        code,
        itemId,
        quantity,
        reason,
        discardedDate: payload.discardedDate ? new Date(payload.discardedDate) : new Date(),
      },
      include: {
        item: { include: { category: true, subcategory: true } },
      },
    });

    const newStock = previousStock - quantity;

    await tx.inventoryStockMovement.create({
      data: {
        itemId,
        movementType: 'OUT',
        quantity,
        previousStock,
        newStock,
        referenceType: 'GDN',
        referenceId: gdn.code,
        note: reason,
      },
    });

    const updatedItem = await tx.inventoryItem.update({
      where: { id: itemId },
      data: { currentStock: newStock },
    });

    await syncReorderAlert(tx, updatedItem);

    return gdn;
  });
}

async function createItem(payload) {
  const name = String(payload.name || '').trim();
  const categoryId = Number(payload.categoryId);
  const subcategoryId = Number(payload.subcategoryId);
  const userProvidedCode = payload.code && String(payload.code).trim() ? String(payload.code).trim() : null;
  const status = normalizeStatus(payload.status);
  const itemType = String(payload.itemType || '').trim().toLowerCase();
  const usefulLifeUnit = String(payload.usefulLifeUnit || 'years').trim().toLowerCase();

  const assetConditionRaw = String(payload.assetCondition || '').trim().toLowerCase();
  const assetCondition = assetConditionRaw || 'working';
  const parsedSupplierId = parsePositiveNumber(payload.supplierId);

  await validateActiveMasterRecords(payload);

  // Check if item with same name already exists
  const duplicateItem = await prisma.inventoryItem.findFirst({
    where: {
      name: {
        equals: name,
        mode: 'insensitive',
      },
    },
    select: { id: true, code: true, name: true },
  });

  if (duplicateItem) {
    throw new Error('Item with this name already exists');
  }

  let purchasePrice = parsePositiveNumber(payload.purchasePrice);
  if (purchasePrice === null) {
    const lastRate = await getLastGrnRateForItemLikeName(name);
    if (lastRate === null) {
      throw new Error('purchasePrice is required for first-time item (no previous GRN rate found)');
    }
    purchasePrice = lastRate;
  }

  const reorderLevel = parsePositiveNumber(payload.reorderLevel, 0);
  const hasExpiry = Boolean(payload.hasExpiry);
  const usefulLifeYears = parsePositiveNumber(payload.usefulLifeYears);
  const bookValue = parsePositiveNumber(payload.bookValue);

  // Retry logic for code uniqueness (handles race conditions)
  let created;
  let retries = 0;
  const maxRetries = 5;

  while (retries < maxRetries) {
    try {
      const code = userProvidedCode || await generateInventoryItemCode({ categoryId, subcategoryId });
      
      created = await prisma.inventoryItem.create({
        data: {
          code,
          name,
          itemType,
          unit: String(payload.unit || '').trim().toLowerCase(),
          purchasePrice,
          lastGrnRate: purchasePrice,
          hasExpiry,
          reorderLevel: reorderLevel || 0,
          currentStock: parsePositiveNumber(payload.currentStock, 0) || 0,
          status,
          brand: parseOptionalString(payload.brand),
          model: parseOptionalString(payload.model),
          serialNumber: parseOptionalString(payload.serialNumber),
          assetLocation: parseOptionalString(payload.assetLocation),
          purchaseDate: parseOptionalDate(payload.purchaseDate),
          warrantyUntil: parseOptionalDate(payload.warrantyUntil),
          usefulLifeYears: Number.isFinite(usefulLifeYears) && usefulLifeYears > 0 ? Math.round(usefulLifeYears) : null,
          assetCondition,
          bookValue: Number.isFinite(bookValue) ? bookValue : (itemType === 'fixed asset' ? purchasePrice : null),
          categoryId,
          subcategoryId,
          supplierId: parsedSupplierId || null,
          storageId: parsePositiveNumber(payload.storageId),
        },
        include: {
          category: true,
          subcategory: true,
          storage: true,
        },
      });
      
      // Success - break out of retry loop
      break;
    } catch (err) {
      retries += 1;
      // If unique constraint error and not user-provided code, retry with new code
      if (String(err.message).toLowerCase().includes('unique') && !userProvidedCode && retries < maxRetries) {
        continue;
      }
      // Otherwise throw the error
      throw err;
    }
  }

  if (!created) {
    throw new Error('Failed to create item after multiple attempts');
  }

  if (Number.isFinite(usefulLifeYears) && usefulLifeYears > 0 && USEFUL_LIFE_UNITS.includes(usefulLifeUnit)) {
    try {
      await ensureUsefulLifeUnitColumn();
      await prisma.$executeRaw`
        UPDATE "InventoryItem"
        SET "usefulLifeUnit" = ${usefulLifeUnit}
        WHERE "id" = ${created.id}
      `;
    } catch {
      // Non-blocking: legacy DB may not support this optional field yet.
    }
  }

  return created;
}

async function updateItemStatus(itemId, payload) {
  const id = Number(itemId);
  const existing = await prisma.inventoryItem.findUnique({ where: { id } });
  if (!existing) throw new Error('Item not found');

  const status = normalizeStatus(payload.status);
  return prisma.inventoryItem.update({
    where: { id },
    data: { status },
    include: {
      category: true,
      subcategory: true,
      storage: true,
    },
  });
}

async function deleteItem(itemId) {
  const id = Number(itemId);
  const existing = await prisma.inventoryItem.findUnique({ where: { id } });
  if (!existing) throw new Error('Item not found');

  const [poCount, grnCount, gdCount, ginCount, movementCount] = await Promise.all([
    prisma.inventoryPurchaseOrder.count({ where: { itemId: id } }),
    prisma.inventoryGRN.count({ where: { itemId: id } }),
    prisma.inventoryGD.count({ where: { itemId: id } }),
    prisma.inventoryGIN.count({ where: { itemId: id } }),
    prisma.inventoryStockMovement.count({ where: { itemId: id } }),
  ]);

  const hasTransactions = poCount > 0 || grnCount > 0 || gdCount > 0 || ginCount > 0 || movementCount > 0;
  if (hasTransactions) {
    throw new Error('Item has transaction history and cannot be deleted. Please set status to inactive instead.');
  }

  await prisma.inventoryReorderAlert.deleteMany({ where: { itemId: id } });
  await prisma.inventoryItem.delete({ where: { id } });

  return { id, deleted: true };
}

async function syncReorderAlert(tx, item) {
  const openAlert = await tx.inventoryReorderAlert.findFirst({
    where: {
      itemId: item.id,
      status: 'open',
    },
    orderBy: { createdAt: 'desc' },
  });

  if (item.currentStock <= item.reorderLevel) {
    const message = `Reorder required for ${item.name} (${item.code}): stock ${item.currentStock} <= threshold ${item.reorderLevel}`;

    if (!openAlert) {
      await tx.inventoryReorderAlert.create({
        data: {
          itemId: item.id,
          thresholdQty: item.reorderLevel,
          currentQty: item.currentStock,
          status: 'open',
          message,
        },
      });
    } else {
      await tx.inventoryReorderAlert.update({
        where: { id: openAlert.id },
        data: {
          currentQty: item.currentStock,
          thresholdQty: item.reorderLevel,
          message,
        },
      });
    }
    return;
  }

  if (openAlert) {
    await tx.inventoryReorderAlert.update({
      where: { id: openAlert.id },
      data: {
        status: 'resolved',
        currentQty: item.currentStock,
        resolvedAt: new Date(),
      },
    });
  }
}

async function addStockMovement(itemId, payload) {
  const id = Number(itemId);
  const qty = parsePositiveNumber(payload.quantity);
  if (!Number.isFinite(qty) || qty <= 0) {
    throw new Error('quantity must be a positive number');
  }

  const movementType = String(payload.movementType || '').trim().toUpperCase();
  if (!['IN', 'OUT', 'ADJUSTMENT'].includes(movementType)) {
    throw new Error('movementType must be IN, OUT, or ADJUSTMENT');
  }

  return prisma.$transaction(async (tx) => {
    const item = await tx.inventoryItem.findUnique({ where: { id } });
    if (!item) throw new Error('Item not found');

    const previousStock = Number(item.currentStock || 0);
    let newStock = previousStock;

    if (movementType === 'IN') newStock = previousStock + qty;
    else if (movementType === 'OUT') newStock = previousStock - qty;
    else newStock = qty;

    if (newStock < 0) {
      throw new Error('Insufficient stock for OUT movement');
    }

    const unitRate = parsePositiveNumber(payload.unitRate);
    const referenceType = payload.referenceType ? String(payload.referenceType).trim().toUpperCase() : null;
    const referenceId = payload.referenceId ? String(payload.referenceId).trim() : null;

    const movement = await tx.inventoryStockMovement.create({
      data: {
        itemId: id,
        movementType,
        quantity: qty,
        unitRate,
        previousStock,
        newStock,
        referenceType,
        referenceId,
        note: payload.note ? String(payload.note).trim() : null,
        expiryDate: payload.expiryDate ? new Date(payload.expiryDate) : null,
      },
    });

    const updatePayload = {
      currentStock: newStock,
    };

    if (movementType === 'IN' && referenceType === 'GRN' && Number.isFinite(unitRate)) {
      updatePayload.lastGrnRate = unitRate;
      updatePayload.purchasePrice = unitRate;
    }

    const updatedItem = await tx.inventoryItem.update({
      where: { id },
      data: updatePayload,
    });

    await syncReorderAlert(tx, updatedItem);

    return {
      movement,
      item: updatedItem,
    };
  });
}

async function listOpenReorderAlerts() {
  return prisma.inventoryReorderAlert.findMany({
    where: { status: 'open' },
    include: {
      item: {
        include: {
          category: true,
          subcategory: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

function toStartOfDay(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d;
}

function toEndOfDay(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(23, 59, 59, 999);
  return d;
}

function normalizeUnit(unit) {
  return String(unit || '').trim().toLowerCase();
}

function getBaseUnitAndQuantity(unit, quantity) {
  const qty = Number(quantity) || 0;
  const normalized = normalizeUnit(unit);

  if (normalized === 'ml') {
    return { baseUnit: 'liters', baseQuantity: qty / 1000 };
  }

  if (normalized === 'dozen') {
    return { baseUnit: 'pieces', baseQuantity: qty * 12 };
  }

  if (normalized === 'feet') {
    return { baseUnit: 'millimeters', baseQuantity: qty * 304.8 };
  }

  if (normalized === 'inches') {
    return { baseUnit: 'millimeters', baseQuantity: qty * 25.4 };
  }

  if (normalized === 'centimeter') {
    return { baseUnit: 'millimeters', baseQuantity: qty * 10 };
  }

  if (normalized === 'kg' || normalized === 'liters' || normalized === 'pieces' || normalized === 'boxes' || normalized === 'millimeters') {
    return { baseUnit: normalized, baseQuantity: qty };
  }

  return { baseUnit: normalized || 'units', baseQuantity: qty };
}

function resolveMovementDelta(movement) {
  const type = String(movement?.movementType || '').trim().toUpperCase();
  const qty = Number(movement?.quantity || 0);

  if (type === 'IN') return qty;
  if (type === 'OUT') return -qty;

  if (type === 'ADJUSTMENT') {
    const previousStock = Number(movement?.previousStock || 0);
    const newStock = Number(movement?.newStock || 0);
    return newStock - previousStock;
  }

  return 0;
}

function consumeFifoLots(lots, quantity) {
  let remaining = Number(quantity) || 0;

  while (remaining > 0 && lots.length > 0) {
    const first = lots[0];
    if (first.quantity <= remaining) {
      remaining -= first.quantity;
      lots.shift();
    } else {
      first.quantity -= remaining;
      remaining = 0;
    }
  }
}

function calculateLotsAmount(lots) {
  return lots.reduce((sum, lot) => sum + (Number(lot.quantity || 0) * Number(lot.rate || 0)), 0);
}

function consumeFifoLotsWithCost(lots, quantity) {
  let remaining = Number(quantity) || 0;
  let totalCost = 0;

  while (remaining > 0 && lots.length > 0) {
    const first = lots[0];
    const lotQuantity = Number(first.quantity || 0);
    const lotRate = Number(first.rate || 0);

    if (lotQuantity <= remaining) {
      totalCost += lotQuantity * lotRate;
      remaining -= lotQuantity;
      lots.shift();
    } else {
      totalCost += remaining * lotRate;
      first.quantity = lotQuantity - remaining;
      remaining = 0;
    }
  }

  return {
    consumed: Number(quantity || 0) - remaining,
    remaining,
    cost: totalCost,
  };
}

function consumeFifoLotsWithBreakdown(lots, quantity) {
  let remaining = Number(quantity) || 0;
  let totalCost = 0;
  const breakdown = [];

  while (remaining > 0 && lots.length > 0) {
    const first = lots[0];
    const lotQuantity = Number(first.quantity || 0);
    const lotRate = Number(first.rate || 0);

    if (lotQuantity <= remaining) {
      totalCost += lotQuantity * lotRate;
      breakdown.push({ quantity: lotQuantity, rate: lotRate, amount: lotQuantity * lotRate });
      remaining -= lotQuantity;
      lots.shift();
    } else {
      totalCost += remaining * lotRate;
      breakdown.push({ quantity: remaining, rate: lotRate, amount: remaining * lotRate });
      first.quantity = lotQuantity - remaining;
      remaining = 0;
    }
  }

  return {
    consumed: Number(quantity || 0) - remaining,
    remaining,
    cost: totalCost,
    breakdown,
  };
}

function formatFifoBreakdown(breakdown) {
  if (!Array.isArray(breakdown) || breakdown.length === 0) return '';
  return breakdown
    .map((entry) => `${Number(entry.quantity || 0).toFixed(2)} @ ${Number(entry.rate || 0).toFixed(2)}`)
    .join(' + ');
}

function formatRemainingBreakdown(lots) {
  if (!Array.isArray(lots) || lots.length === 0) return '';
  return lots
    .filter((lot) => Number(lot.quantity || 0) > 0)
    .map((lot) => `${Number(lot.quantity || 0).toFixed(2)} @ ${Number(lot.rate || 0).toFixed(2)}`)
    .join(' + ');
}

async function listItemLedgerReport({ dateFrom, dateTo, itemId, categoryId, subcategoryId }) {
  const parsedItemId = parsePositiveNumber(itemId);
  const parsedCategoryId = parsePositiveNumber(categoryId);
  const parsedSubcategoryId = parsePositiveNumber(subcategoryId);

  const fromDate = toStartOfDay(dateFrom);
  const toDate = toEndOfDay(dateTo);

  const items = await prisma.inventoryItem.findMany({
    where: {
      ...(parsedItemId ? { id: parsedItemId } : {}),
      ...(parsedCategoryId ? { categoryId: parsedCategoryId } : {}),
      ...(parsedSubcategoryId ? { subcategoryId: parsedSubcategoryId } : {}),
    },
    include: {
      category: true,
      subcategory: true,
    },
    orderBy: [{ code: 'asc' }, { name: 'asc' }],
  });

  if (!items.length) {
    return {
      rows: [],
      groups: [],
      summary: {
        itemCount: 0,
        openingBalance: 0,
        totalReceived: 0,
        totalIssued: 0,
        closingBalance: 0,
      },
    };
  }

  const itemIds = items.map((item) => item.id);
  const itemById = new Map(items.map((item) => [item.id, item]));

  const stockMovements = await prisma.inventoryStockMovement.findMany({
    where: {
      itemId: { in: itemIds },
    },
    select: {
      id: true,
      itemId: true,
      movementType: true,
      quantity: true,
  unitRate: true,
      previousStock: true,
      newStock: true,
      referenceType: true,
      referenceId: true,
      note: true,
      createdAt: true,
    },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });

  const grnRefs = [...new Set(
    stockMovements
      .filter((m) => String(m.referenceType || '').toUpperCase() === 'GRN' && m.referenceId)
      .map((m) => String(m.referenceId))
  )];
  const ginRefs = [...new Set(
    stockMovements
      .filter((m) => String(m.referenceType || '').toUpperCase() === 'GIN' && m.referenceId)
      .map((m) => String(m.referenceId))
  )];

  const [grns, gins] = await Promise.all([
    grnRefs.length
      ? prisma.inventoryGRN.findMany({
          where: { code: { in: grnRefs } },
          select: { code: true, receivedDate: true },
        })
      : Promise.resolve([]),
    ginRefs.length
      ? prisma.inventoryGIN.findMany({
          where: { code: { in: ginRefs } },
          select: { code: true, issueDate: true },
        })
      : Promise.resolve([]),
  ]);

  const grnDateByCode = new Map(grns.map((row) => [row.code, row.receivedDate]));
  const ginDateByCode = new Map(gins.map((row) => [row.code, row.issueDate]));

  const normalizedMovements = stockMovements
    .map((movement) => {
      const referenceType = String(movement.referenceType || '').trim().toUpperCase();
      const referenceId = movement.referenceId ? String(movement.referenceId) : null;
      const delta = resolveMovementDelta(movement);

      let eventDate = movement.createdAt;
      if (referenceType === 'GRN' && referenceId && grnDateByCode.has(referenceId)) {
        eventDate = grnDateByCode.get(referenceId) || movement.createdAt;
      } else if (referenceType === 'GIN' && referenceId && ginDateByCode.has(referenceId)) {
        eventDate = ginDateByCode.get(referenceId) || movement.createdAt;
      }

      return {
        ...movement,
        referenceType,
        referenceId,
        delta,
        eventDate,
      };
    })
    .filter((movement) => {
      if (!Number.isFinite(movement.delta) || movement.delta === 0) return false;

      const movementType = String(movement.movementType || '').trim().toUpperCase();
      const referenceType = String(movement.referenceType || '').trim().toUpperCase();

      if (referenceType === 'GRN' || referenceType === 'GIN') return true;
      if (movementType === 'ADJUSTMENT') return true;
      if (referenceType.includes('RETURN') || referenceType.includes('REVERS')) return true;

      return false;
    })
    .sort((a, b) => {
      const timeA = new Date(a.eventDate).getTime();
      const timeB = new Date(b.eventDate).getTime();
      if (timeA !== timeB) return timeA - timeB;

      const typeA = a.delta >= 0 ? 0 : 1;
      const typeB = b.delta >= 0 ? 0 : 1;
      if (typeA !== typeB) return typeA - typeB;

      return a.id - b.id;
    });

  const stateByItemId = new Map();
  const openingByItemId = new Map();

  itemIds.forEach((id) => {
    stateByItemId.set(id, {
      runningBalance: 0,
      runningAmount: 0,
      fifoLots: [],
    });
    openingByItemId.set(id, { quantity: 0, amount: 0 });
  });

  const rows = [];

  normalizedMovements.forEach((movement) => {
    const item = itemById.get(movement.itemId);
    if (!item) return;

    const state = stateByItemId.get(item.id);
    if (!state) return;

    const isBeforeRange = Boolean(fromDate) && new Date(movement.eventDate) < fromDate;
    const isAfterRange = Boolean(toDate) && new Date(movement.eventDate) > toDate;

    const isInbound = movement.delta > 0;
    const movementAbsQty = Math.abs(movement.delta);
    const { baseUnit, baseQuantity } = getBaseUnitAndQuantity(item.unit, movementAbsQty);

    const movementRate = Number(movement.unitRate || 0);
  let receivedRate = 0;
  let receivedAmount = 0;
  let issueAmount = 0;
  let issuedQuantity = 0;
  let issuanceBreakdown = '';
  let remainingBreakdown = '';

    if (isInbound) {
      receivedRate = movementRate;
      receivedAmount = baseQuantity * movementRate;
      state.fifoLots.push({
        quantity: baseQuantity,
        rate: movementRate,
        date: movement.eventDate,
      });
      state.runningBalance += baseQuantity;
      state.runningAmount += receivedAmount;
    } else {
      const fifoResult = consumeFifoLotsWithBreakdown(state.fifoLots, baseQuantity);
      issuedQuantity = fifoResult.consumed;
      issueAmount = fifoResult.cost;
      issuanceBreakdown = formatFifoBreakdown(fifoResult.breakdown);
      state.runningBalance -= issuedQuantity;
      state.runningAmount = Math.max(0, state.runningAmount - issueAmount);
    }

    remainingBreakdown = formatRemainingBreakdown(state.fifoLots);

    if (isBeforeRange) {
      openingByItemId.set(item.id, {
        quantity: state.runningBalance,
        amount: state.runningAmount,
      });
      return;
    }

    if (isAfterRange) {
      return;
    }

    rows.push({
      key: `${movement.id}`,
      date: new Date(movement.eventDate).toISOString(),
      itemId: item.id,
      itemCode: item.code,
      itemName: item.name,
      category: item.category?.name || '-',
      subcategory: item.subcategory?.name || '-',
      receivedQuantity: isInbound ? baseQuantity : 0,
      receivedRate: isInbound ? receivedRate : 0,
      receivedAmount: isInbound ? receivedAmount : 0,
      issuanceQuantity: isInbound ? 0 : issuedQuantity,
      issuanceAmount: isInbound ? 0 : issueAmount,
  issuanceBreakdown: isInbound ? '' : issuanceBreakdown,
      remainingQuantity: state.runningBalance,
      remainingAmount: state.runningAmount,
  remainingBreakdown,
      baseUnit,
      sourceType: movement.referenceType || movement.movementType,
      referenceNo: movement.referenceId || '-',
      note: movement.note || null,
    });
  });

  const groupsMap = new Map();
  rows.forEach((row) => {
    if (!groupsMap.has(row.itemId)) {
      groupsMap.set(row.itemId, {
        itemId: row.itemId,
        itemCode: row.itemCode,
        itemName: row.itemName,
        category: row.category,
        subcategory: row.subcategory,
        baseUnit: row.baseUnit,
        openingBalance: openingByItemId.get(row.itemId)?.quantity || 0,
        openingAmount: openingByItemId.get(row.itemId)?.amount || 0,
        rows: [],
      });
    }

    groupsMap.get(row.itemId).rows.push(row);
  });

  const groups = Array.from(groupsMap.values()).map((group) => {
    const totalReceived = group.rows.reduce((sum, row) => sum + (Number(row.receivedQuantity) || 0), 0);
    const totalIssued = group.rows.reduce((sum, row) => sum + (Number(row.issuanceQuantity) || 0), 0);
    const totalReceivedAmount = group.rows.reduce((sum, row) => sum + (Number(row.receivedAmount) || 0), 0);
    const totalIssuedAmount = group.rows.reduce((sum, row) => sum + (Number(row.issuanceAmount) || 0), 0);
    const closingBalance = group.rows.length
      ? Number(group.rows[group.rows.length - 1].remainingQuantity || 0)
      : Number(group.openingBalance || 0);
    const closingAmount = group.rows.length
      ? Number(group.rows[group.rows.length - 1].remainingAmount || 0)
      : Number(group.openingAmount || 0);

    return {
      ...group,
      totalReceived,
      totalIssued,
      closingBalance,
      totalReceivedAmount,
      totalIssuedAmount,
      closingAmount,
    };
  });

  const summary = groups.reduce((acc, group) => {
    acc.itemCount += 1;
    acc.openingBalance += Number(group.openingBalance || 0);
    acc.totalReceived += Number(group.totalReceived || 0);
    acc.totalIssued += Number(group.totalIssued || 0);
    acc.closingBalance += Number(group.closingBalance || 0);
    acc.openingAmount += Number(group.openingAmount || 0);
    acc.totalReceivedAmount += Number(group.totalReceivedAmount || 0);
    acc.totalIssuedAmount += Number(group.totalIssuedAmount || 0);
    acc.closingAmount += Number(group.closingAmount || 0);
    return acc;
  }, {
    itemCount: 0,
    openingBalance: 0,
    totalReceived: 0,
    totalIssued: 0,
    closingBalance: 0,
    openingAmount: 0,
    totalReceivedAmount: 0,
    totalIssuedAmount: 0,
    closingAmount: 0,
  });

  return {
    rows,
    groups,
    summary,
  };
}

async function listShortExpiryReport({
  dateFrom,
  dateTo,
  itemId,
  categoryId,
  subcategoryId,
  dateLog,
  dateLogFrom,
  dateLogTo,
}) {
  const parsedItemId = parsePositiveNumber(itemId);
  const parsedCategoryId = parsePositiveNumber(categoryId);
  const parsedSubcategoryId = parsePositiveNumber(subcategoryId);
  const expiryFrom = toStartOfDay(dateFrom);
  const expiryTo = toEndOfDay(dateTo);

  let logDates = [];
  if (dateLog) {
    const single = toStartOfDay(dateLog);
    if (single) logDates = [single];
  } else if (dateLogFrom || dateLogTo) {
    const from = toStartOfDay(dateLogFrom || dateLogTo);
    const to = toStartOfDay(dateLogTo || dateLogFrom);
    if (from && to) {
      const start = from <= to ? from : to;
      const end = from <= to ? to : from;
      const cursor = new Date(start);

      while (cursor <= end) {
        logDates.push(new Date(cursor));
        cursor.setDate(cursor.getDate() + 1);
        if (logDates.length > 366) break;
      }
    }
  }

  if (!logDates.length) {
    logDates = [toStartOfDay(new Date())];
  }

  const maxLogDate = logDates.reduce((latest, current) => (current > latest ? current : latest), logDates[0]);
  const maxLogEnd = toEndOfDay(maxLogDate);

  const items = await prisma.inventoryItem.findMany({
    where: {
      hasExpiry: true,
      ...(parsedItemId ? { id: parsedItemId } : {}),
      ...(parsedCategoryId ? { categoryId: parsedCategoryId } : {}),
      ...(parsedSubcategoryId ? { subcategoryId: parsedSubcategoryId } : {}),
    },
    include: {
      category: true,
      subcategory: true,
    },
    orderBy: [{ code: 'asc' }, { name: 'asc' }],
  });

  if (!items.length) return [];

  const itemById = new Map(items.map((row) => [row.id, row]));
  const itemIds = items.map((row) => row.id);

  const stockMovements = await prisma.inventoryStockMovement.findMany({
    where: {
      itemId: { in: itemIds },
      movementType: { in: ['IN', 'OUT', 'ADJUSTMENT'] },
      createdAt: { lte: maxLogEnd },
    },
    select: {
      id: true,
      itemId: true,
      movementType: true,
      quantity: true,
      previousStock: true,
      newStock: true,
      expiryDate: true,
      createdAt: true,
    },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });

  const rows = [];
  const msPerDay = 24 * 60 * 60 * 1000;

  logDates.forEach((logDate) => {
    const logDateEnd = toEndOfDay(logDate);
    const lotsByItemId = new Map(itemIds.map((id) => [id, []]));

    stockMovements.forEach((movement) => {
      if (new Date(movement.createdAt) > logDateEnd) return;

      const lots = lotsByItemId.get(movement.itemId) || [];
      const movementType = String(movement.movementType || '').trim().toUpperCase();
      const qty = Number(movement.quantity || 0);

      if (movementType === 'IN') {
        if (qty > 0 && movement.expiryDate) {
          lots.push({
            quantity: qty,
            expiryDate: new Date(movement.expiryDate),
          });
        }
        lotsByItemId.set(movement.itemId, lots);
        return;
      }

      if (movementType === 'OUT') {
        consumeFifoLots(lots, qty);
        lotsByItemId.set(movement.itemId, lots);
        return;
      }

      if (movementType === 'ADJUSTMENT') {
        const previousStock = Number(movement.previousStock || 0);
        const newStock = Number(movement.newStock || 0);
        const delta = newStock - previousStock;

        if (delta > 0 && movement.expiryDate) {
          lots.push({
            quantity: delta,
            expiryDate: new Date(movement.expiryDate),
          });
          lotsByItemId.set(movement.itemId, lots);
          return;
        }

        if (delta < 0) {
          consumeFifoLots(lots, Math.abs(delta));
          lotsByItemId.set(movement.itemId, lots);
        }
      }
    });

    itemIds.forEach((itemIdValue) => {
      const item = itemById.get(itemIdValue);
      const lots = lotsByItemId.get(itemIdValue) || [];

      lots.forEach((lot) => {
        const lotQty = Number(lot.quantity || 0);
        const lotExpiry = lot.expiryDate ? new Date(lot.expiryDate) : null;
        if (!lotExpiry || Number.isNaN(lotExpiry.getTime())) return;
        if (lotQty <= 0) return;

        if (expiryFrom && lotExpiry < expiryFrom) return;
        if (expiryTo && lotExpiry > expiryTo) return;

        const daysLeft = Math.ceil((toStartOfDay(lotExpiry).getTime() - logDate.getTime()) / msPerDay);
        if (daysLeft < 0 || daysLeft > 30) return;

        rows.push({
          key: `${itemIdValue}-${lotExpiry.toISOString()}-${logDate.toISOString()}`,
          date: lotExpiry.toISOString(),
          dateLog: logDate.toISOString(),
          itemId: item.id,
          itemName: item.name,
          itemCode: item.code,
          category: item.category?.name || '-',
          subcategory: item.subcategory?.name || '-',
          quantity: Number(lotQty.toFixed(2)),
          daysLeft,
        });
      });
    });
  });

  const aggregated = new Map();
  rows.forEach((row) => {
    const key = `${row.itemId}-${row.date}-${row.dateLog}`;
    if (!aggregated.has(key)) {
      aggregated.set(key, { ...row });
      return;
    }

    const existing = aggregated.get(key);
    existing.quantity = Number((Number(existing.quantity || 0) + Number(row.quantity || 0)).toFixed(2));
    aggregated.set(key, existing);
  });

  return Array.from(aggregated.values()).sort((a, b) => {
    const logA = new Date(a.dateLog).getTime();
    const logB = new Date(b.dateLog).getTime();
    if (logA !== logB) return logB - logA;

    const expA = new Date(a.date).getTime();
    const expB = new Date(b.date).getTime();
    if (expA !== expB) return expA - expB;

    return String(a.itemCode || '').localeCompare(String(b.itemCode || ''));
  });
}

async function listItemAddOptions({ search }) {
  await ensureMasterCodeNormalization();

  const q = normalizeSearch(search);

  const [categories, subcategories, suppliers, storages, departments, demandCategoryTypes] = await Promise.all([
    prisma.inventoryCategory.findMany({
      where: {
        status: ACTIVE,
        ...buildSearchFilter(q, ['code', 'name']),
      },
      orderBy: { name: 'asc' },
    }),
    prisma.inventorySubcategory.findMany({
      where: {
        status: ACTIVE,
        ...buildSearchFilter(q, ['code', 'name']),
      },
      include: { category: true },
      orderBy: { name: 'asc' },
    }),
    prisma.inventorySupplier.findMany({
      where: {
        status: ACTIVE,
        ...buildSearchFilter(q, ['code', 'name']),
      },
      orderBy: { name: 'asc' },
    }),
    prisma.inventoryStorage.findMany({
      where: {
        status: ACTIVE,
        ...buildSearchFilter(q, ['code', 'name', 'numberAllotment']),
      },
      orderBy: { name: 'asc' },
    }),
    prisma.inventoryDepartment.findMany({
      where: {
        status: ACTIVE,
        ...buildSearchFilter(q, ['code', 'name']),
      },
      orderBy: { name: 'asc' },
    }),
    prisma.inventoryDemandCategoryType.findMany({
      where: {
        status: ACTIVE,
        ...buildSearchFilter(q, ['code', 'name']),
      },
      orderBy: { name: 'asc' },
    }),
  ]);

  return { categories, subcategories, suppliers, storages, departments, demandCategoryTypes };
}

async function listStockPositionReport({ asOfDate, categoryId, subcategoryId }) {
  const parsedCategoryId = parsePositiveNumber(categoryId);
  const parsedSubcategoryId = parsePositiveNumber(subcategoryId);

  // Set asOfDate to end of day if provided, else use today
  const snapshotDate = asOfDate ? toEndOfDay(asOfDate) : toEndOfDay(new Date());

  // Fetch all items matching filters
  const items = await prisma.inventoryItem.findMany({
    where: {
      ...(parsedCategoryId ? { categoryId: parsedCategoryId } : {}),
      ...(parsedSubcategoryId ? { subcategoryId: parsedSubcategoryId } : {}),
    },
    include: {
      category: true,
      subcategory: true,
    },
    orderBy: [{ code: 'asc' }, { name: 'asc' }],
  });

  if (!items.length) {
    return {
      rows: [],
      total: {
        itemCount: 0,
        totalQuantity: 0,
        totalAmount: 0,
      },
    };
  }

  const itemIds = items.map((item) => item.id);
  const itemById = new Map(items.map((item) => [item.id, item]));

  // Fetch all stock movements up to asOfDate
  const stockMovements = await prisma.inventoryStockMovement.findMany({
    where: {
      itemId: { in: itemIds },
      createdAt: { lte: snapshotDate },
    },
    select: {
      id: true,
      itemId: true,
      movementType: true,
      quantity: true,
      unitRate: true,
      previousStock: true,
      newStock: true,
      referenceType: true,
      referenceId: true,
      note: true,
      createdAt: true,
    },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });

  // Fetch GRN and GIN references to get actual event dates
  const grnRefs = [...new Set(
    stockMovements
      .filter((m) => String(m.referenceType || '').toUpperCase() === 'GRN' && m.referenceId)
      .map((m) => String(m.referenceId))
  )];
  const ginRefs = [...new Set(
    stockMovements
      .filter((m) => String(m.referenceType || '').toUpperCase() === 'GIN' && m.referenceId)
      .map((m) => String(m.referenceId))
  )];

  const [grns, gins] = await Promise.all([
    grnRefs.length
      ? prisma.inventoryGRN.findMany({
          where: { code: { in: grnRefs } },
          select: { code: true, receivedDate: true },
        })
      : Promise.resolve([]),
    ginRefs.length
      ? prisma.inventoryGIN.findMany({
          where: { code: { in: ginRefs } },
          select: { code: true, issueDate: true },
        })
      : Promise.resolve([]),
  ]);

  const grnDateByCode = new Map(grns.map((row) => [row.code, row.receivedDate]));
  const ginDateByCode = new Map(gins.map((row) => [row.code, row.issueDate]));

  // Normalize and sort movements
  const normalizedMovements = stockMovements
    .map((movement) => {
      const referenceType = String(movement.referenceType || '').trim().toUpperCase();
      const referenceId = movement.referenceId ? String(movement.referenceId) : null;
      const delta = resolveMovementDelta(movement);

      let eventDate = movement.createdAt;
      if (referenceType === 'GRN' && referenceId && grnDateByCode.has(referenceId)) {
        eventDate = grnDateByCode.get(referenceId) || movement.createdAt;
      } else if (referenceType === 'GIN' && referenceId && ginDateByCode.has(referenceId)) {
        eventDate = ginDateByCode.get(referenceId) || movement.createdAt;
      }

      return {
        ...movement,
        referenceType,
        referenceId,
        delta,
        eventDate,
      };
    })
    .filter((movement) => {
      if (!Number.isFinite(movement.delta) || movement.delta === 0) return false;

      const movementType = String(movement.movementType || '').trim().toUpperCase();
      const referenceType = String(movement.referenceType || '').trim().toUpperCase();

      if (referenceType === 'GRN' || referenceType === 'GIN') return true;
      if (movementType === 'ADJUSTMENT') return true;
      if (referenceType.includes('RETURN') || referenceType.includes('REVERS')) return true;

      return false;
    })
    .sort((a, b) => {
      const timeA = new Date(a.eventDate).getTime();
      const timeB = new Date(b.eventDate).getTime();
      if (timeA !== timeB) return timeA - timeB;

      const typeA = a.delta >= 0 ? 0 : 1;
      const typeB = b.delta >= 0 ? 0 : 1;
      if (typeA !== typeB) return typeA - typeB;

      return a.id - b.id;
    });

  // Initialize state for each item
  const stateByItemId = new Map();
  itemIds.forEach((id) => {
    stateByItemId.set(id, {
      runningBalance: 0,
      runningAmount: 0,
      fifoLots: [],
    });
  });

  // Process all movements to reach asOfDate snapshot
  normalizedMovements.forEach((movement) => {
    const state = stateByItemId.get(movement.itemId);
    if (!state) return;

    const isInbound = movement.delta > 0;
    const movementAbsQty = Math.abs(movement.delta);

    const movementRate = Number(movement.unitRate || 0);

    if (isInbound) {
      const { baseQuantity } = getBaseUnitAndQuantity(itemById.get(movement.itemId).unit, movementAbsQty);
      const receivedAmount = baseQuantity * movementRate;
      state.fifoLots.push({
        quantity: baseQuantity,
        rate: movementRate,
        date: movement.eventDate,
      });
      state.runningBalance += baseQuantity;
      state.runningAmount += receivedAmount;
    } else {
      const { baseQuantity } = getBaseUnitAndQuantity(itemById.get(movement.itemId).unit, movementAbsQty);
      const fifoResult = consumeFifoLotsWithBreakdown(state.fifoLots, baseQuantity);
      state.runningBalance -= fifoResult.consumed;
      state.runningAmount = Math.max(0, state.runningAmount - fifoResult.cost);
    }
  });

  // Build rows for stock position snapshot
  const rows = items.map((item) => {
    const state = stateByItemId.get(item.id);
    const { baseUnit } = getBaseUnitAndQuantity(item.unit, 1);
    const remainingBreakdown = formatRemainingBreakdown(state?.fifoLots || []);

    return {
      key: item.id,
      code: item.code,
      name: item.name,
      category: item.category?.name || '-',
      subcategory: item.subcategory?.name || '-',
      currentQuantity: state?.runningBalance || 0,
      currentAmount: state?.runningAmount || 0,
      breakdown: remainingBreakdown,
      unit: baseUnit,
      status: item.status,
    };
  }).filter((row) => row.currentQuantity > 0); // Only show items with stock

  // Calculate totals
  const total = rows.reduce((acc, row) => {
    acc.itemCount += 1;
    acc.totalQuantity += row.currentQuantity;
    acc.totalAmount += row.currentAmount;
    return acc;
  }, {
    itemCount: 0,
    totalQuantity: 0,
    totalAmount: 0,
  });

  return {
    rows,
    total,
    asOfDate: snapshotDate.toISOString(),
  };
}

module.exports = {
  listCategories,
  createCategory,
  listSubcategories,
  createSubcategory,
  listSuppliers,
  createSupplier,
  listStorages,
  createStorage,
  listDepartments,
  createDepartment,
  listDemandCategoryTypes,
  createDemandCategoryType,
  listItems,
  createItem,
  updateItemStatus,
  deleteItem,
  listPurchaseOrders,
  createPurchaseOrder,
  listGRNs,
  createGRN,
  listGDs,
  createGD,
  listGINs,
  createGIN,
  listSalesInvoices,
  createSalesInvoice,
  listGDNs,
  createGDN,
  addStockMovement,
  listOpenReorderAlerts,
  listItemAddOptions,
  listItemLedgerReport,
  listStockPositionReport,
  listShortExpiryReport,
};
