// WhatsApp Punch Notifier's sending layer — wraps whatsapp-web.js, which
// automates a real WhatsApp account via a headless-browser session
// (Puppeteer). This is the free/unofficial route, chosen explicitly over the
// paid official WhatsApp Business API: it violates WhatsApp's Terms of
// Service, the linked number can be rate-limited or banned by WhatsApp at
// any time without warning, and the session silently logs out if the linked
// phone stays offline too long. Accepted trade-off for zero running cost —
// see the plan doc, not re-litigated here.
//
// Session state persists to .wwebjs_auth/ (gitignored — it's effectively a
// login credential) so the QR only needs scanning once per machine.

const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

const ENABLED = String(process.env.WHATSAPP_PUNCH_ALERTS_ENABLED || '').toLowerCase() === 'true';

let client = null;
let isReady = false;

function initWhatsApp() {
  if (!ENABLED) {
    console.log('ℹ️  WhatsApp Punch Alerts disabled (WHATSAPP_PUNCH_ALERTS_ENABLED != true) — skipping WhatsApp session.');
    return;
  }

  client = new Client({
    authStrategy: new LocalAuth({ dataPath: '.wwebjs_auth' }),
    puppeteer: {
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    },
  });

  client.on('qr', (qr) => {
    console.log('\n📱 WhatsApp Punch Notifier — scan this QR with the SENDING number\'s WhatsApp (Linked Devices):\n');
    qrcode.generate(qr, { small: true });
  });

  client.on('ready', () => {
    isReady = true;
    console.log('✅ WhatsApp Punch Notifier — session ready, sender linked.');
  });

  client.on('auth_failure', (msg) => {
    isReady = false;
    console.error('❌ WhatsApp Punch Notifier — auth failure:', msg);
  });

  client.on('disconnected', (reason) => {
    isReady = false;
    console.error('⚠️  WhatsApp Punch Notifier — session disconnected:', reason, '— delete .wwebjs_auth and re-scan to relink.');
  });

  client.initialize().catch((err) => {
    console.error('❌ WhatsApp Punch Notifier — failed to initialize client:', err.message);
  });
}

// Accepts a plain local/international-looking number (e.g. "923001234567",
// "03001234567", "+92 300 1234567") and returns whatsapp-web.js's chat-id
// format. Assumes Pakistani numbers when a leading 0 is given (this system's
// only real-world case) — anything already carrying a country code passes
// through as-is.
function toChatId(rawNumber) {
  let digits = String(rawNumber || '').replace(/[^0-9]/g, '');
  if (digits.startsWith('0')) digits = `92${digits.slice(1)}`;
  return `${digits}@c.us`;
}

async function sendWhatsAppMessage(toNumber, text) {
  if (!ENABLED) return false;
  if (!client || !isReady) {
    console.error('⚠️  WhatsApp Punch Notifier — send skipped, session not ready yet.');
    return false;
  }
  try {
    await client.sendMessage(toChatId(toNumber), text);
    return true;
  } catch (err) {
    // A dropped WhatsApp session must never take the HMS server down — log
    // and let the caller decide what "not sent" means for its own retry.
    console.error('❌ WhatsApp Punch Notifier — send failed:', err.message);
    return false;
  }
}

function isWhatsAppReady() {
  return isReady;
}

module.exports = { initWhatsApp, sendWhatsAppMessage, isWhatsAppReady };
