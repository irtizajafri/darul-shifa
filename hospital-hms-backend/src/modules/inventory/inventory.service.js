const prisma = require('../../config/db');

const ACTIVE = 'active';
const INACTIVE = 'inactive';

function normalizeStatus(value) {
  const v = String(value || ACTIVE).trim().toLowerCase();
  return v === INACTIVE ? INACTIVE : ACTIVE;
}

function padSequence(num) {
  return String(num).padStart(3, '0');
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
  const name = String(payload.name || '').trim();
  const status = normalizeStatus(payload.status);
  const code = String(payload.code || '').trim() || await generateDateCode('inventoryCategory');

  return prisma.inventoryCategory.create({
    data: {
      code,
      name,
      status,
    },
  });
}

async function listSubcategories({ search, status, categoryId }) {
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
  const name = String(payload.name || '').trim();
  const status = normalizeStatus(payload.status);
  const code = String(payload.code || '').trim() || await generateDateCode('inventorySubcategory');

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

  const [category, subcategory, supplier, storage] = await Promise.all([
    prisma.inventoryCategory.findUnique({ where: { id: Number(categoryId) } }),
    prisma.inventorySubcategory.findUnique({ where: { id: Number(subcategoryId) } }),
    prisma.inventorySupplier.findUnique({ where: { id: Number(supplierId) } }),
    parsedStorageId
      ? prisma.inventoryStorage.findUnique({ where: { id: Number(parsedStorageId) } })
      : Promise.resolve(null),
  ]);

  if (!category) throw new Error('Selected category does not exist');
  if (!subcategory) throw new Error('Selected subcategory does not exist');
  if (!supplier) throw new Error('Selected supplier/vendor does not exist');
  if (parsedStorageId && !storage) throw new Error('Selected storage/shelf does not exist');

  if (subcategory.categoryId !== Number(categoryId)) {
    throw new Error('Selected subcategory does not belong to selected category');
  }

  if (category.status !== ACTIVE) throw new Error('Selected category is inactive');
  if (subcategory.status !== ACTIVE) throw new Error('Selected subcategory is inactive');
  if (supplier.status !== ACTIVE) throw new Error('Selected supplier/vendor is inactive');
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
      supplier: true,
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

async function createPurchaseOrder(payload) {
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

  let orderedRate = parsePositiveNumber(payload.orderedRate);
  if (!Number.isFinite(orderedRate)) {
    if (latestGrn?.receivedRate) orderedRate = Number(latestGrn.receivedRate);
    else throw new Error('orderedRate is required because item has never been purchased before');
  }

  const code = String(payload.code || '').trim() || await generateDocCode('inventoryPurchaseOrder', 'po');

  return prisma.inventoryPurchaseOrder.create({
    data: {
      code,
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

async function listGRNs({ search, supplierId, categoryId, subcategoryId, dateFrom, dateTo }) {
  const parsedSupplierId = parsePositiveNumber(supplierId);
  const parsedCategoryId = parsePositiveNumber(categoryId);
  const parsedSubcategoryId = parsePositiveNumber(subcategoryId);

  return prisma.inventoryGRN.findMany({
    where: {
      ...buildSearchFilter(search, ['code']),
      ...(parsedSupplierId ? { supplierId: parsedSupplierId } : {}),
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

async function listGINs({ search, departmentId, categoryId, subcategoryId, dateFrom, dateTo }) {
  const parsedDepartmentId = parsePositiveNumber(departmentId);
  const parsedCategoryId = parsePositiveNumber(categoryId);
  const parsedSubcategoryId = parsePositiveNumber(subcategoryId);

  return prisma.inventoryGIN.findMany({
    where: {
      ...buildSearchFilter(search, ['code']),
      ...(parsedDepartmentId ? { departmentId: parsedDepartmentId } : {}),
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

async function listGDNs({ search, itemId, dateFrom, dateTo }) {
  const parsedItemId = parsePositiveNumber(itemId);

  return prisma.inventoryGDN.findMany({
    where: {
      ...buildSearchFilter(search, ['code', 'reason']),
      ...(parsedItemId ? { itemId: parsedItemId } : {}),
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
    orderBy: { createdAt: 'desc' },
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
  const code = String(payload.code || '').trim() || await generateDateCode('inventoryItem');
  const status = normalizeStatus(payload.status);
  const itemType = String(payload.itemType || '').trim().toLowerCase();

  const assetConditionRaw = String(payload.assetCondition || '').trim().toLowerCase();
  const assetCondition = assetConditionRaw || 'working';

  await validateActiveMasterRecords(payload);

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

  return prisma.inventoryItem.create({
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
      categoryId: Number(payload.categoryId),
      subcategoryId: Number(payload.subcategoryId),
      supplierId: Number(payload.supplierId),
      storageId: parsePositiveNumber(payload.storageId),
    },
    include: {
      category: true,
      subcategory: true,
      supplier: true,
      storage: true,
    },
  });
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
      supplier: true,
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
          supplier: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

async function listItemAddOptions({ search }) {
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
};
