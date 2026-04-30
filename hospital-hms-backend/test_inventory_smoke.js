const base = 'http://localhost:5001/api/inventory';

async function req(path, options = {}) {
  const res = await fetch(base + path, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.ok === false) {
    throw new Error(`${path}: ${json.message || res.status}`);
  }
  return json.data;
}

async function run() {
  const ts = Date.now();

  const category = await req('/categories', {
    method: 'POST',
    body: JSON.stringify({ name: `Medicine-${ts}`, status: 'active' }),
  });

  const subcategory = await req('/subcategories', {
    method: 'POST',
    body: JSON.stringify({ name: `Tablet-${ts}`, categoryId: category.id, status: 'active' }),
  });

  const supplier = await req('/suppliers', {
    method: 'POST',
    body: JSON.stringify({ name: `Supplier-${ts}`, contactDetails: '03001234567', status: 'active' }),
  });

  const storage = await req('/storages', {
    method: 'POST',
    body: JSON.stringify({ name: `Store-${ts}`, numberAllotment: 'Rack-1', status: 'active' }),
  });

  const item = await req('/items', {
    method: 'POST',
    body: JSON.stringify({
      name: `Panadol-${ts}`,
      categoryId: category.id,
      subcategoryId: subcategory.id,
      supplierId: supplier.id,
      storageId: storage.id,
      itemType: 'current asset',
      unit: 'pieces',
      reorderLevel: 10,
      purchasePrice: 20,
      currentStock: 9,
      hasExpiry: true,
      status: 'active',
    }),
  });

  await req(`/items/${item.id}/stock-movements`, {
    method: 'POST',
    body: JSON.stringify({
      movementType: 'OUT',
      quantity: 1,
      note: 'smoke test movement',
    }),
  });

  const alerts = await req('/alerts/reorder');
  const hasAlert = alerts.some((a) => a.itemId === item.id && a.status === 'open');

  console.log(
    JSON.stringify(
      {
        created: {
          categoryId: category.id,
          subcategoryId: subcategory.id,
          supplierId: supplier.id,
          storageId: storage.id,
          itemId: item.id,
        },
        reorderAlertGenerated: hasAlert,
        totalOpenAlerts: alerts.length,
      },
      null,
      2
    )
  );
}

run().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
