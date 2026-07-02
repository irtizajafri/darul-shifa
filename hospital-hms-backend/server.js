require('dotenv').config();
const app = require('./src/app');
const prisma = require('./src/config/db');

async function backfillOpeningStockMovements() {
  // First delete wrong backfill records that used currentStock directly
  await prisma.inventoryStockMovement.deleteMany({
    where: { movementType: 'OPENING', note: 'Opening stock backfill' },
  });

  const items = await prisma.inventoryItem.findMany({
    select: { id: true, currentStock: true, purchasePrice: true },
  });

  let count = 0;
  for (const item of items) {
    // Calculate net stock from existing movements (GRN - GIN)
    const movements = await prisma.inventoryStockMovement.findMany({
      where: { itemId: item.id },
      select: { movementType: true, quantity: true, previousStock: true, newStock: true },
    });

    const netFromMovements = movements.reduce((sum, m) => {
      const type = String(m.movementType || '').toUpperCase();
      if (type === 'IN') return sum + Number(m.quantity || 0);
      if (type === 'OUT') return sum - Number(m.quantity || 0);
      if (type === 'OPENING') return sum + Number(m.quantity || 0);
      if (type === 'ADJUSTMENT') return sum + (Number(m.newStock || 0) - Number(m.previousStock || 0));
      return sum;
    }, 0);

    // True opening = currentStock - what movements already account for
    const trueOpening = Number(item.currentStock || 0) - netFromMovements;

    if (trueOpening <= 0) continue;

    try {
      await prisma.inventoryStockMovement.create({
        data: {
          itemId: item.id,
          movementType: 'OPENING',
          referenceType: 'OPENING',
          quantity: trueOpening,
          unitRate: item.purchasePrice || 0,
          previousStock: 0,
          newStock: trueOpening,
          note: 'Opening stock backfill',
        },
      });
      count++;
    } catch (_) { /* skip duplicate */ }
  }
  console.log(`✅ Opening stock backfill done for ${count} items`);
}

app.get('/', (req, res) => {
  res.json({ message: '🏥 Darul Shifa Imam Khomeini API Running!' });
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, async () => {
  console.log(`🚀 Server running on port ${PORT}`);
  await backfillOpeningStockMovements().catch((err) => console.error('Backfill error:', err));
});
