const service = require('./inventory.service');
const { success, fail } = require('../../utils/response');

const ALLOWED_ITEM_TYPES = ['current asset', 'fixed asset'];
const ALLOWED_UNITS = [
  'kg',
  'liters',
  'pieces',
  'boxes',
  'ml',
  'dozen',
  'feet',
  'inches',
  'millimeters',
  'centimeter',
];
const ALLOWED_ASSET_CONDITIONS = ['working', 'under repair', 'condemned', 'in store'];
const ALLOWED_USEFUL_LIFE_UNITS = ['years', 'months', 'hours'];

function toNormalizedString(value) {
  return String(value || '').trim().toLowerCase();
}

function missingFields(body, fields) {
  return fields.filter((k) => body[k] === undefined || body[k] === null || body[k] === '');
}

function isNumericId(value) {
  return Number.isFinite(Number(value)) && Number(value) > 0;
}

async function ping(_req, res, next) {
  try {
    res.json({ module: 'inventory', ok: true });
  } catch (err) {
    next(err);
  }
}

async function listCategories(req, res, next) {
  try {
    const data = await service.listCategories(req.query || {});
    return success(res, data);
  } catch (err) {
    next(err);
  }
}

async function createCategory(req, res, next) {
  try {
    const missing = missingFields(req.body || {}, ['name']);
    if (missing.length) return fail(res, 400, `Missing fields: ${missing.join(', ')}`);

    const data = await service.createCategory(req.body || {});
    return success(res, data, 'category created');
  } catch (err) {
    if (String(err.message).toLowerCase().includes('unique')) {
      return fail(res, 409, 'Category code/name must be unique');
    }
    next(err);
  }
}

async function listSubcategories(req, res, next) {
  try {
    const data = await service.listSubcategories(req.query || {});
    return success(res, data);
  } catch (err) {
    next(err);
  }
}

async function createSubcategory(req, res, next) {
  try {
    const missing = missingFields(req.body || {}, ['name', 'categoryId']);
    if (missing.length) return fail(res, 400, `Missing fields: ${missing.join(', ')}`);
    if (!isNumericId(req.body.categoryId)) return fail(res, 400, 'Invalid categoryId');

    const data = await service.createSubcategory(req.body || {});
    return success(res, data, 'subcategory created');
  } catch (err) {
    if (String(err.message).toLowerCase().includes('unique')) {
      return fail(res, 409, 'Subcategory code/name must be unique for category');
    }
    next(err);
  }
}

async function listSuppliers(req, res, next) {
  try {
    const data = await service.listSuppliers(req.query || {});
    return success(res, data);
  } catch (err) {
    next(err);
  }
}

async function createSupplier(req, res, next) {
  try {
    const missing = missingFields(req.body || {}, ['name']);
    if (missing.length) return fail(res, 400, `Missing fields: ${missing.join(', ')}`);

    const data = await service.createSupplier(req.body || {});
    return success(res, data, 'supplier created');
  } catch (err) {
    if (String(err.message).toLowerCase().includes('unique')) {
      return fail(res, 409, 'Supplier code/name must be unique');
    }
    next(err);
  }
}

async function listStorages(req, res, next) {
  try {
    const data = await service.listStorages(req.query || {});
    return success(res, data);
  } catch (err) {
    next(err);
  }
}

async function createStorage(req, res, next) {
  try {
    const missing = missingFields(req.body || {}, ['name']);
    if (missing.length) return fail(res, 400, `Missing fields: ${missing.join(', ')}`);

    const data = await service.createStorage(req.body || {});
    return success(res, data, 'storage created');
  } catch (err) {
    if (String(err.message).toLowerCase().includes('unique')) {
      return fail(res, 409, 'Storage code/name must be unique');
    }
    next(err);
  }
}

async function listDepartments(req, res, next) {
  try {
    const data = await service.listDepartments(req.query || {});
    return success(res, data);
  } catch (err) {
    next(err);
  }
}

async function createDepartment(req, res, next) {
  try {
    const missing = missingFields(req.body || {}, ['name']);
    if (missing.length) return fail(res, 400, `Missing fields: ${missing.join(', ')}`);

    const data = await service.createDepartment(req.body || {});
    return success(res, data, 'department created');
  } catch (err) {
    if (String(err.message).toLowerCase().includes('unique')) {
      return fail(res, 409, 'Department code/name must be unique');
    }
    next(err);
  }
}

async function listDemandCategoryTypes(req, res, next) {
  try {
    const data = await service.listDemandCategoryTypes(req.query || {});
    return success(res, data);
  } catch (err) {
    next(err);
  }
}

async function createDemandCategoryType(req, res, next) {
  try {
    const missing = missingFields(req.body || {}, ['name']);
    if (missing.length) return fail(res, 400, `Missing fields: ${missing.join(', ')}`);

    const data = await service.createDemandCategoryType(req.body || {});
    return success(res, data, 'demand category type created');
  } catch (err) {
    if (String(err.message).toLowerCase().includes('unique')) {
      return fail(res, 409, 'Demand category type code/name must be unique');
    }
    next(err);
  }
}

async function listItems(req, res, next) {
  try {
    const data = await service.listItems(req.query || {});
    return success(res, data);
  } catch (err) {
    next(err);
  }
}

async function createItem(req, res, next) {
  try {
    const required = [
      'name',
      'categoryId',
      'subcategoryId',
      'supplierId',
      'itemType',
      'unit',
      'reorderLevel',
    ];
    const missing = missingFields(req.body || {}, required);
    if (missing.length) return fail(res, 400, `Missing fields: ${missing.join(', ')}`);

  const ids = ['categoryId', 'subcategoryId', 'supplierId'];
    const badId = ids.find((idKey) => !isNumericId(req.body[idKey]));
    if (badId) return fail(res, 400, `Invalid ${badId}`);

    const itemType = toNormalizedString(req.body.itemType);
    if (!ALLOWED_ITEM_TYPES.includes(itemType)) {
      return fail(res, 400, `itemType must be one of: ${ALLOWED_ITEM_TYPES.join(', ')}`);
    }

    if (itemType === 'current asset' && !isNumericId(req.body.storageId)) {
      return fail(res, 400, 'Invalid storageId');
    }

    if (itemType === 'fixed asset' && req.body.storageId !== undefined && req.body.storageId !== null && req.body.storageId !== '' && !isNumericId(req.body.storageId)) {
      return fail(res, 400, 'Invalid storageId');
    }

    const unit = toNormalizedString(req.body.unit);
    if (!ALLOWED_UNITS.includes(unit)) {
      return fail(res, 400, `unit must be one of: ${ALLOWED_UNITS.join(', ')}`);
    }

    const reorderLevel = Number(req.body.reorderLevel);
    if (!Number.isFinite(reorderLevel) || reorderLevel < 0) {
      return fail(res, 400, 'reorderLevel must be a number >= 0');
    }

    const hasUsefulLife = req.body.usefulLifeYears !== undefined && req.body.usefulLifeYears !== null && req.body.usefulLifeYears !== '';
    if (hasUsefulLife) {
      const usefulLifeYears = Number(req.body.usefulLifeYears);
      if (!Number.isFinite(usefulLifeYears) || usefulLifeYears <= 0) {
        return fail(res, 400, 'usefulLifeYears must be a number > 0');
      }

      const usefulLifeUnit = toNormalizedString(req.body.usefulLifeUnit || 'years');
      if (!ALLOWED_USEFUL_LIFE_UNITS.includes(usefulLifeUnit)) {
        return fail(res, 400, `usefulLifeUnit must be one of: ${ALLOWED_USEFUL_LIFE_UNITS.join(', ')}`);
      }
    }

    if (req.body.purchaseDate) {
      const purchaseDate = new Date(req.body.purchaseDate);
      if (Number.isNaN(purchaseDate.getTime())) return fail(res, 400, 'Invalid purchaseDate');
    }

    if (req.body.warrantyUntil) {
      const warrantyUntil = new Date(req.body.warrantyUntil);
      if (Number.isNaN(warrantyUntil.getTime())) return fail(res, 400, 'Invalid warrantyUntil');
    }

    if (itemType === 'fixed asset' && req.body.assetCondition) {
      const condition = toNormalizedString(req.body.assetCondition);
      if (!ALLOWED_ASSET_CONDITIONS.includes(condition)) {
        return fail(res, 400, `assetCondition must be one of: ${ALLOWED_ASSET_CONDITIONS.join(', ')}`);
      }
    }

    const data = await service.createItem({
      ...req.body,
      itemType,
      unit,
      reorderLevel,
    });
    return success(res, data, 'item created');
  } catch (err) {
    if (String(err.message).toLowerCase().includes('already exists for this supplier')) {
      return fail(res, 409, err.message);
    }
    if (String(err.message).toLowerCase().includes('unique')) {
      return fail(res, 409, 'Item code must be unique');
    }
    if (String(err.message).includes('required') || String(err.message).includes('inactive') || String(err.message).includes('does not')) {
      return fail(res, 400, err.message);
    }
    next(err);
  }
}

async function updateItemStatus(req, res, next) {
  try {
    if (!isNumericId(req.params.id)) return fail(res, 400, 'Invalid item id');

    const status = toNormalizedString(req.body?.status);
    if (!['active', 'inactive'].includes(status)) {
      return fail(res, 400, 'status must be active or inactive');
    }

    const data = await service.updateItemStatus(req.params.id, { status });
    return success(res, data, `item marked ${status}`);
  } catch (err) {
    if (String(err.message).includes('not found')) return fail(res, 404, err.message);
    next(err);
  }
}

async function deleteItem(req, res, next) {
  try {
    if (!isNumericId(req.params.id)) return fail(res, 400, 'Invalid item id');
    const data = await service.deleteItem(req.params.id);
    return success(res, data, 'item deleted');
  } catch (err) {
    if (String(err.message).includes('cannot be deleted')) return fail(res, 400, err.message);
    if (String(err.message).includes('not found')) return fail(res, 404, err.message);
    next(err);
  }
}

async function listPurchaseOrders(req, res, next) {
  try {
    const data = await service.listPurchaseOrders(req.query || {});
    return success(res, data);
  } catch (err) {
    next(err);
  }
}

async function createPurchaseOrder(req, res, next) {
  try {
    const hasMultiItems = Array.isArray(req.body?.items) && req.body.items.length > 0;
    const required = hasMultiItems
      ? ['supplierId', 'expectedDate', 'items']
      : ['supplierId', 'itemId', 'requiredQuantity', 'expectedDate'];
    const missing = missingFields(req.body || {}, required);
    if (missing.length) return fail(res, 400, `Missing fields: ${missing.join(', ')}`);

    if (!isNumericId(req.body.supplierId)) return fail(res, 400, 'Invalid supplierId');

    if (hasMultiItems) {
      const invalidItem = req.body.items.find((line) => !isNumericId(line?.itemId));
      if (invalidItem) return fail(res, 400, 'Invalid itemId in one or more lines');

      const invalidQty = req.body.items.find((line) => Number(line?.requiredQuantity) <= 0);
      if (invalidQty) return fail(res, 400, 'requiredQuantity must be > 0 in all lines');
    } else {
      if (!isNumericId(req.body.itemId)) return fail(res, 400, 'Invalid itemId');
    }

    const data = await service.createPurchaseOrder(req.body || {});
    return success(res, data, 'purchase order created');
  } catch (err) {
    if (String(err.message).includes('required') || String(err.message).includes('inactive') || String(err.message).includes('not')) {
      return fail(res, 400, err.message);
    }
    if (String(err.message).toLowerCase().includes('unique')) {
      return fail(res, 409, 'PO code must be unique');
    }
    next(err);
  }
}

async function listGRNs(req, res, next) {
  try {
    const data = await service.listGRNs(req.query || {});
    return success(res, data);
  } catch (err) {
    next(err);
  }
}

async function createGRN(req, res, next) {
  try {
    const hasPoRef = req.body?.poId || req.body?.poCode;
    if (!hasPoRef) return fail(res, 400, 'Missing one of: poId or poCode');
    const missing = missingFields(req.body || {}, ['receivedQuantity', 'receivedRate']);
    if (missing.length) return fail(res, 400, `Missing fields: ${missing.join(', ')}`);

    const data = await service.createGRN(req.body || {});
    return success(res, data, 'grn created');
  } catch (err) {
    if (String(err.message).includes('already exists')) return fail(res, 409, err.message);
    if (String(err.message).includes('not found') || String(err.message).includes('must')) {
      return fail(res, 400, err.message);
    }
    next(err);
  }
}

async function listGDs(req, res, next) {
  try {
    const data = await service.listGDs(req.query || {});
    return success(res, data);
  } catch (err) {
    next(err);
  }
}

async function createGD(req, res, next) {
  try {
    const required = ['itemId', 'departmentId', 'quantityRequested'];
    const missing = missingFields(req.body || {}, required);
    if (missing.length) return fail(res, 400, `Missing fields: ${missing.join(', ')}`);

    const ids = ['itemId', 'departmentId'];
    const badId = ids.find((idKey) => !isNumericId(req.body[idKey]));
    if (badId) return fail(res, 400, `Invalid ${badId}`);

    const data = await service.createGD(req.body || {});
    return success(res, data, 'gd created');
  } catch (err) {
    if (String(err.message).includes('inactive') || String(err.message).includes('not found') || String(err.message).includes('match') || String(err.message).includes('must')) {
      return fail(res, 400, err.message);
    }
    if (String(err.message).toLowerCase().includes('unique')) return fail(res, 409, 'GD code must be unique');
    next(err);
  }
}

async function listGINs(req, res, next) {
  try {
    const data = await service.listGINs(req.query || {});
    return success(res, data);
  } catch (err) {
    next(err);
  }
}

async function createGIN(req, res, next) {
  try {
    const hasGdRef = req.body?.gdId || req.body?.gdCode;
    if (!hasGdRef) return fail(res, 400, 'Missing one of: gdId or gdCode');
    const missing = missingFields(req.body || {}, ['issuedQuantity']);
    if (missing.length) return fail(res, 400, `Missing fields: ${missing.join(', ')}`);

    const data = await service.createGIN(req.body || {});
    return success(res, data, 'gin created');
  } catch (err) {
    if (String(err.message).includes('not found') || String(err.message).includes('must') || String(err.message).includes('Insufficient') || String(err.message).includes('fulfilled') || String(err.message).includes('exceed')) {
      return fail(res, 400, err.message);
    }
    if (String(err.message).toLowerCase().includes('unique')) return fail(res, 409, 'GIN code must be unique');
    next(err);
  }
}

async function listSalesInvoices(req, res, next) {
  try {
    const data = await service.listSalesInvoices(req.query || {});
    return success(res, data);
  } catch (err) {
    next(err);
  }
}

async function createSalesInvoice(req, res, next) {
  try {
    const required = ['itemId', 'quantity', 'customerType', 'markupPercent'];
    const missing = missingFields(req.body || {}, required);
    if (missing.length) return fail(res, 400, `Missing fields: ${missing.join(', ')}`);

    if (!isNumericId(req.body.itemId)) return fail(res, 400, 'Invalid itemId');

    const data = await service.createSalesInvoice(req.body || {});
    return success(res, data, 'sales invoice created');
  } catch (err) {
    if (String(err.message).includes('required') || String(err.message).includes('Invalid') || String(err.message).includes('must') || String(err.message).includes('Insufficient') || String(err.message).includes('not found') || String(err.message).includes('inactive')) {
      return fail(res, 400, err.message);
    }
    if (String(err.message).toLowerCase().includes('unique')) return fail(res, 409, 'Sales invoice code must be unique');
    next(err);
  }
}

async function listGDNs(req, res, next) {
  try {
    const data = await service.listGDNs(req.query || {});
    return success(res, data);
  } catch (err) {
    next(err);
  }
}

async function createGDN(req, res, next) {
  try {
    const required = ['itemId', 'quantity', 'reason'];
    const missing = missingFields(req.body || {}, required);
    if (missing.length) return fail(res, 400, `Missing fields: ${missing.join(', ')}`);

    if (!isNumericId(req.body.itemId)) return fail(res, 400, 'Invalid itemId');

    const data = await service.createGDN(req.body || {});
    return success(res, data, 'gdn created');
  } catch (err) {
    if (String(err.message).includes('required') || String(err.message).includes('must') || String(err.message).includes('Insufficient') || String(err.message).includes('not found')) {
      return fail(res, 400, err.message);
    }
    if (String(err.message).toLowerCase().includes('unique')) return fail(res, 409, 'GDN code must be unique');
    next(err);
  }
}

async function addStockMovement(req, res, next) {
  try {
    if (!isNumericId(req.params.id)) return fail(res, 400, 'Invalid item id');
    const missing = missingFields(req.body || {}, ['movementType', 'quantity']);
    if (missing.length) return fail(res, 400, `Missing fields: ${missing.join(', ')}`);

    const data = await service.addStockMovement(req.params.id, req.body || {});
    return success(res, data, 'stock movement recorded');
  } catch (err) {
    if (String(err.message).includes('not found')) return fail(res, 404, err.message);
    if (String(err.message).includes('must') || String(err.message).includes('Insufficient')) {
      return fail(res, 400, err.message);
    }
    next(err);
  }
}

async function listOpenReorderAlerts(_req, res, next) {
  try {
    const data = await service.listOpenReorderAlerts();
    return success(res, data);
  } catch (err) {
    next(err);
  }
}

async function listItemAddOptions(req, res, next) {
  try {
    const data = await service.listItemAddOptions(req.query || {});
    return success(res, data);
  } catch (err) {
    next(err);
  }
}

async function listItemLedgerReport(req, res, next) {
  try {
    const { itemId, categoryId, subcategoryId, dateFrom, dateTo } = req.query || {};

    if (itemId !== undefined && itemId !== '' && !isNumericId(itemId)) {
      return fail(res, 400, 'Invalid itemId');
    }

    if (categoryId !== undefined && categoryId !== '' && !isNumericId(categoryId)) {
      return fail(res, 400, 'Invalid categoryId');
    }

    if (subcategoryId !== undefined && subcategoryId !== '' && !isNumericId(subcategoryId)) {
      return fail(res, 400, 'Invalid subcategoryId');
    }

    if (dateFrom) {
      const parsed = new Date(dateFrom);
      if (Number.isNaN(parsed.getTime())) return fail(res, 400, 'Invalid dateFrom');
    }

    if (dateTo) {
      const parsed = new Date(dateTo);
      if (Number.isNaN(parsed.getTime())) return fail(res, 400, 'Invalid dateTo');
    }

    const data = await service.listItemLedgerReport(req.query || {});
    return success(res, data);
  } catch (err) {
    next(err);
  }
}

async function listShortExpiryReport(req, res, next) {
  try {
    const {
      itemId,
      categoryId,
      subcategoryId,
      dateFrom,
      dateTo,
      dateLog,
      dateLogFrom,
      dateLogTo,
    } = req.query || {};

    if (itemId !== undefined && itemId !== '' && !isNumericId(itemId)) {
      return fail(res, 400, 'Invalid itemId');
    }

    if (categoryId !== undefined && categoryId !== '' && !isNumericId(categoryId)) {
      return fail(res, 400, 'Invalid categoryId');
    }

    if (subcategoryId !== undefined && subcategoryId !== '' && !isNumericId(subcategoryId)) {
      return fail(res, 400, 'Invalid subcategoryId');
    }

    [dateFrom, dateTo, dateLog, dateLogFrom, dateLogTo].forEach((value) => {
      if (!value) return;
      const parsed = new Date(value);
      if (Number.isNaN(parsed.getTime())) {
        throw new Error('Invalid date value');
      }
    });

    const data = await service.listShortExpiryReport(req.query || {});
    return success(res, data);
  } catch (err) {
    if (String(err.message).includes('Invalid date value')) {
      return fail(res, 400, err.message);
    }
    next(err);
  }
}

module.exports = {
  ping,
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
  listShortExpiryReport,
};
