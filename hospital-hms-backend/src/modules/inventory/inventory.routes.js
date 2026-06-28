const express = require('express');
const controller = require('./inventory.controller');

const router = express.Router();

router.get('/ping', controller.ping);

router.get('/masters/options', controller.listItemAddOptions);

router.get('/categories', controller.listCategories);
router.post('/categories', controller.createCategory);
router.patch('/categories/:id', controller.updateCategory);
router.delete('/categories/:id', controller.deleteCategory);

router.get('/subcategories', controller.listSubcategories);
router.post('/subcategories', controller.createSubcategory);
router.patch('/subcategories/:id', controller.updateSubcategory);
router.delete('/subcategories/:id', controller.deleteSubcategory);

router.get('/suppliers', controller.listSuppliers);
router.post('/suppliers', controller.createSupplier);
router.patch('/suppliers/:id', controller.updateSupplier);
router.delete('/suppliers/:id', controller.deleteSupplier);

router.get('/storages', controller.listStorages);
router.post('/storages', controller.createStorage);
router.patch('/storages/:id', controller.updateStorage);
router.delete('/storages/:id', controller.deleteStorage);

router.get('/departments', controller.listDepartments);
router.post('/departments', controller.createDepartment);
router.patch('/departments/:id', controller.updateDepartment);
router.delete('/departments/:id', controller.deleteDepartment);

router.get('/demand-category-types', controller.listDemandCategoryTypes);
router.post('/demand-category-types', controller.createDemandCategoryType);

router.get('/items', controller.listItems);
router.post('/items', controller.createItem);
router.put('/items/:id', controller.updateItem);
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
router.patch('/maintenance/:id/receive', controller.receiveMaintenance);

router.get('/asset-instances', controller.listAssetInstances);
router.patch('/asset-instances/:id', controller.updateAssetInstance);

router.get('/gd-notifications/unread', controller.listUnreadGdNotifications);
router.patch('/gd-notifications/mark-read', controller.markGdNotificationsRead);

router.post('/admin/resync-stock', controller.resyncAllItemCurrentStock);

module.exports = router;
