const express = require('express');
const controller = require('./inventory.controller');

const router = express.Router();

router.get('/ping', controller.ping);

router.get('/masters/options', controller.listItemAddOptions);

router.get('/categories', controller.listCategories);
router.post('/categories', controller.createCategory);

router.get('/subcategories', controller.listSubcategories);
router.post('/subcategories', controller.createSubcategory);

router.get('/suppliers', controller.listSuppliers);
router.post('/suppliers', controller.createSupplier);

router.get('/storages', controller.listStorages);
router.post('/storages', controller.createStorage);

router.get('/departments', controller.listDepartments);
router.post('/departments', controller.createDepartment);

router.get('/demand-category-types', controller.listDemandCategoryTypes);
router.post('/demand-category-types', controller.createDemandCategoryType);

router.get('/items', controller.listItems);
router.post('/items', controller.createItem);
router.patch('/items/:id/status', controller.updateItemStatus);
router.delete('/items/:id', controller.deleteItem);
router.post('/items/:id/stock-movements', controller.addStockMovement);

router.get('/po', controller.listPurchaseOrders);
router.post('/po', controller.createPurchaseOrder);

router.get('/grn', controller.listGRNs);
router.post('/grn', controller.createGRN);

router.get('/gd', controller.listGDs);
router.get('/gd/headers', controller.listGDHeaders);
router.post('/gd', controller.createGD);
router.post('/gd/batch', controller.createGDBatch);

router.get('/gin', controller.listGINs);
router.post('/gin', controller.createGIN);

router.get('/sales-invoices', controller.listSalesInvoices);
router.post('/sales-invoices', controller.createSalesInvoice);
router.get('/sales-invoice-headers', controller.listSalesInvoiceHeaders);
router.post('/sales-invoice-headers', controller.createSalesInvoiceWithItems);

router.get('/gdn', controller.listGDNs);
router.post('/gdn', controller.createGDN);

router.get('/alerts/reorder', controller.listOpenReorderAlerts);
router.get('/reports/item-ledger', controller.listItemLedgerReport);
router.get('/reports/daily-sales', controller.listDailySalesReport);
router.get('/reports/supplier-ledger', controller.listSupplierLedgerReport);
router.get('/reports/stock-position', controller.listStockPositionReport);
router.get('/reports/short-expiry', controller.listShortExpiryReport);
router.get('/reports/expired-items', controller.listExpiredItemsReport);

router.get('/maintenance', controller.listMaintenances);
router.post('/maintenance', controller.createMaintenance);

module.exports = router;
