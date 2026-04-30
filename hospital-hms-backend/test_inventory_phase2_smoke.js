const base = process.env.BASE_URL || 'http://localhost:5002/api/inventory';

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
    body: JSON.stringify({ name: `Phase2-Cat-${ts}`, status: 'active' }),
  });

  const subcategory = await req('/subcategories', {
    method: 'POST',
    body: JSON.stringify({
      name: `Phase2-Sub-${ts}`,
      categoryId: category.id,
      status: 'active',
    }),
  });

  const supplier = await req('/suppliers', {
    method: 'POST',
    body: JSON.stringify({ name: `Phase2-Supp-${ts}`, status: 'active' }),
  });

  const storage = await req('/storages', {
    method: 'POST',
    body: JSON.stringify({ name: `Phase2-Store-${ts}`, status: 'active' }),
  });

  const department = await req('/departments', {
    method: 'POST',
    body: JSON.stringify({ name: `Phase2-Dept-${ts}`, status: 'active' }),
  });

  const demandType = await req('/demand-category-types', {
    method: 'POST',
    body: JSON.stringify({ name: category.name, status: 'active' }),
  });

  const item = await req('/items', {
    method: 'POST',
    body: JSON.stringify({
      name: `Phase2-Item-${ts}`,
      categoryId: category.id,
      subcategoryId: subcategory.id,
      supplierId: supplier.id,
      storageId: storage.id,
      itemType: 'current asset',
      unit: 'pieces',
      reorderLevel: 3,
      purchasePrice: 50,
      currentStock: 0,
      hasExpiry: false,
      status: 'active',
    }),
  });

  const po = await req('/po', {
    method: 'POST',
    body: JSON.stringify({
      supplierId: supplier.id,
      itemId: item.id,
      requiredQuantity: 10,
      orderedRate: 52,
      expectedDate: new Date().toISOString(),
    }),
  });

  const grn = await req('/grn', {
    method: 'POST',
    body: JSON.stringify({
      poId: po.id,
      receivedQuantity: 10,
      receivedRate: 52,
    }),
  });

  const gd = await req('/gd', {
    method: 'POST',
    body: JSON.stringify({
      itemId: item.id,
      departmentId: department.id,
      demandCategoryTypeId: demandType.id,
      quantityRequested: 8,
    }),
  });

  const gin1 = await req('/gin', {
    method: 'POST',
    body: JSON.stringify({ gdId: gd.id, issuedQuantity: 3 }),
  });

  const gin2 = await req('/gin', {
    method: 'POST',
    body: JSON.stringify({ gdId: gd.id, issuedQuantity: 5 }),
  });

  const gdUpdated = await req(`/gd?search=${encodeURIComponent(gd.code)}`);

  console.log(
    JSON.stringify(
      {
        base,
        codes: {
          department: department.code,
          demandType: demandType.code,
          po: po.code,
          grn: grn.code,
          gd: gd.code,
          gin: [gin1.code, gin2.code],
        },
        statuses: {
          po: 'received expected',
          gdFinal: gdUpdated?.[0]?.status || null,
        },
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
