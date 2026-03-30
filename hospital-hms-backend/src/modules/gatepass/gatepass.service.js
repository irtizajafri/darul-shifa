const prisma = require('../../config/db');

function parseReason(reason) {
  if (!reason) return { nature: 'Personal', purpose: '', permissionBy: '' };
  try {
    const parsed = JSON.parse(reason);
    return {
      nature: parsed.nature || 'Personal',
      purpose: parsed.purpose || '',
      permissionBy: parsed.permissionBy || ''
    };
  } catch {
    return { nature: 'Personal', purpose: reason, permissionBy: '' };
  }
}

async function list() {
  const rows = await prisma.gatepass.findMany({
    orderBy: { issuedAt: 'desc' },
    include: { employee: true }
  });

  return rows.map((g) => ({
    ...g,
    ...parseReason(g.reason),
    outAt: g.issuedAt,
    inAt: g.validTill
  }));
}

async function create(payload) {
  const { employeeId, nature, purpose, permissionBy, issuedAt } = payload;
  const now = issuedAt ? new Date(issuedAt) : new Date();
  const reason = JSON.stringify({ nature, purpose, permissionBy });

  return prisma.gatepass.create({
    data: {
      employeeId: parseInt(employeeId),
      reason,
      issuedAt: now,
      status: 'active'
    }
  });
}

async function closeGatepass(id, payload) {
  const { inAt } = payload;
  const gatepass = await prisma.gatepass.findUnique({ where: { id: parseInt(id) } });
  if (!gatepass) return null;

  const returnAt = inAt ? new Date(inAt) : new Date();

  return prisma.gatepass.update({
    where: { id: parseInt(id) },
    data: {
      validTill: returnAt,
      status: 'closed'
    }
  });
}

module.exports = { list, create, closeGatepass };
