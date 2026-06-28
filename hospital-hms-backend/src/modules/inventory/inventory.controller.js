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
      'itemType',
      'unit',
      'reorderLevel',
    ];
    const missing = missingFields(req.body || {}, required);
    if (missing.length) return fail(res, 400, `Missing fields: ${missing.join(', ')}`);

    const ids = ['categoryId', 'subcategoryId'];
    const badId = ids.find((idKey) => !isNumericId(req.body[idKey]));
    if (badId) return fail(res, 400, `Invalid ${badId}`);

    // Validate supplierId if provided (can be array or single ID)
    if (req.body.supplierId) {
      const supplierIds = Array.isArray(req.body.supplierId) 
        ? req.body.supplierId 
        : [req.body.supplierId];
      const invalidSuppId = supplierIds.find((id) => !isNumericId(id));
      if (invalidSuppId) return fail(res, 400, 'Invalid supplierId(s)');
    }

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

async function updateItem(req, res, next) {
  try {
    if (!isNumericId(req.params.id)) return fail(res, 400, 'Invalid item id');
    const missing = missingFields(req.body || {}, ['name', 'categoryId', 'subcategoryId']);
    if (missing.length) return fail(res, 400, `Missing fields: ${missing.join(', ')}`);
    const data = await service.updateItem(req.params.id, req.body || {});
    return success(res, data, 'item updated');
  } catch (err) {
    if (String(err.message).toLowerCase().includes('unique')) return fail(res, 409, 'Item name must be unique');
    if (String(err.message).toLowerCase().includes('not found')) return fail(res, 404, err.message);
    next(err);
  }
}

async function updateCategory(req, res, next) {
  try {
    if (!isNumericId(req.params.id)) return fail(res, 400, 'Invalid id');
    const missing = missingFields(req.body || {}, ['name']);
    if (missing.length) return fail(res, 400, `Missing fields: ${missing.join(', ')}`);
    const data = await service.updateCategory(req.params.id, req.body || {});
    return success(res, data, 'category updated');
  } catch (err) {
    if (String(err.message).toLowerCase().includes('not found')) return fail(res, 404, err.message);
    next(err);
  }
}

async function deleteCategory(req, res, next) {
  try {
    if (!isNumericId(req.params.id)) return fail(res, 400, 'Invalid id');
    const data = await service.deleteCategory(req.params.id);
    return success(res, data, 'category deleted');
  } catch (err) {
    if (String(err.message).toLowerCase().includes('not found')) return fail(res, 404, err.message);
    if (String(err.message).toLowerCase().includes('cannot be deleted')) return fail(res, 409, err.message);
    next(err);
  }
}

async function updateSubcategory(req, res, next) {
  try {
    if (!isNumericId(req.params.id)) return fail(res, 400, 'Invalid id');
    const missing = missingFields(req.body || {}, ['name', 'categoryId']);
    if (missing.length) return fail(res, 400, `Missing fields: ${missing.join(', ')}`);
    const data = await service.updateSubcategory(req.params.id, req.body || {});
    return success(res, data, 'subcategory updated');
  } catch (err) {
    if (String(err.message).toLowerCase().includes('not found')) return fail(res, 404, err.message);
    next(err);
  }
}

async function deleteSubcategory(req, res, next) {
  try {
    if (!isNumericId(req.params.id)) return fail(res, 400, 'Invalid id');
    const data = await service.deleteSubcategory(req.params.id);
    return success(res, data, 'subcategory deleted');
  } catch (err) {
    if (String(err.message).toLowerCase().includes('not found')) return fail(res, 404, err.message);
    if (String(err.message).toLowerCase().includes('cannot be deleted')) return fail(res, 409, err.message);
    next(err);
  }
}

async function updateSupplier(req, res, next) {
  try {
    if (!isNumericId(req.params.id)) return fail(res, 400, 'Invalid id');
    const missing = missingFields(req.body || {}, ['name']);
    if (missing.length) return fail(res, 400, `Missing fields: ${missing.join(', ')}`);
    const data = await service.updateSupplier(req.params.id, req.body || {});
    return success(res, data, 'supplier updated');
  } catch (err) {
    if (String(err.message).toLowerCase().includes('not found')) return fail(res, 404, err.message);
    next(err);
  }
}

async function deleteSupplier(req, res, next) {
  try {
    if (!isNumericId(req.params.id)) return fail(res, 400, 'Invalid id');
    const data = await service.deleteSupplier(req.params.id);
    return success(res, data, 'supplier deleted');
  } catch (err) {
    if (String(err.message).toLowerCase().includes('not found')) return fail(res, 404, err.message);
    if (String(err.message).toLowerCase().includes('cannot be deleted')) return fail(res, 409, err.message);
    next(err);
  }
}

async function updateStorage(req, res, next) {
  try {
    if (!isNumericId(req.params.id)) return fail(res, 400, 'Invalid id');
    const missing = missingFields(req.body || {}, ['name']);
    if (missing.length) return fail(res, 400, `Missing fields: ${missing.join(', ')}`);
    const data = await service.updateStorage(req.params.id, req.body || {});
    return success(res, data, 'storage updated');
  } catch (err) {
    if (String(err.message).toLowerCase().includes('not found')) return fail(res, 404, err.message);
    next(err);
  }
}

async function deleteStorage(req, res, next) {
  try {
    if (!isNumericId(req.params.id)) return fail(res, 400, 'Invalid id');
    const data = await service.deleteStorage(req.params.id);
    return success(res, data, 'storage deleted');
  } catch (err) {
    if (String(err.message).toLowerCase().includes('not found')) return fail(res, 404, err.message);
    if (String(err.message).toLowerCase().includes('cannot be deleted')) return fail(res, 409, err.message);
    next(err);
  }
}

async function updateDepartment(req, res, next) {
  try {
    if (!isNumericId(req.params.id)) return fail(res, 400, 'Invalid id');
    const missing = missingFields(req.body || {}, ['name']);
    if (missing.length) return fail(res, 400, `Missing fields: ${missing.join(', ')}`);
    const data = await service.updateDepartment(req.params.id, req.body || {});
    return success(res, data, 'department updated');
  } catch (err) {
    if (String(err.message).toLowerCase().includes('not found')) return fail(res, 404, err.message);
    next(err);
  }
}

async function deleteDepartment(req, res, next) {
  try {
    if (!isNumericId(req.params.id)) return fail(res, 400, 'Invalid id');
    const data = await service.deleteDepartment(req.params.id);
    return success(res, data, 'department deleted');
  } catch (err) {
    if (String(err.message).toLowerCase().includes('not found')) return fail(res, 404, err.message);
    if (String(err.message).toLowerCase().includes('cannot be deleted')) return fail(res, 409, err.message);
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

async function listGDHeaders(req, res, next) {
  try {
    const data = await service.listGDHeaders(req.query || {});
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

async function createGDBatch(req, res, next) {
  try {
    const { departmentId, items, admissionNumber, comment } = req.body || {};
    if (!isNumericId(departmentId)) return fail(res, 400, 'Invalid departmentId');
    if (!Array.isArray(items) || items.length === 0) return fail(res, 400, 'items array is required');
    const data = await service.createGDBatch({ departmentId, items, admissionNumber, comment });
    return success(res, data, 'gd batch created');
  } catch (err) {
    if (String(err.message).includes('inactive') || String(err.message).includes('not found') || String(err.message).includes('must') || String(err.message).includes('Invalid')) {
      return fail(res, 400, err.message);
    }
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
    const { gdHeaderId, gdId, gdCode } = req.body || {};
    const hasGdHeaderRef = gdHeaderId && isNumericId(gdHeaderId);
    const hasGdRef = gdId || gdCode;
    if (!hasGdHeaderRef && !hasGdRef) return fail(res, 400, 'Missing one of: gdHeaderId or gdId or gdCode');
    if (!hasGdHeaderRef) {
      const missing = missingFields(req.body || {}, ['issuedQuantity']);
      if (missing.length) return fail(res, 400, `Missing fields: ${missing.join(', ')}`);
    }

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

async function listSalesInvoiceHeaders(req, res, next) {
  try {
    const data = await service.listSalesInvoiceHeaders(req.query || {});
    return success(res, data);
  } catch (err) {
    next(err);
  }
}

async function createSalesInvoiceWithItems(req, res, next) {
  try {
    const body = req.body || {};
    if (!body.customerType) return fail(res, 400, 'Missing fields: customerType');
    if (!Array.isArray(body.items) || body.items.length === 0) return fail(res, 400, 'At least one item is required');

    const data = await service.createSalesInvoiceWithItems(body);
    return success(res, data, 'sales invoice created');
  } catch (err) {
    if (String(err.message).includes('required') || String(err.message).includes('Invalid') || String(err.message).includes('must') || String(err.message).includes('insufficient') || String(err.message).includes('Insufficient') || String(err.message).includes('not found') || String(err.message).includes('inactive')) {
      return fail(res, 400, err.message);
    }
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

async function listOpenReorderAlerts(req, res, next) {
  try {
    const data = await service.listOpenReorderAlerts(req.query || {});
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

async function listDailySalesReport(req, res, next) {
  try {
    const { dateFrom, dateTo, customerName, categoryId, subcategoryId, assetType, admissionOnly } = req.query || {};
    if (categoryId !== undefined && categoryId !== '' && !isNumericId(categoryId)) return fail(res, 400, 'Invalid categoryId');
    if (subcategoryId !== undefined && subcategoryId !== '' && !isNumericId(subcategoryId)) return fail(res, 400, 'Invalid subcategoryId');
    const data = await service.listDailySalesReport({ dateFrom, dateTo, customerName, categoryId, subcategoryId, assetType, admissionOnly: admissionOnly === 'true' });
    return success(res, data);
  } catch (err) {
    next(err);
  }
}

async function listSupplierLedgerReport(req, res, next) {
  try {
    const { dateFrom, dateTo, supplierName, categoryId, subcategoryId, assetType } = req.query || {};
    if (categoryId !== undefined && categoryId !== '' && !isNumericId(categoryId)) return fail(res, 400, 'Invalid categoryId');
    if (subcategoryId !== undefined && subcategoryId !== '' && !isNumericId(subcategoryId)) return fail(res, 400, 'Invalid subcategoryId');
    const data = await service.listSupplierLedgerReport({ dateFrom, dateTo, supplierName, categoryId, subcategoryId, assetType });
    return success(res, data);
  } catch (err) {
    next(err);
  }
}

async function listItemLedgerReport(req, res, next) {
  try {
    const { itemId, categoryId, subcategoryId, dateFrom, dateTo, departmentId } = req.query || {};

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

async function listStockPositionReport(req, res, next) {
  try {
    const { asOfDate, categoryId, subcategoryId } = req.query || {};

    if (categoryId !== undefined && categoryId !== '' && !isNumericId(categoryId)) {
      return fail(res, 400, 'Invalid categoryId');
    }

    if (subcategoryId !== undefined && subcategoryId !== '' && !isNumericId(subcategoryId)) {
      return fail(res, 400, 'Invalid subcategoryId');
    }

    if (asOfDate) {
      const parsed = new Date(asOfDate);
      if (Number.isNaN(parsed.getTime())) return fail(res, 400, 'Invalid asOfDate');
    }

    const data = await service.listStockPositionReport(req.query || {});
    return success(res, data);
  } catch (err) {
    next(err);
  }
}

async function listExpiredItemsReport(req, res, next) {
  try {
    const { exactDate, itemId, categoryId, subcategoryId } = req.query || {};

    if (itemId !== undefined && itemId !== '' && !isNumericId(itemId)) {
      return fail(res, 400, 'Invalid itemId');
    }
    if (categoryId !== undefined && categoryId !== '' && !isNumericId(categoryId)) {
      return fail(res, 400, 'Invalid categoryId');
    }
    if (subcategoryId !== undefined && subcategoryId !== '' && !isNumericId(subcategoryId)) {
      return fail(res, 400, 'Invalid subcategoryId');
    }
    if (exactDate) {
      const parsed = new Date(exactDate);
      if (Number.isNaN(parsed.getTime())) return fail(res, 400, 'Invalid exactDate');
    }

    const data = await service.listExpiredItemsReport(req.query || {});
    return success(res, data);
  } catch (err) {
    next(err);
  }
}

async function listMaintenances(req, res, next) {
  try {
    const data = await service.listMaintenances(req.query || {});
    return success(res, data);
  } catch (err) {
    next(err);
  }
}

async function createMaintenance(req, res, next) {
  try {
    const missing = missingFields(req.body || {}, ['itemId', 'supplierId', 'natureOfRepair', 'date']);
    if (missing.length) return fail(res, 400, `Missing fields: ${missing.join(', ')}`);
    if (!isNumericId(req.body.itemId)) return fail(res, 400, 'Invalid itemId');
    if (!isNumericId(req.body.supplierId)) return fail(res, 400, 'Invalid supplierId');
    const data = await service.createMaintenance(req.body);
    return success(res, data, 'maintenance record created');
  } catch (err) {
    next(err);
  }
}

async function receiveMaintenance(req, res, next) {
  try {
    const id = req.params.id;
    const { receivedDate, checkedBy, action, scrapValue, actualCost, warrantyDays } = req.body || {};
    if (!action || !['complete', 'discard'].includes(action)) {
      return fail(res, 400, 'action must be "complete" or "discard"');
    }
    const data = await service.receiveMaintenance({ id, receivedDate, checkedBy, action, scrapValue, actualCost, warrantyDays });
    return success(res, data, action === 'complete' ? 'Marked as completed' : 'Marked as discarded, GDN created');
  } catch (err) {
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
  listGDs,
  listGDHeaders,
  createGD,
  createGDBatch,
  listGINs,
  createGIN,
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
};

async function resyncAllItemCurrentStock(req, res, next) {
  try {
    const result = await service.resyncAllItemCurrentStock();
    return success(res, result, `Re-synced currentStock for ${result.synced} items`);
  } catch (err) {
    next(err);
  }
}

async function listAssetInstances(req, res, next) {
  try {
    const data = await service.listAssetInstances(req.query || {});
    return success(res, data);
  } catch (err) {
    next(err);
  }
}

async function updateAssetInstance(req, res, next) {
  try {
    const data = await service.updateAssetInstance(req.params.id, req.body);
    return success(res, data, 'asset instance updated');
  } catch (err) {
    next(err);
  }
}

async function listUnreadGdNotifications(req, res, next) {
  try {
    const data = await service.listUnreadGdNotifications();
    return success(res, data);
  } catch (err) {
    next(err);
  }
}

async function markGdNotificationsRead(req, res, next) {
  try {
    const { ids } = req.body;
    await service.markGdNotificationsRead(ids);
    return success(res, null, 'Notifications marked as read');
  } catch (err) {
    next(err);
  }
}
