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

async function generateSubcategoryCode(categoryId) {
  const category = await prisma.inventoryCategory.findUnique({
    where: { id: categoryId },
    select: { code: true },
  });
  if (!category) throw new Error('Category not found');
  const catCode = String(category.code || '');
  const existing = await prisma.inventorySubcategory.findMany({
    where: { categoryId },
    select: { code: true },
  });
  let maxSeq = 0;
  existing.forEach((row) => {
    const code = String(row.code || '');
    if (code.startsWith(catCode) && code.length === catCode.length + 2) {
      const seq = Number(code.slice(catCode.length));
      if (Number.isFinite(seq) && seq > 0) maxSeq = Math.max(maxSeq, seq);
    }
  });
  return `${catCode}${padTwo(maxSeq + 1)}`;
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
    const subcategoriesNeedNormalization = subcategories.some((row) => !/^\d{4}$/.test(String(row.code || '')));

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

    const categoryCodeMap = {};
    categories.forEach((row, index) => {
      categoryCodeMap[row.id] = padTwo(index + 1);
    });
    const subSeqByCat = {};
    const subcategoryUpdates = subcategories.map((row) => {
      const catCode = categoryCodeMap[row.categoryId] || '00';
      subSeqByCat[row.categoryId] = (subSeqByCat[row.categoryId] || 0) + 1;
      return { id: row.id, code: `${catCode}${padTwo(subSeqByCat[row.categoryId])}` };
    });
    await Promise.all(subcategoryUpdates.map((u) =>
      tx.inventorySubcategory.update({
        where: { id: u.id },
        data: { code: u.code },
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
  const subCode = String(subcategoryRow.code || '');
  const subcategoryPart = subCode.length === 4 ? subCode.slice(2) : (parseTwoDigitCode(subCode) || padTwo(subcategorySequence));
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
  if (v === 'admission') return 'admission';
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
  const duplicate = await prisma.inventoryCategory.findFirst({ where: { name: { equals: name, mode: 'insensitive' } }, select: { id: true } });
  if (duplicate) throw new Error('Category with this name already exists');

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
  const catId = Number(payload.categoryId);
  const duplicate = await prisma.inventorySubcategory.findFirst({ where: { name: { equals: name, mode: 'insensitive' }, categoryId: catId }, select: { id: true } });
  if (duplicate) throw new Error('Subcategory with this name already exists in the selected category');

  const status = normalizeStatus(payload.status);

  // Never use a user-supplied code for subcategories — always auto-generate
  let code = await generateSubcategoryCode(catId);

  // Safety: if generated code already exists globally, keep incrementing
  let attempt = 0;
  while (attempt < 10) {
    const codeExists = await prisma.inventorySubcategory.findFirst({ where: { code }, select: { id: true } });
    if (!codeExists) break;
    attempt++;
    const category = await prisma.inventoryCategory.findUnique({ where: { id: catId }, select: { code: true } });
    const catCode = String(category?.code || '');
    const existing = await prisma.inventorySubcategory.findMany({ where: { categoryId: catId }, select: { code: true } });
    let maxSeq = 0;
    existing.forEach((row) => {
      const c = String(row.code || '');
      if (c.startsWith(catCode) && c.length === catCode.length + 2) {
        const seq = Number(c.slice(catCode.length));
        if (Number.isFinite(seq) && seq > 0) maxSeq = Math.max(maxSeq, seq);
      }
    });
    code = `${catCode}${String(maxSeq + 1 + attempt).padStart(2, '0')}`;
  }

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
  const name = String(payload.name || '').trim();
  const duplicate = await prisma.inventorySupplier.findFirst({ where: { name: { equals: name, mode: 'insensitive' } }, select: { id: true } });
  if (duplicate) throw new Error('Supplier with this name already exists');

  const status = normalizeStatus(payload.status);
  const code = String(payload.code || '').trim() || await generateTwoDigitMasterCode('inventorySupplier');

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
  const name = String(payload.name || '').trim();
  const duplicate = await prisma.inventoryStorage.findFirst({ where: { name: { equals: name, mode: 'insensitive' } }, select: { id: true } });
  if (duplicate) throw new Error('Storage with this name already exists');

  const status = normalizeStatus(payload.status);
  const code = String(payload.code || '').trim() || await generateTwoDigitMasterCode('inventoryStorage');

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
  const name = String(payload.name || '').trim();
  const duplicate = await prisma.inventoryDepartment.findFirst({ where: { name: { equals: name, mode: 'insensitive' } }, select: { id: true } });
  if (duplicate) throw new Error('Department with this name already exists');

  const status = normalizeStatus(payload.status);
  const code = String(payload.code || '').trim() || await generateTwoDigitMasterCode('inventoryDepartment');

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

async function listItems({ search, status, categoryId, supplierId, assetType }) {
  const parsedCategoryId = parsePositiveNumber(categoryId);
  const parsedSupplierId = parsePositiveNumber(supplierId);

  return prisma.inventoryItem.findMany({
    where: {
      ...buildStatusFilter(status),
      ...buildSearchFilter(search, ['code', 'name', 'itemType', 'unit']),
      ...(parsedCategoryId ? { categoryId: parsedCategoryId } : {}),
      ...(parsedSupplierId ? { supplierId: parsedSupplierId } : {}),
      ...(assetType ? { itemType: assetType } : {}),
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

async function listPurchaseOrders({ search, status, supplierId, itemId, dateFrom, dateTo, assetType }) {
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
      ...(assetType ? { item: { itemType: assetType } } : {}),
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

async function listGRNs({ search, supplierId, itemId, categoryId, subcategoryId, dateFrom, dateTo, assetType }) {
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
      ...(assetType ? { item: { itemType: assetType } } : {}),
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

  if (!Number.isFinite(receivedQuantity) || receivedQuantity < 0) {
    throw new Error('receivedQuantity must be a non-negative number');
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
        retailPrice: payload.retailPrice ? Number(payload.retailPrice) : null,
        totalAmount,
        receivedDate: payload.receivedDate ? new Date(payload.receivedDate) : new Date(),
        billDate: payload.billDate ? new Date(payload.billDate) : null,
        paymentType: payload.paymentType === 'installment' ? 'installment' : 'cash',
        paymentNote: payload.paymentNote ? String(payload.paymentNote).trim() : null,
        manufacturer: payload.manufacturer ? String(payload.manufacturer).trim() : null,
        model: payload.model ? String(payload.model).trim() : null,
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
        lastGrnRate: payload.retailPrice ? Number(payload.retailPrice) : receivedRate,
        purchasePrice: receivedRate,
      },
    });

    await syncReorderAlert(tx, updatedItem);

    if (updatedItem.itemType === 'fixed asset') {
      const count = Math.floor(receivedQuantity);
      const existingTags = await tx.assetInstance.findMany({
        where: { itemId: po.itemId },
        select: { assetTag: true },
      });
      let nextSeq = 1;
      if (existingTags.length > 0) {
        const maxSeq = existingTags.reduce((max, inst) => {
          const parts = String(inst.assetTag).split('-');
          const tail = Number(parts[parts.length - 1]);
          return Number.isFinite(tail) && tail > max ? tail : max;
        }, 0);
        if (maxSeq > 0) nextSeq = maxSeq + 1;
      }
      const instanceData = [];
      for (let i = 0; i < count; i++) {
        instanceData.push({
          assetTag: `${updatedItem.code}-${String(nextSeq + i).padStart(2, '0')}`,
          itemId: po.itemId,
          grnId: grn.id,
          condition: 'working',
        });
      }
      await tx.assetInstance.createMany({ data: instanceData });
    }

    return grn;
  });
}

async function updateGRN(id, payload) {
  const grn = await prisma.inventoryGRN.findUnique({ where: { id: Number(id) } });
  if (!grn) throw new Error('GRN not found');

  return prisma.$transaction(async (tx) => {
    const data = {};
    if (payload.receivedDate !== undefined) data.receivedDate = payload.receivedDate ? new Date(payload.receivedDate) : grn.receivedDate;
    if (payload.billDate !== undefined) data.billDate = payload.billDate ? new Date(payload.billDate) : null;
    if (payload.paymentType !== undefined) data.paymentType = payload.paymentType === 'installment' ? 'installment' : 'cash';
    if (payload.paymentNote !== undefined) data.paymentNote = payload.paymentNote ? String(payload.paymentNote).trim() : null;
    if (payload.supplierId !== undefined && payload.supplierId) data.supplierId = Number(payload.supplierId);

    const newQty = payload.receivedQuantity !== undefined ? Number(payload.receivedQuantity) : null;
    const newRate = payload.receivedRate !== undefined ? Number(payload.receivedRate) : null;

    if (newQty !== null && Number.isFinite(newQty) && newQty >= 0) {
      const delta = newQty - Number(grn.receivedQuantity);
      if (delta !== 0) {
        if (delta < 0) {
          const item = await tx.inventoryItem.findUnique({ where: { id: grn.itemId } });
          if (Number(item?.currentStock || 0) + delta < 0) {
            throw new Error(`Cannot reduce quantity — stock would go negative`);
          }
        }
        await tx.inventoryItem.update({
          where: { id: grn.itemId },
          data: { currentStock: { increment: delta } },
        });
        await tx.inventoryStockMovement.updateMany({
          where: { referenceType: 'GRN', referenceId: grn.code },
          data: { quantity: newQty },
        });
        data.receivedQuantity = newQty;
      }
    }

    if (newRate !== null && Number.isFinite(newRate) && newRate >= 0) {
      data.receivedRate = newRate;
    }

    const finalQty = data.receivedQuantity ?? Number(grn.receivedQuantity);
    const finalRate = data.receivedRate ?? Number(grn.receivedRate);
    if (data.receivedQuantity !== undefined || data.receivedRate !== undefined) {
      data.totalAmount = finalQty * finalRate;
    }

    return tx.inventoryGRN.update({
      where: { id: Number(id) },
      data,
      include: {
        purchaseOrder: { include: { supplier: true } },
        supplier: true,
        item: true,
      },
    });
  });
}

async function updateGIN(id, payload) {
  const gin = await prisma.inventoryGIN.findUnique({
    where: { id: Number(id) },
    include: { ginItems: true },
  });
  if (!gin) throw new Error('GIN not found');

  return prisma.$transaction(async (tx) => {
    const data = {};
    if (payload.issueDate !== undefined) data.issueDate = payload.issueDate ? new Date(payload.issueDate) : gin.issueDate;
    if (payload.issuedById !== undefined) data.issuedById = payload.issuedById ? Number(payload.issuedById) : null;
    if (payload.departmentId !== undefined && payload.departmentId) data.departmentId = Number(payload.departmentId);

    if (Array.isArray(payload.ginItems) && payload.ginItems.length > 0) {
      for (const { id: ginItemId, issuedQuantity } of payload.ginItems) {
        const newQty = Number(issuedQuantity);
        if (!Number.isFinite(newQty) || newQty < 0) continue;

        const ginItem = gin.ginItems.find((gi) => gi.id === Number(ginItemId));
        if (!ginItem) continue;

        const delta = newQty - Number(ginItem.issuedQuantity);
        if (delta === 0) continue;

        if (delta > 0) {
          const item = await tx.inventoryItem.findUnique({ where: { id: ginItem.itemId } });
          if (Number(item?.currentStock || 0) < delta) {
            throw new Error(`Insufficient stock for item (need ${delta} more but only ${item?.currentStock || 0} available)`);
          }
        }

        await tx.inventoryGINItem.update({
          where: { id: Number(ginItemId) },
          data: { issuedQuantity: newQty },
        });

        await tx.inventoryItem.update({
          where: { id: ginItem.itemId },
          data: { currentStock: { decrement: delta } },
        });

        const existingMovement = await tx.inventoryStockMovement.findFirst({
          where: { referenceType: 'GIN', referenceId: gin.code, itemId: ginItem.itemId },
        });
        if (existingMovement) {
          await tx.inventoryStockMovement.update({
            where: { id: existingMovement.id },
            data: { quantity: newQty },
          });
        } else if (newQty > 0) {
          await tx.inventoryStockMovement.create({
            data: {
              itemId: ginItem.itemId,
              movementType: 'OUT',
              quantity: newQty,
              previousStock: 0,
              newStock: 0,
              referenceType: 'GIN',
              referenceId: gin.code,
            },
          });
        }
      }
    }

    return tx.inventoryGIN.update({
      where: { id: Number(id) },
      data,
      include: {
        gdHeader: { include: { department: true } },
        department: true,
        ginItems: { include: { item: true } },
        issuedBy: { select: { id: true, firstName: true, lastName: true, empCode: true } },
      },
    });
  });
}

async function listAssetInstances({ itemId, condition } = {}) {
  const parsedItemId = parsePositiveNumber(itemId);
  return prisma.assetInstance.findMany({
    where: {
      ...(parsedItemId ? { itemId: parsedItemId } : {}),
      ...(condition ? { condition: String(condition) } : {}),
    },
    include: { item: { select: { name: true, code: true } } },
    orderBy: { assetTag: 'asc' },
  });
}

async function updateAssetInstance(id, { condition, location, serialNumber, notes }) {
  return prisma.assetInstance.update({
    where: { id: Number(id) },
    data: {
      ...(condition ? { condition: String(condition) } : {}),
      ...(location !== undefined ? { location: location || null } : {}),
      ...(serialNumber !== undefined ? { serialNumber: serialNumber || null } : {}),
      ...(notes !== undefined ? { notes: notes || null } : {}),
    },
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
      gdHeader: true,
      gins: true,
    },
    orderBy: { createdAt: 'desc' },
  });
}

async function listGDHeaders({ departmentId, status, dateFrom, dateTo, admissionNumber } = {}) {
  const parsedDepartmentId = parsePositiveNumber(departmentId);
  const admNo = admissionNumber ? String(admissionNumber).trim() : null;
  return prisma.inventoryGDHeader.findMany({
    where: {
      ...(parsedDepartmentId ? { departmentId: parsedDepartmentId } : {}),
      ...buildStatusFilter(status),
      ...(admNo ? { admissionNumber: admNo } : {}),
      ...(dateFrom || dateTo
        ? { requestDate: { ...(dateFrom ? { gte: new Date(dateFrom) } : {}), ...(dateTo ? { lte: new Date(dateTo) } : {}) } }
        : {}),
    },
    include: {
      department: true,
      gdItems: {
        include: { item: { include: { category: true, subcategory: true } } },
      },
      gins: { include: { ginItems: { include: { item: true } } } },
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

async function createGDBatch({ departmentId, items = [], admissionNumber, comment }) {
  const deptId = Number(departmentId);
  if (!Number.isFinite(deptId) || deptId <= 0) throw new Error('Invalid departmentId');
  if (!Array.isArray(items) || items.length === 0) throw new Error('items array is required');

  const department = await prisma.inventoryDepartment.findUnique({ where: { id: deptId } });
  if (!department) throw new Error('Department not found');
  if (department.status !== ACTIVE) throw new Error('Department is inactive');

  let resolvedDemandType = await prisma.inventoryDemandCategoryType.findFirst({
    where: { status: ACTIVE },
    orderBy: { createdAt: 'asc' },
  });
  if (!resolvedDemandType) {
    const generatedCode = await generateDateCode('inventoryDemandCategoryType');
    resolvedDemandType = await prisma.inventoryDemandCategoryType.create({
      data: { code: generatedCode, name: 'General', status: ACTIVE },
    });
  }

  const validatedItems = [];
  for (const entry of items) {
    const itemId = Number(entry.itemId);
    const qty = parsePositiveNumber(entry.quantityRequested);
    if (!Number.isFinite(itemId) || itemId <= 0) throw new Error(`Invalid itemId: ${entry.itemId}`);
    if (!Number.isFinite(qty) || qty <= 0) throw new Error('quantityRequested must be positive');
    const item = await prisma.inventoryItem.findUnique({ where: { id: itemId } });
    if (!item) throw new Error(`Item not found: ${itemId}`);
    validatedItems.push({ itemId, qty, location: entry.location ? String(entry.location).trim() : null });
  }

  const headerCode = await generateDocCode('inventoryGDHeader', 'gdh');
  const header = await prisma.inventoryGDHeader.create({
    data: {
      code: headerCode,
      departmentId: deptId,
      status: 'open',
      requestDate: new Date(),
      admissionNumber: admissionNumber ? String(admissionNumber).trim() : null,
      comment: comment ? String(comment).trim() : null,
    },
  });

  const gdItems = [];
  for (const { itemId, qty, location } of validatedItems) {
    const code = await generateDocCode('inventoryGD', 'gd');
    const gd = await prisma.inventoryGD.create({
      data: {
        code,
        itemId,
        departmentId: deptId,
        gdHeaderId: header.id,
        demandCategoryTypeId: resolvedDemandType.id,
        quantityRequested: qty,
        requestDate: new Date(),
        status: 'open',
        location: location || null,
      },
      include: { item: { include: { category: true, subcategory: true } } },
    });
    gdItems.push(gd);
  }

  await prisma.gdNotification.create({ data: { gdHeaderId: header.id } });

  return {
    ...header,
    department,
    gdItems,
  };
}

async function listGINs({ search, departmentId, itemId, categoryId, subcategoryId, dateFrom, dateTo, assetType, admissionNumber, issuedById }) {
  const parsedDepartmentId = parsePositiveNumber(departmentId);
  const parsedItemId = parsePositiveNumber(itemId);
  const parsedCategoryId = parsePositiveNumber(categoryId);
  const parsedSubcategoryId = parsePositiveNumber(subcategoryId);
  const parsedIssuedById = parsePositiveNumber(issuedById);
  const admNo = admissionNumber ? String(admissionNumber).trim() : null;

  // Each filter type uses OR to match either single-item GINs (gin.itemId/gin.item)
  // or multi-item GINs from GD headers (items stored in ginItems, gin.itemId is null).
  // Multiple active filters AND together so they all must match.
  const itemConditions = [];
  if (parsedItemId) itemConditions.push({ OR: [{ itemId: parsedItemId }, { ginItems: { some: { itemId: parsedItemId } } }] });
  if (parsedCategoryId) itemConditions.push({ OR: [{ item: { categoryId: parsedCategoryId } }, { ginItems: { some: { item: { categoryId: parsedCategoryId } } } }] });
  if (parsedSubcategoryId) itemConditions.push({ OR: [{ item: { subcategoryId: parsedSubcategoryId } }, { ginItems: { some: { item: { subcategoryId: parsedSubcategoryId } } } }] });
  if (assetType) itemConditions.push({ OR: [{ item: { itemType: assetType } }, { ginItems: { some: { item: { itemType: assetType } } } }] });

  return prisma.inventoryGIN.findMany({
    where: {
      ...buildSearchFilter(search, ['code']),
      ...(parsedDepartmentId ? { departmentId: parsedDepartmentId } : {}),
      ...(admNo ? { admissionNumber: admNo } : {}),
      ...(parsedIssuedById ? { issuedById: parsedIssuedById } : {}),
      ...(dateFrom || dateTo
        ? {
            issueDate: {
              ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
              ...(dateTo ? { lte: new Date(dateTo) } : {}),
            },
          }
        : {}),
      ...(itemConditions.length > 0 ? { AND: itemConditions } : {}),
    },
    include: {
      gd: true,
      gdHeader: { include: { department: true } },
      department: true,
      item: { include: { category: true, subcategory: true } },
      issuedBy: { select: { id: true, firstName: true, lastName: true, empCode: true } },
      ginItems: { include: { item: { include: { category: true, subcategory: true } }, gdItem: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

async function createGIN(payload) {
  const gdHeaderId = parsePositiveNumber(payload.gdHeaderId);

  if (gdHeaderId) {
    return createGINFromHeader({ gdHeaderId, items: payload.items, issueDate: payload.issueDate, note: payload.note, issuedById: payload.issuedById });
  }

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

  if (remainingDemand <= 0) throw new Error('GD already fulfilled');
  if (issuedQuantity > remainingDemand) throw new Error('issuedQuantity cannot exceed remaining GD quantity');

  const stock = Number(gd.item?.currentStock || 0);
  if (issuedQuantity > stock) throw new Error('Insufficient stock for issuance');

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
      data: { status: totalIssuedAfter >= Number(gd.quantityRequested) ? 'closed' : 'partial' },
    });

    return gin;
  });
}

async function createGINFromHeader({ gdHeaderId, items = [], issueDate, note, issuedById }) {
  const header = await prisma.inventoryGDHeader.findUnique({
    where: { id: gdHeaderId },
    include: {
      gdItems: { include: { item: true, gins: true } },
      department: true,
    },
  });

  if (!header) throw new Error('GD Header not found');
  if (header.status === 'closed') throw new Error('GD already fully issued');

  const itemsMap = {};
  if (Array.isArray(items) && items.length > 0) {
    for (const entry of items) {
      itemsMap[Number(entry.gdItemId)] = parsePositiveNumber(entry.issuedQuantity);
    }
  }

  const ginCode = await generateDocCode('inventoryGIN', 'gin');

  return prisma.$transaction(async (tx) => {
    const parsedIssuedById = parsePositiveNumber(issuedById);
    const gin = await tx.inventoryGIN.create({
      data: {
        code: ginCode,
        gdHeaderId: header.id,
        departmentId: header.departmentId,
        issueDate: issueDate ? new Date(issueDate) : new Date(),
        admissionNumber: header.admissionNumber || null,
        status: 'issued',
        ...(parsedIssuedById ? { issuedById: parsedIssuedById } : {}),
      },
    });

    for (const gdItem of header.gdItems) {
      const userSubmitted = Object.prototype.hasOwnProperty.call(itemsMap, gdItem.id);
      const qty = userSubmitted
        ? itemsMap[gdItem.id]
        : parsePositiveNumber(gdItem.quantityRequested - (gdItem.gins || []).reduce((s, g) => s + (Number(g.issuedQuantity) || 0), 0));

      if (qty === 0 && userSubmitted) {
        await tx.inventoryGINItem.create({
          data: { ginId: gin.id, gdItemId: gdItem.id, itemId: gdItem.itemId, issuedQuantity: 0 },
        });
        continue;
      }
      if (!qty || qty < 0) continue;

      const currentItem = await tx.inventoryItem.findUnique({ where: { id: gdItem.itemId } });
      const stock = Number(currentItem?.currentStock || 0);
      if (qty > stock) throw new Error(`Insufficient stock for item: ${gdItem.item?.name || gdItem.itemId}`);

      await tx.inventoryGINItem.create({
        data: {
          ginId: gin.id,
          gdItemId: gdItem.id,
          itemId: gdItem.itemId,
          issuedQuantity: qty,
        },
      });

      const previousStock = stock;
      const newStock = stock - qty;

      await tx.inventoryStockMovement.create({
        data: {
          itemId: gdItem.itemId,
          movementType: 'OUT',
          quantity: qty,
          previousStock,
          newStock,
          referenceType: 'GIN',
          referenceId: gin.code,
          note: note ? String(note).trim() : null,
        },
      });

      const updatedItem = await tx.inventoryItem.update({
        where: { id: gdItem.itemId },
        data: { currentStock: newStock },
      });

      await syncReorderAlert(tx, updatedItem);

      const alreadyIssued = (gdItem.gins || []).reduce((s, g) => s + (Number(g.issuedQuantity) || 0), 0);
      const totalIssued = alreadyIssued + qty;
      await tx.inventoryGD.update({
        where: { id: gdItem.id },
        data: { status: totalIssued >= Number(gdItem.quantityRequested) ? 'closed' : 'partial' },
      });
    }

    const updatedGdItems = await tx.inventoryGD.findMany({ where: { gdHeaderId: header.id } });
    const allClosed = updatedGdItems.every((g) => g.status === 'closed');
    const anyClosed = updatedGdItems.some((g) => g.status !== 'open');
    await tx.inventoryGDHeader.update({
      where: { id: header.id },
      data: { status: allClosed ? 'closed' : anyClosed ? 'partial' : 'open' },
    });

    return tx.inventoryGIN.findUnique({
      where: { id: gin.id },
      include: {
        gdHeader: { include: { department: true } },
        ginItems: { include: { item: true, gdItem: true } },
        department: true,
        issuedBy: { select: { id: true, firstName: true, lastName: true, empCode: true } },
      },
    });
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
        customerName: (customerType === 'customer' || customerType === 'admission') ? customerName : 'Walking Customer',
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

async function listSalesInvoiceHeaders({ search, customerType, dateFrom, dateTo }) {
  const normalizedCustomerType = customerType ? normalizeCustomerType(customerType) : null;

  return prisma.inventorySalesInvoiceHeader.findMany({
    where: {
      ...buildSearchFilter(search, ['code', 'customerName']),
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
      items: {
        include: {
          item: { include: { category: true, subcategory: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

async function createSalesInvoiceWithItems(payload) {
  const customerType = normalizeCustomerType(payload.customerType);
  const customerName = payload.customerName ? String(payload.customerName).trim() : '';
  const invoiceDate = payload.invoiceDate ? new Date(payload.invoiceDate) : new Date();
  const lineItems = Array.isArray(payload.items) ? payload.items : [];

  if (lineItems.length === 0) throw new Error('At least one item is required');

  if ((customerType === 'customer' || customerType === 'admission') && !customerName) {
    throw new Error('customerName is required when customerType is customer or admission');
  }

  const discountPercent = Math.min(100, Math.max(0, Number(payload.discountPercent || 0)));

  return prisma.$transaction(async (tx) => {
    const headerCode = await generateDocCode('inventorySalesInvoiceHeader', 'sinv');
    let subTotal = 0;
    const createdLines = [];

    for (let i = 0; i < lineItems.length; i++) {
      const line = lineItems[i];
      const itemId = Number(line.itemId);
      const quantity = parsePositiveNumber(line.quantity);

      if (!Number.isFinite(quantity) || quantity <= 0) {
        throw new Error(`Item ${i + 1}: quantity must be a positive number`);
      }

      const item = await tx.inventoryItem.findUnique({
        where: { id: itemId },
        include: { category: true, subcategory: true },
      });

      if (!item) throw new Error(`Item ${i + 1}: not found`);
      if (item.status !== ACTIVE) throw new Error(`Item ${i + 1}: ${item.name} is inactive`);

      // Admission-billing lines were already deducted from stock when their GIN
      // was issued — this invoice is billing-only for those, not a fresh sale,
      // so it must not re-check or re-deduct stock a second time.
      const stock = Number(item.currentStock || 0);
      if (customerType !== 'admission' && quantity > stock) {
        throw new Error(`Item ${i + 1}: insufficient stock for ${item.name} (available: ${stock})`);
      }

      const purchasePrice = Number(item.purchasePrice || 0);
      const retailPrice = Number(item.lastGrnRate || item.purchasePrice || 0);
      const saleRate = line.saleRate != null ? Number(line.saleRate) : retailPrice;
      const totalAmount = saleRate * quantity;
      subTotal += totalAmount;

      createdLines.push({
        itemId,
        quantity,
        purchasePrice,
        retailPrice,
        markupPercent: 0,
        saleRate,
        totalAmount,
        item,
      });
    }

    const discountAmount = subTotal * (discountPercent / 100);
    const grandTotal = subTotal - discountAmount;

    const header = await tx.inventorySalesInvoiceHeader.create({
      data: {
        code: headerCode,
        invoiceDate,
        customerType,
        customerName: (customerType === 'customer' || customerType === 'admission') ? customerName : 'Walking Customer',
        subTotal,
        discountPercent,
        discountAmount,
        totalAmount: grandTotal,
      },
    });

    const invoiceLines = [];
    for (let i = 0; i < createdLines.length; i++) {
      const line = createdLines[i];
      const lineCode = `${headerCode}-${padTwo(i + 1)}`;

      const invoice = await tx.inventorySalesInvoice.create({
        data: {
          code: lineCode,
          headerId: header.id,
          itemId: line.itemId,
          invoiceDate,
          customerType,
          customerName: (customerType === 'customer' || customerType === 'admission') ? customerName : 'Walking Customer',
          quantity: line.quantity,
          purchasePrice: line.purchasePrice,
          retailPrice: line.retailPrice,
          markupPercent: line.markupPercent,
          saleRate: line.saleRate,
          totalAmount: line.totalAmount,
        },
        include: {
          item: { include: { category: true, subcategory: true } },
        },
      });

      invoiceLines.push(invoice);

      // Admission-billing lines: stock already left the store at GIN-issue time
      // — this invoice must not move stock again (see the guard above).
      if (customerType !== 'admission') {
        const newStock = Number(line.item.currentStock || 0) - line.quantity;
        await tx.inventoryStockMovement.create({
          data: {
            itemId: line.itemId,
            movementType: 'OUT',
            quantity: line.quantity,
            unitRate: line.saleRate,
            previousStock: Number(line.item.currentStock || 0),
            newStock,
            referenceType: 'SALES_INVOICE',
            referenceId: lineCode,
            note: `Sales invoice for ${customerType}`,
          },
        });

        const updatedItem = await tx.inventoryItem.update({
          where: { id: line.itemId },
          data: { currentStock: newStock },
        });

        await syncReorderAlert(tx, updatedItem);
      }
    }

    return { ...header, items: invoiceLines };
  });
}

async function listGDNs({ search, itemId, categoryId, subcategoryId, dateFrom, dateTo, assetType }) {
  const parsedItemId = parsePositiveNumber(itemId);
  const parsedCategoryId = parsePositiveNumber(categoryId);
  const parsedSubcategoryId = parsePositiveNumber(subcategoryId);

  const rows = await prisma.inventoryGDN.findMany({
    where: {
      ...buildSearchFilter(search, ['code', 'reason']),
      ...(parsedItemId ? { itemId: parsedItemId } : {}),
      ...(parsedCategoryId ? { item: { categoryId: parsedCategoryId } } : {}),
      ...(parsedSubcategoryId ? { item: { subcategoryId: parsedSubcategoryId } } : {}),
      ...(assetType ? { item: { itemType: assetType } } : {}),
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
        scrapValue: payload.scrapValue != null && payload.scrapValue !== '' ? Number(payload.scrapValue) : null,
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

  // Duplicate check: fixed asset → name + model must be unique; current asset → name alone
  const model = parseOptionalString(payload.model);
  if (itemType === 'fixed asset') {
    if (!model) throw new Error('Model is required for fixed assets');
    const duplicateItem = await prisma.inventoryItem.findFirst({
      where: {
        name: { equals: name, mode: 'insensitive' },
        model: { equals: model, mode: 'insensitive' },
      },
      select: { id: true },
    });
    if (duplicateItem) throw new Error('A fixed asset with the same name and model already exists');
  } else {
    const duplicateItem = await prisma.inventoryItem.findFirst({
      where: { name: { equals: name, mode: 'insensitive' } },
      select: { id: true },
    });
    if (duplicateItem) throw new Error('Item with this name already exists');
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
          comment: parseOptionalString(payload.comment),
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

  await syncReorderAlert(prisma, created);

  const openingQty = parsePositiveNumber(payload.currentStock, 0) || 0;
  if (openingQty > 0) {
    const openingRate = Number(purchasePrice || 0);
    // Guard against duplicate OPENING movements (race condition / double-submit)
    await prisma.inventoryStockMovement.deleteMany({
      where: { itemId: created.id, referenceType: 'OPENING' },
    });
    await prisma.inventoryStockMovement.create({
      data: {
        itemId: created.id,
        movementType: 'OPENING',
        referenceType: 'OPENING',
        quantity: openingQty,
        unitRate: openingRate,
        previousStock: 0,
        newStock: openingQty,
        note: 'Opening stock on item creation',
      },
    });

    if (created.itemType === 'fixed asset') {
      const count = Math.floor(openingQty);
      const instanceData = [];
      for (let i = 0; i < count; i++) {
        instanceData.push({
          assetTag: `${created.code}-${String(i + 1).padStart(2, '0')}`,
          itemId: created.id,
          condition: 'working',
        });
      }
      if (instanceData.length > 0) {
        await prisma.assetInstance.createMany({ data: instanceData });
      }
    }
  }

  return created;
}

async function updateItem(itemId, payload) {
  const id = Number(itemId);
  const existing = await prisma.inventoryItem.findUnique({ where: { id } });
  if (!existing) throw new Error('Item not found');

  const name = String(payload.name || '').trim();
  const status = normalizeStatus(payload.status);
  const itemType = String(payload.itemType || '').trim().toLowerCase();
  const usefulLifeUnit = String(payload.usefulLifeUnit || 'years').trim().toLowerCase();
  const assetConditionRaw = String(payload.assetCondition || '').trim().toLowerCase();
  const assetCondition = assetConditionRaw || 'working';
  const parsedSupplierId = parsePositiveNumber(payload.supplierId);
  const reorderLevel = parsePositiveNumber(payload.reorderLevel, 0);
  const hasExpiry = Boolean(payload.hasExpiry);
  const usefulLifeYears = parsePositiveNumber(payload.usefulLifeYears);
  const bookValue = parsePositiveNumber(payload.bookValue);

  const model = parseOptionalString(payload.model);
  if (itemType === 'fixed asset') {
    if (!model) throw new Error('Model is required for fixed assets');
    const duplicate = await prisma.inventoryItem.findFirst({
      where: {
        name: { equals: name, mode: 'insensitive' },
        model: { equals: model, mode: 'insensitive' },
        id: { not: id },
      },
      select: { id: true },
    });
    if (duplicate) throw new Error('A fixed asset with the same name and model already exists');
  } else if (name !== existing.name) {
    const duplicate = await prisma.inventoryItem.findFirst({
      where: { name: { equals: name, mode: 'insensitive' }, id: { not: id } },
      select: { id: true },
    });
    if (duplicate) throw new Error('Item with this name already exists');
  }

  const purchasePrice = parsePositiveNumber(payload.purchasePrice) ?? existing.purchasePrice;

  // Handle opening stock change: skip if currentStock not provided in payload
  const openingStockProvided = payload.currentStock !== undefined && payload.currentStock !== null;
  const newOpeningQty = openingStockProvided ? (parsePositiveNumber(payload.currentStock) || 0) : null;
  const existingOpeningMovement = openingStockProvided
    ? await prisma.inventoryStockMovement.findFirst({ where: { itemId: id, referenceType: 'OPENING' } })
    : null;
  const oldOpeningQty = existingOpeningMovement ? Number(existingOpeningMovement.quantity || 0) : 0;
  const openingDelta = openingStockProvided ? (newOpeningQty - oldOpeningQty) : 0;

  if (openingDelta !== 0 && existingOpeningMovement) {
    throw new Error('Opening stock cannot be changed once it has already been set');
  }

  const updated = await prisma.inventoryItem.update({
    where: { id },
    data: {
      name,
      itemType,
      unit: String(payload.unit || '').trim().toLowerCase(),
      purchasePrice,
      hasExpiry,
      reorderLevel: reorderLevel || 0,
      status,
      brand: parseOptionalString(payload.brand),
      model: parseOptionalString(payload.model),
      serialNumber: parseOptionalString(payload.serialNumber),
      assetLocation: parseOptionalString(payload.assetLocation),
      purchaseDate: parseOptionalDate(payload.purchaseDate),
      warrantyUntil: parseOptionalDate(payload.warrantyUntil),
      usefulLifeYears: Number.isFinite(usefulLifeYears) && usefulLifeYears > 0 ? Math.round(usefulLifeYears) : null,
      assetCondition,
      bookValue: Number.isFinite(bookValue) ? bookValue : null,
      comment: parseOptionalString(payload.comment),
      categoryId: Number(payload.categoryId),
      subcategoryId: Number(payload.subcategoryId),
      supplierId: parsedSupplierId || null,
      storageId: parsePositiveNumber(payload.storageId),
      ...(openingDelta !== 0 && { currentStock: Math.max(0, Number(existing.currentStock || 0) + openingDelta) }),
    },
    include: { category: true, subcategory: true, storage: true },
  });

  // Sync OPENING stock movement if changed
  if (openingDelta !== 0) {
    if (existingOpeningMovement) {
      await prisma.inventoryStockMovement.delete({ where: { id: existingOpeningMovement.id } });
    }
    if (newOpeningQty !== null && newOpeningQty > 0) {
      await prisma.inventoryStockMovement.create({
        data: {
          itemId: id,
          movementType: 'OPENING',
          referenceType: 'OPENING',
          quantity: newOpeningQty,
          unitRate: purchasePrice,
          previousStock: 0,
          newStock: newOpeningQty,
          note: 'Opening stock updated via item edit',
        },
      });
    }

    // Sync AssetInstance records for fixed assets
    if (updated.itemType === 'fixed asset') {
      // Only touch instances that came from opening stock (no grnId)
      const openingInstances = await prisma.assetInstance.findMany({
        where: { itemId: id, grnId: null },
        select: { id: true, assetTag: true },
        orderBy: { id: 'asc' },
      });

      if (openingDelta > 0) {
        // Add new instances
        const allTags = await prisma.assetInstance.findMany({
          where: { itemId: id },
          select: { assetTag: true },
        });
        let nextSeq = 1;
        if (allTags.length > 0) {
          const maxSeq = allTags.reduce((max, inst) => {
            const parts = String(inst.assetTag).split('-');
            const tail = Number(parts[parts.length - 1]);
            return Number.isFinite(tail) && tail > max ? tail : max;
          }, 0);
          if (maxSeq > 0) nextSeq = maxSeq + 1;
        }
        const newInstances = [];
        for (let i = 0; i < openingDelta; i++) {
          newInstances.push({
            assetTag: `${updated.code}-${String(nextSeq + i).padStart(2, '0')}`,
            itemId: id,
            condition: 'working',
          });
        }
        if (newInstances.length > 0) await prisma.assetInstance.createMany({ data: newInstances });
      } else if (openingDelta < 0) {
        // Remove excess opening instances (from the end)
        const toRemove = openingInstances.slice(openingDelta); // last N
        if (toRemove.length > 0) {
          await prisma.assetInstance.deleteMany({ where: { id: { in: toRemove.map((i) => i.id) } } });
        }
      }
    }
  }

  try {
    await ensureUsefulLifeUnitColumn();
    await prisma.$executeRaw`UPDATE "InventoryItem" SET "usefulLifeUnit" = ${usefulLifeUnit} WHERE "id" = ${updated.id}`;
  } catch { /* non-blocking */ }

  await syncReorderAlert(prisma, updated);

  return updated;
}

async function updateCategory(id, payload) {
  const existing = await prisma.inventoryCategory.findUnique({ where: { id: Number(id) } });
  if (!existing) throw new Error('Category not found');
  return prisma.inventoryCategory.update({
    where: { id: Number(id) },
    data: {
      name: String(payload.name || '').trim(),
      status: normalizeStatus(payload.status),
    },
  });
}

async function deleteCategory(id) {
  const numId = Number(id);
  const existing = await prisma.inventoryCategory.findUnique({ where: { id: numId } });
  if (!existing) throw new Error('Category not found');
  const itemCount = await prisma.inventoryItem.count({ where: { categoryId: numId } });
  if (itemCount > 0) throw new Error('Category has items and cannot be deleted. Set status to inactive instead.');
  await prisma.inventorySubcategory.deleteMany({ where: { categoryId: numId } });
  await prisma.inventoryCategory.delete({ where: { id: numId } });
  return { id: numId, deleted: true };
}

async function updateSubcategory(id, payload) {
  const existing = await prisma.inventorySubcategory.findUnique({ where: { id: Number(id) } });
  if (!existing) throw new Error('Subcategory not found');
  return prisma.inventorySubcategory.update({
    where: { id: Number(id) },
    data: {
      name: String(payload.name || '').trim(),
      status: normalizeStatus(payload.status),
      categoryId: Number(payload.categoryId),
    },
    include: { category: true },
  });
}

async function deleteSubcategory(id) {
  const numId = Number(id);
  const existing = await prisma.inventorySubcategory.findUnique({ where: { id: numId } });
  if (!existing) throw new Error('Subcategory not found');
  const itemCount = await prisma.inventoryItem.count({ where: { subcategoryId: numId } });
  if (itemCount > 0) throw new Error('Subcategory has items and cannot be deleted. Set status to inactive instead.');
  await prisma.inventorySubcategory.delete({ where: { id: numId } });
  return { id: numId, deleted: true };
}

async function updateSupplier(id, payload) {
  const existing = await prisma.inventorySupplier.findUnique({ where: { id: Number(id) } });
  if (!existing) throw new Error('Supplier not found');
  return prisma.inventorySupplier.update({
    where: { id: Number(id) },
    data: {
      name: String(payload.name || '').trim(),
      address: payload.address ? String(payload.address).trim() : null,
      contactDetails: payload.contactDetails ? String(payload.contactDetails).trim() : null,
      bankingDetails: payload.bankingDetails ? String(payload.bankingDetails).trim() : null,
      status: normalizeStatus(payload.status),
    },
  });
}

async function deleteSupplier(id) {
  const numId = Number(id);
  const existing = await prisma.inventorySupplier.findUnique({ where: { id: numId } });
  if (!existing) throw new Error('Supplier not found');
  const [itemCount, poCount, grnCount] = await Promise.all([
    prisma.inventoryItem.count({ where: { supplierId: numId } }),
    prisma.inventoryPurchaseOrder.count({ where: { supplierId: numId } }),
    prisma.inventoryGRN.count({ where: { supplierId: numId } }),
  ]);
  if (itemCount > 0 || poCount > 0 || grnCount > 0) throw new Error('Supplier has linked records and cannot be deleted. Set status to inactive instead.');
  await prisma.inventorySupplier.delete({ where: { id: numId } });
  return { id: numId, deleted: true };
}

async function updateStorage(id, payload) {
  const existing = await prisma.inventoryStorage.findUnique({ where: { id: Number(id) } });
  if (!existing) throw new Error('Storage not found');
  return prisma.inventoryStorage.update({
    where: { id: Number(id) },
    data: {
      name: String(payload.name || '').trim(),
      numberAllotment: payload.numberAllotment ? String(payload.numberAllotment).trim() : null,
      status: normalizeStatus(payload.status),
    },
  });
}

async function deleteStorage(id) {
  const numId = Number(id);
  const existing = await prisma.inventoryStorage.findUnique({ where: { id: numId } });
  if (!existing) throw new Error('Storage not found');
  const itemCount = await prisma.inventoryItem.count({ where: { storageId: numId } });
  if (itemCount > 0) throw new Error('Storage has items and cannot be deleted. Set status to inactive instead.');
  await prisma.inventoryStorage.delete({ where: { id: numId } });
  return { id: numId, deleted: true };
}

async function updateDepartment(id, payload) {
  const existing = await prisma.inventoryDepartment.findUnique({ where: { id: Number(id) } });
  if (!existing) throw new Error('Department not found');
  return prisma.inventoryDepartment.update({
    where: { id: Number(id) },
    data: {
      name: String(payload.name || '').trim(),
      status: normalizeStatus(payload.status),
    },
  });
}

async function deleteDepartment(id) {
  const numId = Number(id);
  const existing = await prisma.inventoryDepartment.findUnique({ where: { id: numId } });
  if (!existing) throw new Error('Department not found');
  const [gdCount, ginCount] = await Promise.all([
    prisma.inventoryGD.count({ where: { departmentId: numId } }),
    prisma.inventoryGIN.count({ where: { departmentId: numId } }),
  ]);
  if (gdCount > 0 || ginCount > 0) throw new Error('Department has linked records and cannot be deleted. Set status to inactive instead.');
  await prisma.inventoryDepartment.delete({ where: { id: numId } });
  return { id: numId, deleted: true };
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

async function listOpenReorderAlerts({ assetType } = {}) {
  return prisma.inventoryReorderAlert.findMany({
    where: {
      status: 'open',
      ...(assetType ? { item: { itemType: assetType } } : {}),
    },
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
  if (type === 'OPENING') return qty;

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

async function listItemLedgerReport({ dateFrom, dateTo, itemId, categoryId, subcategoryId, assetType, departmentId }) {
  const parsedItemId = parsePositiveNumber(itemId);
  const parsedCategoryId = parsePositiveNumber(categoryId);
  const parsedSubcategoryId = parsePositiveNumber(subcategoryId);
  const parsedDepartmentId = parsePositiveNumber(departmentId);

  const fromDate = toStartOfDay(dateFrom);
  const toDate = toEndOfDay(dateTo);

  const items = await prisma.inventoryItem.findMany({
    where: {
      ...(parsedItemId ? { id: parsedItemId } : {}),
      ...(parsedCategoryId ? { categoryId: parsedCategoryId } : {}),
      ...(parsedSubcategoryId ? { subcategoryId: parsedSubcategoryId } : {}),
      ...(assetType ? { itemType: assetType } : {}),
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
          select: { code: true, issueDate: true, departmentId: true, department: { select: { name: true } } },
        })
      : Promise.resolve([]),
  ]);

  const grnDateByCode = new Map(grns.map((row) => [row.code, row.receivedDate]));
  const ginDateByCode = new Map(gins.map((row) => [row.code, row.issueDate]));
  const ginDeptByCode = new Map(gins.map((row) => [row.code, { id: row.departmentId, name: row.department?.name || null }]));

  const normalizedMovements = stockMovements
    .map((movement) => {
      const referenceType = String(movement.referenceType || '').trim().toUpperCase();
      const referenceId = movement.referenceId ? String(movement.referenceId) : null;
      const delta = resolveMovementDelta(movement);

      let eventDate = movement.createdAt;
      if (referenceType === 'OPENING' || movement.movementType?.toUpperCase() === 'OPENING') {
        eventDate = new Date(0); // epoch — always process first
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
      return true;
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

    const isOpeningMovement = movement.referenceType === 'OPENING' || String(movement.movementType || '').toUpperCase() === 'OPENING';
    const isBeforeRange = isOpeningMovement || (Boolean(fromDate) && new Date(movement.eventDate) < fromDate);
    const isAfterRange = !isOpeningMovement && Boolean(toDate) && new Date(movement.eventDate) > toDate;

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
      date: (movement.referenceType === 'OPENING' || movement.movementType?.toUpperCase() === 'OPENING')
        ? null
        : new Date(movement.eventDate).toISOString(),
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
      departmentName: (!isInbound && movement.referenceType === 'GIN' && movement.referenceId)
        ? (ginDeptByCode.get(movement.referenceId)?.name || null)
        : null,
      departmentId: (!isInbound && movement.referenceType === 'GIN' && movement.referenceId)
        ? (ginDeptByCode.get(movement.referenceId)?.id || null)
        : null,
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

  // Items with only opening stock (no transactions in date range) — include them too
  for (const [id, opening] of openingByItemId.entries()) {
    if (groupsMap.has(id)) continue;
    if (!opening.quantity || opening.quantity <= 0) continue;
    const item = itemById.get(id);
    if (!item) continue;
    const { baseUnit } = getBaseUnitAndQuantity(item.unit, 1);
    groupsMap.set(id, {
      itemId: id,
      itemCode: item.code,
      itemName: item.name,
      category: item.category?.name || '-',
      subcategory: item.subcategory?.name || '-',
      baseUnit,
      openingBalance: opening.quantity,
      openingAmount: opening.amount || 0,
      rows: [],
    });
  }

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

  const filteredGroups = parsedDepartmentId
    ? groups
        .map((group) => {
          const deptRows = group.rows.filter((row) => row.departmentId === parsedDepartmentId);
          if (deptRows.length === 0) return null;
          const totalIssued = deptRows.reduce((sum, r) => sum + (Number(r.issuanceQuantity) || 0), 0);
          const totalIssuedAmount = deptRows.reduce((sum, r) => sum + (Number(r.issuanceAmount) || 0), 0);
          return { ...group, rows: deptRows, totalReceived: 0, totalReceivedAmount: 0, totalIssued, totalIssuedAmount };
        })
        .filter(Boolean)
    : groups;

  const summary = filteredGroups.reduce((acc, group) => {
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
    groups: filteredGroups,
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
  assetType,
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
      ...(assetType ? { itemType: assetType } : {}),
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

async function listStockPositionReport({ asOfDate, categoryId, subcategoryId, assetType, brand, location, itemId }) {
  const parsedCategoryId = parsePositiveNumber(categoryId);
  const parsedSubcategoryId = parsePositiveNumber(subcategoryId);
  const parsedItemId = parsePositiveNumber(itemId);
  const brandFilter = brand ? String(brand).trim() : null;
  const locationFilter = location ? String(location).trim() : null;

  // Set asOfDate to end of day if provided, else use today
  const snapshotDate = asOfDate ? toEndOfDay(asOfDate) : toEndOfDay(new Date());

  // Fetch all items matching filters
  const items = await prisma.inventoryItem.findMany({
    where: {
      ...(parsedItemId ? { id: parsedItemId } : {}),
      ...(parsedCategoryId ? { categoryId: parsedCategoryId } : {}),
      ...(parsedSubcategoryId ? { subcategoryId: parsedSubcategoryId } : {}),
      ...(assetType ? { itemType: assetType } : {}),
      ...(brandFilter ? { brand: { equals: brandFilter, mode: 'insensitive' } } : {}),
      ...(locationFilter ? { assetLocation: { equals: locationFilter, mode: 'insensitive' } } : {}),
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
      if (referenceType === 'OPENING' || movement.movementType?.toUpperCase() === 'OPENING') {
        eventDate = new Date(0); // epoch — always process first
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
      return true;
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
      brand: item.brand || '-',
      location: item.assetLocation || '-',
      itemType: item.itemType || '-',
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

async function listUnreadGdNotifications() {
  return prisma.gdNotification.findMany({
    where: { isRead: false },
    include: {
      gdHeader: {
        include: { department: true, gdItems: { include: { item: true } } },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

async function markGdNotificationsRead(ids) {
  if (Array.isArray(ids) && ids.length > 0) {
    await prisma.gdNotification.updateMany({ where: { id: { in: ids } }, data: { isRead: true } });
  } else {
    await prisma.gdNotification.updateMany({ where: { isRead: false }, data: { isRead: true } });
  }
}

async function resyncAllItemCurrentStock() {
  const items = await prisma.inventoryItem.findMany({ select: { id: true } });

  for (const item of items) {
    const movements = await prisma.inventoryStockMovement.findMany({
      where: { itemId: item.id },
      select: { movementType: true, quantity: true, previousStock: true, newStock: true },
    });

    let stock = 0;
    for (const m of movements) {
      stock += resolveMovementDelta(m);
    }

    await prisma.inventoryItem.update({
      where: { id: item.id },
      data: { currentStock: Math.max(0, stock) },
    });
  }

  return { synced: items.length };
}

// ─── MRN — Material Return Note ───────────────────────────────────────────────

async function listMRNs({ search = '', departmentId = '', ginId = '', dateFrom = '', dateTo = '' } = {}) {
  const where = {};
  if (departmentId && Number(departmentId) > 0) where.departmentId = Number(departmentId);
  if (ginId && Number(ginId) > 0) where.ginId = Number(ginId);
  if (dateFrom || dateTo) {
    where.returnDate = {};
    if (dateFrom) where.returnDate.gte = new Date(dateFrom);
    if (dateTo) where.returnDate.lte = new Date(dateTo + 'T23:59:59');
  }
  if (search) {
    where.OR = [
      { code: { contains: search, mode: 'insensitive' } },
      { receivedBy: { contains: search, mode: 'insensitive' } },
    ];
  }

  return prisma.inventoryMRN.findMany({
    where,
    orderBy: { returnDate: 'desc' },
    include: {
      gin: { select: { id: true, code: true, issueDate: true } },
      department: { select: { id: true, name: true } },
      mrnItems: {
        include: {
          item: { select: { id: true, code: true, name: true, unit: true } },
        },
      },
    },
  });
}

async function createMRN({ ginId, returnDate, receivedBy, notes, items = [] }) {
  if (!ginId) throw new Error('GIN is required');
  if (!Array.isArray(items) || items.length === 0) throw new Error('At least one item is required');

  const gin = await prisma.inventoryGIN.findUnique({
    where: { id: Number(ginId) },
    include: {
      ginItems: { include: { item: { select: { id: true, name: true, currentStock: true } } } },
      department: true,
    },
  });
  if (!gin) throw new Error('GIN not found');

  // Total issued per item in this GIN
  const issuedMap = {};   // itemId → issued qty
  const ginItemMap = {};  // itemId → ginItemId (for FK link)
  for (const gi of gin.ginItems) {
    issuedMap[gi.itemId] = (issuedMap[gi.itemId] || 0) + Number(gi.issuedQuantity || 0);
    ginItemMap[gi.itemId] = gi.id;
  }

  // Already returned for this GIN (from previous MRNs)
  const prevMRNs = await prisma.inventoryMRN.findMany({
    where: { ginId: gin.id },
    include: { mrnItems: { select: { itemId: true, returnedQty: true } } },
  });
  const alreadyReturned = {};
  for (const m of prevMRNs) {
    for (const mi of m.mrnItems) {
      alreadyReturned[mi.itemId] = (alreadyReturned[mi.itemId] || 0) + Number(mi.returnedQty || 0);
    }
  }

  const mrnCode = await generateDocCode('inventoryMRN', 'mrn');

  return prisma.$transaction(async (tx) => {
    const mrn = await tx.inventoryMRN.create({
      data: {
        code: mrnCode,
        ginId: gin.id,
        departmentId: gin.departmentId,
        returnDate: returnDate ? new Date(returnDate) : new Date(),
        receivedBy: receivedBy ? String(receivedBy).trim() : null,
        notes: notes ? String(notes).trim() : null,
      },
    });

    for (const entry of items) {
      const itemId = Number(entry.itemId);
      const qty = parsePositiveNumber(entry.returnedQty);
      if (!qty || qty <= 0) continue;

      const maxReturnable = (issuedMap[itemId] || 0) - (alreadyReturned[itemId] || 0);
      if (qty > maxReturnable + 0.0001) {
        // find item name for error message
        const foundGi = gin.ginItems.find((gi) => gi.itemId === itemId);
        const itemName = foundGi?.item?.name || String(itemId);
        throw new Error(`"${itemName}": wapas ${qty} nahi ho sakta, sirf ${maxReturnable.toFixed(2)} returnable hai`);
      }

      await tx.inventoryMRNItem.create({
        data: {
          mrnId: mrn.id,
          itemId,
          ginItemId: ginItemMap[itemId] || null,
          returnedQty: qty,
        },
      });

      const currentItem = await tx.inventoryItem.findUnique({ where: { id: itemId } });
      const previousStock = Number(currentItem?.currentStock || 0);
      const newStock = previousStock + qty;

      await tx.inventoryStockMovement.create({
        data: {
          itemId,
          movementType: 'IN',
          quantity: qty,
          previousStock,
          newStock,
          referenceType: 'MRN',
          referenceId: mrn.code,
          note: notes ? String(notes).trim() : null,
        },
      });

      const updatedItem = await tx.inventoryItem.update({
        where: { id: itemId },
        data: { currentStock: newStock },
      });

      await syncReorderAlert(tx, updatedItem);
    }

    return tx.inventoryMRN.findUnique({
      where: { id: mrn.id },
      include: {
        gin: { select: { id: true, code: true, issueDate: true } },
        department: { select: { id: true, name: true } },
        mrnItems: {
          include: {
            item: { select: { id: true, code: true, name: true, unit: true } },
          },
        },
      },
    });
  });
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
  updateItem,
  updateItemStatus,
  deleteItem,
  updateCategory,
  deleteCategory,
  updateSubcategory,
  deleteSubcategory,
  updateSupplier,
  deleteSupplier,
  updateStorage,
  deleteStorage,
  updateDepartment,
  deleteDepartment,
  listPurchaseOrders,
  createPurchaseOrder,
  listGRNs,
  createGRN,
  updateGRN,
  listGDs,
  createGD,
  createGDBatch,
  listGDHeaders,
  listGINs,
  createGIN,
  updateGIN,
  listSalesInvoices,
  createSalesInvoice,
  listSalesInvoiceHeaders,
  createSalesInvoiceWithItems,
  listGDNs,
  createGDN,
  addStockMovement,
  listOpenReorderAlerts,
  listItemAddOptions,
  listItemLedgerReport,
  listDailySalesReport,
  listSupplierLedgerReport,
  listStockPositionReport,
  listShortExpiryReport,
  listExpiredItemsReport,
  listMaintenances,
  createMaintenance,
  receiveMaintenance,
  listAssetInstances,
  updateAssetInstance,
  listUnreadGdNotifications,
  markGdNotificationsRead,
  resyncAllItemCurrentStock,
  listMRNs,
  createMRN,
};

async function listMaintenances({ itemId, supplierId, categoryId, subcategoryId, dateFrom, dateTo, assetType } = {}) {
  const where = {};

  if (itemId && Number(itemId) > 0) where.itemId = Number(itemId);
  if (supplierId && Number(supplierId) > 0) where.supplierId = Number(supplierId);

  if (dateFrom || dateTo) {
    where.date = {};
    if (dateFrom) where.date.gte = new Date(dateFrom);
    if (dateTo) where.date.lte = new Date(dateTo);
  }

  if (categoryId && Number(categoryId) > 0) {
    where.item = { ...where.item, categoryId: Number(categoryId) };
  }
  if (subcategoryId && Number(subcategoryId) > 0) {
    where.item = { ...where.item, subcategoryId: Number(subcategoryId) };
  }
  if (assetType) {
    where.item = { ...where.item, itemType: assetType };
  }

  return prisma.inventoryMaintenance.findMany({
    where,
    include: {
      item: { include: { category: true, subcategory: true } },
      supplier: true,
      employee: { select: { id: true, firstName: true, lastName: true, empCode: true } },
      assetInstances: { select: { id: true, assetTag: true, condition: true } },
    },
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
  });
}

async function generateMoNumber(date) {
  const d = date ? new Date(date) : new Date();
  const dateStr =
    d.getFullYear().toString() +
    String(d.getMonth() + 1).padStart(2, '0') +
    String(d.getDate()).padStart(2, '0');

  // Try plain date first, then append -02, -03 etc. if already taken
  const existing = await prisma.inventoryMaintenance.findMany({
    where: { moNumber: { startsWith: dateStr } },
    select: { moNumber: true },
  });

  if (existing.length === 0) return dateStr;
  return `${dateStr}-${String(existing.length + 1).padStart(2, '0')}`;
}

async function createMaintenance({ itemId, supplierId, employeeId, natureOfRepair, cost, date, assetInstanceIds, printedBy, generatedAt }) {
  const instanceIds = Array.isArray(assetInstanceIds) ? assetInstanceIds.map(Number).filter(Boolean) : [];
  const moNumber = await generateMoNumber(date);

  const record = await prisma.inventoryMaintenance.create({
    data: {
      moNumber,
      itemId: Number(itemId),
      supplierId: Number(supplierId),
      employeeId: employeeId ? Number(employeeId) : null,
      natureOfRepair: String(natureOfRepair).trim(),
      cost: cost != null && cost !== '' ? Number(cost) : null,
      date: new Date(date),
      status: 'in_repair',
      printedBy: printedBy ? String(printedBy).trim() : null,
      generatedAt: generatedAt ? new Date(generatedAt) : null,
    },
    include: {
      item: { include: { category: true, subcategory: true } },
      supplier: true,
      employee: { select: { id: true, firstName: true, lastName: true, empCode: true } },
      assetInstances: { select: { id: true, assetTag: true, condition: true } },
      gdns: true,
    },
  });

  if (instanceIds.length > 0) {
    await prisma.assetInstance.updateMany({
      where: { id: { in: instanceIds } },
      data: { condition: 'under repair', maintenanceId: record.id },
    });
  }

  return record;
}

async function receiveMaintenance({ id, receivedDate, checkedBy, action, scrapValue, actualCost, warrantyDays }) {
  const maintenanceId = Number(id);
  if (!maintenanceId) throw new Error('Invalid maintenance id');

  const existing = await prisma.inventoryMaintenance.findUnique({
    where: { id: maintenanceId },
    include: {
      item: true,
      assetInstances: { select: { id: true, assetTag: true } },
    },
  });

  if (!existing) throw new Error('Maintenance record not found');
  if (existing.status !== 'in_repair') throw new Error('Record is not in repair status');

  if (action === 'complete') {
    // Mark as completed — asset instances go back to working
    const updated = await prisma.inventoryMaintenance.update({
      where: { id: maintenanceId },
      data: {
        status: 'completed',
        receivedDate: receivedDate ? new Date(receivedDate) : new Date(),
        checkedBy: checkedBy ? String(checkedBy).trim() : null,
        actualCost: actualCost != null && actualCost !== '' ? Number(actualCost) : null,
        warrantyDays: warrantyDays != null && warrantyDays !== '' ? Number(warrantyDays) : null,
      },
      include: {
        item: { include: { category: true, subcategory: true } },
        supplier: true,
        employee: { select: { id: true, firstName: true, lastName: true, empCode: true } },
        assetInstances: { select: { id: true, assetTag: true, condition: true } },
        gdns: true,
      },
    });

    if (existing.assetInstances.length > 0) {
      await prisma.assetInstance.updateMany({
        where: { maintenanceId },
        data: { condition: 'working' },
      });
    }

    return updated;
  }

  if (action === 'discard') {
    // Mark as discarded — create GDN with scrap value
    const gdnCode = await generateDocCode('inventoryGDN', 'gdn');
    const instanceTags = existing.assetInstances.map((a) => a.assetTag).join(', ');
    const gdnReason = `Discarded after repair — MO: ${existing.moNumber || existing.id}${instanceTags ? ` | Assets: ${instanceTags}` : ''}`;

    return prisma.$transaction(async (tx) => {
      const updated = await tx.inventoryMaintenance.update({
        where: { id: maintenanceId },
        data: {
          status: 'discarded',
          receivedDate: receivedDate ? new Date(receivedDate) : new Date(),
          checkedBy: checkedBy ? String(checkedBy).trim() : null,
          actualCost: actualCost != null && actualCost !== '' ? Number(actualCost) : null,
          warrantyDays: warrantyDays != null && warrantyDays !== '' ? Number(warrantyDays) : null,
        },
        include: {
          item: { include: { category: true, subcategory: true } },
          supplier: true,
          assetInstances: { select: { id: true, assetTag: true, condition: true } },
        },
      });

      // Update asset instances condition
      if (existing.assetInstances.length > 0) {
        await tx.assetInstance.updateMany({
          where: { maintenanceId },
          data: { condition: 'discarded' },
        });
      }

      // Determine quantity to discard
      const qty = existing.assetInstances.length > 0 ? existing.assetInstances.length : 1;
      const item = existing.item;
      const previousStock = Number(item.currentStock || 0);
      const newStock = Math.max(0, previousStock - qty);

      const gdn = await tx.inventoryGDN.create({
        data: {
          code: gdnCode,
          itemId: existing.itemId,
          quantity: qty,
          reason: gdnReason,
          scrapValue: scrapValue != null && scrapValue !== '' ? Number(scrapValue) : null,
          discardedDate: receivedDate ? new Date(receivedDate) : new Date(),
          maintenanceId,
        },
        include: { item: true },
      });

      await tx.inventoryStockMovement.create({
        data: {
          itemId: existing.itemId,
          movementType: 'OUT',
          quantity: qty,
          previousStock,
          newStock,
          referenceType: 'GDN',
          referenceId: gdn.code,
          note: gdnReason,
        },
      });

      await tx.inventoryItem.update({
        where: { id: existing.itemId },
        data: { currentStock: newStock },
      });

      return { ...updated, gdns: [gdn] };
    });
  }

  throw new Error('action must be "complete" or "discard"');
}

async function listExpiredItemsReport({ exactDate, itemId, categoryId, subcategoryId, assetType } = {}) {
  const parsedItemId = parsePositiveNumber(itemId);
  const parsedCategoryId = parsePositiveNumber(categoryId);
  const parsedSubcategoryId = parsePositiveNumber(subcategoryId);

  const dayStart = toStartOfDay(exactDate);
  const dayEnd = toEndOfDay(exactDate);

  const itemWhere = {
    hasExpiry: true,
    ...(parsedItemId ? { id: parsedItemId } : {}),
    ...(parsedCategoryId ? { categoryId: parsedCategoryId } : {}),
    ...(parsedSubcategoryId ? { subcategoryId: parsedSubcategoryId } : {}),
    ...(assetType ? { itemType: assetType } : {}),
  };

  const movementWhere = {
    movementType: 'IN',
    item: itemWhere,
    ...(dayStart && dayEnd
      ? { expiryDate: { gte: dayStart, lte: dayEnd } }
      : { expiryDate: { lte: new Date() } }),
  };

  const movements = await prisma.inventoryStockMovement.findMany({
    where: movementWhere,
    include: {
      item: {
        include: {
          category: true,
          subcategory: true,
        },
      },
    },
    orderBy: [{ expiryDate: 'asc' }, { createdAt: 'desc' }],
  });

  return movements.map((m) => ({
    key: m.id,
    expiryDate: m.expiryDate,
    itemCode: m.item?.code || '-',
    itemName: m.item?.name || '-',
    category: m.item?.category?.name || '-',
    subcategory: m.item?.subcategory?.name || '-',
    quantity: Number(m.quantity || 0),
    referenceId: m.referenceId || '-',
  }));
}

async function listDailySalesReport({ dateFrom, dateTo, customerName, categoryId, subcategoryId, assetType, admissionOnly } = {}) {
  const parsedCategoryId = parsePositiveNumber(categoryId);
  const parsedSubcategoryId = parsePositiveNumber(subcategoryId);
  const fromDate = toStartOfDay(dateFrom);
  const toDate = toEndOfDay(dateTo);

  const headers = await prisma.inventorySalesInvoiceHeader.findMany({
    where: {
      ...(fromDate || toDate
        ? {
            invoiceDate: {
              ...(fromDate ? { gte: fromDate } : {}),
              ...(toDate ? { lte: toDate } : {}),
            },
          }
        : {}),
      ...(customerName
        ? {
            OR: [
              { customerName: { contains: customerName, mode: 'insensitive' } },
              { customerType: { equals: 'walking', mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(admissionOnly ? { customerType: { in: ['admission', 'customer'] } } : {}),
    },
    include: {
      items: {
        where: {
          ...(parsedCategoryId ? { item: { categoryId: parsedCategoryId } } : {}),
          ...(parsedSubcategoryId ? { item: { subcategoryId: parsedSubcategoryId } } : {}),
          ...(assetType ? { item: { itemType: assetType } } : {}),
        },
        include: {
          item: { include: { category: true, subcategory: true } },
        },
      },
    },
    orderBy: { invoiceDate: 'desc' },
  });

  let grandTotalQty = 0;
  let grandTotalPurchase = 0;
  let grandTotalRetail = 0;
  let grandTotalProfit = 0;

  const invoices = headers
    .filter((h) => h.items.length > 0)
    .map((h) => {
      let invTotalQty = 0;
      let invTotalPurchase = 0;
      let invTotalRetail = 0;
      let invTotalProfit = 0;

      const lines = h.items.map((line) => {
        const qty = Number(line.quantity || 0);
        const purchasePrice = Number(line.purchasePrice || 0);
        const retailPrice = Number(line.retailPrice || 0);
        const profitPerUnit = retailPrice - purchasePrice;
        const totalPurchase = purchasePrice * qty;
        const totalRetail = retailPrice * qty;
        const totalProfit = profitPerUnit * qty;

        invTotalQty += qty;
        invTotalPurchase += totalPurchase;
        invTotalRetail += totalRetail;
        invTotalProfit += totalProfit;

        return {
          lineCode: line.code,
          itemId: line.itemId,
          itemName: line.item?.name || '-',
          itemCode: line.item?.code || '-',
          category: line.item?.category?.name || '-',
          subcategory: line.item?.subcategory?.name || '-',
          qty,
          purchasePrice,
          retailPrice,
          saleRate: Number(line.saleRate || retailPrice),
          profitPerUnit,
          totalPurchase,
          totalRetail,
          totalProfit,
        };
      });

      grandTotalQty += invTotalQty;
      grandTotalPurchase += invTotalPurchase;
      grandTotalRetail += invTotalRetail;
      grandTotalProfit += invTotalProfit;

      return {
        invoiceId: h.id,
        invoiceCode: h.code,
        invoiceDate: h.invoiceDate,
        customerType: h.customerType,
        customerName: (h.customerType === 'customer' || h.customerType === 'admission') ? h.customerName : 'Walking Customer',
        lines,
        subtotalQty: invTotalQty,
        subtotalPurchase: invTotalPurchase,
        subtotalRetail: invTotalRetail,
        subtotalProfit: invTotalProfit,
      };
    });

  return {
    invoices,
    summary: {
      invoiceCount: invoices.length,
      grandTotalQty,
      grandTotalPurchase,
      grandTotalRetail,
      grandTotalProfit,
    },
  };
}

async function listSupplierLedgerReport({ dateFrom, dateTo, supplierName, categoryId, subcategoryId, assetType } = {}) {
  const parsedCategoryId = parsePositiveNumber(categoryId);
  const parsedSubcategoryId = parsePositiveNumber(subcategoryId);
  const fromDate = toStartOfDay(dateFrom);
  const toDate = toEndOfDay(dateTo);

  const where = {};

  if (fromDate || toDate) {
    where.receivedDate = {};
    if (fromDate) where.receivedDate.gte = fromDate;
    if (toDate) where.receivedDate.lte = toDate;
  }

  if (supplierName) {
    where.supplier = { name: { contains: supplierName, mode: 'insensitive' } };
  }

  if (parsedCategoryId) where.categoryId = parsedCategoryId;
  if (parsedSubcategoryId) where.subcategoryId = parsedSubcategoryId;

  if (assetType && (assetType === 'fixed asset' || assetType === 'current asset')) {
    where.item = { itemType: assetType };
  }

  const grns = await prisma.inventoryGRN.findMany({
    where,
    include: {
      supplier: true,
      item: { include: { category: true, subcategory: true } },
      category: true,
      subcategory: true,
    },
    orderBy: [{ receivedDate: 'desc' }, { createdAt: 'desc' }],
  });

  let totalGrnValue = 0;

  const rows = grns.map((grn) => {
    const grnPrice = Number(grn.receivedRate || 0);
    const qty = Number(grn.receivedQuantity || 0);
    const total = Number(grn.totalAmount || 0);
    totalGrnValue += total;

    return {
      grnId: grn.id,
      grnCode: grn.code,
      date: grn.receivedDate,
      billDate: grn.billDate || null,
      supplierName: grn.supplier?.name || '-',
      itemName: grn.item?.name || '-',
      itemCode: grn.item?.code || '-',
      itemType: grn.item?.itemType || '-',
      categoryName: grn.category?.name || grn.item?.category?.name || '-',
      subcategoryName: grn.subcategory?.name || grn.item?.subcategory?.name || '-',
      receivedQuantity: qty,
      grnPrice,
      totalAmount: total,
    };
  });

  return {
    rows,
    summary: {
      totalRecords: rows.length,
      totalGrnValue,
    },
  };
}
