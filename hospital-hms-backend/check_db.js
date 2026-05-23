require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  try {
    console.log('Connecting to database...');
    const itemCount = await prisma.inventoryItem.count();
    console.log(`✅ Total items: ${itemCount}`);
    
    if (itemCount > 0) {
      const items = await prisma.inventoryItem.findMany({ 
        take: 20,
        select: { code: true, name: true }
      });
      console.log('\nFirst 20 items:');
      items.forEach(i => console.log(`  ${i.code}: ${i.name}`));
    }
  } catch (e) {
    console.error('❌ Error:', e.message);
  }
  process.exit(0);
})();
