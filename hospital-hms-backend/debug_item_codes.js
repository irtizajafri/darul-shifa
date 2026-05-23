const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function debugItemCodes() {
  console.log('🔍 Checking InventoryItem codes in database...\n');

  // Get all items with their codes
  const items = await prisma.inventoryItem.findMany({
    select: {
      id: true,
      code: true,
      name: true,
      categoryId: true,
      subcategoryId: true,
      category: { select: { name: true, code: true } },
      subcategory: { select: { name: true, code: true } },
    },
    orderBy: { code: 'asc' },
  });

  console.log(`Total items: ${items.length}\n`);

  // Group by category + subcategory
  const grouped = {};
  items.forEach(item => {
    const key = `${item.category.code}-${item.subcategory.code}`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(item);
  });

  // Show items by category
  Object.entries(grouped).forEach(([key, itemsInGroup]) => {
    console.log(`\n📦 ${key} (${itemsInGroup.length} items):`);
    itemsInGroup.forEach(item => {
      console.log(`  - ${item.code}: ${item.name}`);
    });
  });

  // Check for duplicates
  const codes = items.map(i => i.code);
  const duplicates = codes.filter((code, index) => codes.indexOf(code) !== index);
  
  if (duplicates.length > 0) {
    console.log(`\n⚠️  DUPLICATES FOUND: ${duplicates.join(', ')}`);
  } else {
    console.log(`\n✅ No duplicate codes found`);
  }

  // Show last 10 items
  console.log(`\n📝 Last 10 items:`);
  items.slice(-10).forEach(item => {
    console.log(`  ${item.code}: ${item.name}`);
  });

  await prisma.$disconnect();
}

debugItemCodes().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
