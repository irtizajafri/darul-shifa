require('dotenv').config();
const app = require('./src/app');
const prisma = require('./src/config/db');

async function backfillOpeningStockMovements() {
  const items = await prisma.inventoryItem.findMany({
    where: { currentStock: { gt: 0 } },
    select: { id: true, currentStock: true, purchasePrice: true },
  });

  for (const item of items) {
    const existing = await prisma.inventoryStockMovement.findFirst({
      where: { itemId: item.id, movementType: 'OPENING' },
      select: { id: true },
    });
    if (existing) continue;

    await prisma.inventoryStockMovement.create({
      data: {
        itemId: item.id,
        movementType: 'OPENING',
        referenceType: 'OPENING',
        quantity: item.currentStock,
        unitRate: item.purchasePrice || 0,
        previousStock: 0,
        newStock: item.currentStock,
        note: 'Opening stock backfill',
      },
    });
  }
  console.log(`✅ Opening stock backfill done for ${items.length} items`);
}

app.get('/', (req, res) => {
  res.json({ message: '🏥 Darul Shifa Imam Khomeini API Running!' });
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, async () => {
  console.log(`🚀 Server running on port ${PORT}`);
  await backfillOpeningStockMovements().catch((err) => console.error('Backfill error:', err));
});
