const base = process.env.BASE_URL || 'http://localhost:5001/api/inventory';

async function j(method, path, body) {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok || json?.ok === false) {
    throw new Error(`${path}: ${json?.message || res.status}`);
  }
  return json.data;
}

(async () => {
  const ts = Date.now();

  const cat = await j('POST', '/categories', { name: `Cat-${ts}`, status: 'active' });
  const sub = await j('POST', '/subcategories', { name: `Sub-${ts}`, categoryId: cat.id, status: 'active' });
  const sup = await j('POST', '/suppliers', { name: `Sup-${ts}`, status: 'active' });
  const storage = await j('POST', '/storages', { name: `Storage-${ts}`, status: 'active' });

  const item = await j('POST', '/items', {
    name: `Item-${ts}`,
    categoryId: cat.id,
    subcategoryId: sub.id,
    supplierId: sup.id,
    storageId: storage.id,
    itemType: 'current asset',
    unit: 'pieces',
    reorderLevel: 2,
    currentStock: 20,
    purchasePrice: 60,
    status: 'active',
  });

  const dep = await j('POST', '/departments', { name: `Dept-${ts}`, status: 'active' });
  const gd = await j('POST', '/gd', {
    itemId: item.id,
    departmentId: dep.id,
    quantityRequested: 1,
  });

  const invoice = await j('POST', '/sales-invoices', {
    itemId: item.id,
    invoiceDate: new Date().toISOString(),
    customerType: 'walking',
    quantity: 5,
    markupPercent: 10.5,
  });

  const gdn = await j('POST', '/gdn', {
    itemId: item.id,
    quantity: 3,
    reason: 'Damaged test',
    discardedDate: new Date().toISOString(),
  });

  const itemRows = await j('GET', `/items?search=${encodeURIComponent(`Item-${ts}`)}`);
  const itemAfter = itemRows[0];

  console.log(JSON.stringify({
    gdCode: gd.code,
    invoiceCode: invoice.code,
    gdnCode: gdn.code,
    saleRate: Number(invoice.saleRate).toFixed(2),
    expectedSaleRate: '66.30',
    stockAfter: itemAfter?.currentStock,
    expectedStockAfter: 12,
  }, null, 2));
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
