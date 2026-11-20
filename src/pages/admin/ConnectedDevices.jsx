import { useCallback, useEffect, useMemo, useState } from 'react';
import { Ban, CheckCircle2, Monitor, RefreshCw, Search, Shield, ShieldOff, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { API_BASE_URL } from '../../config';
import { confirmDialog } from '../../components/ui/ConfirmDialog';
import './ConnectedDevices.scss';

// Super Admin → Connected PCs (owner, 2026-11-20): every PC that has used the
// HMS, by IP — online now (seen in the last 3 minutes), last user, MAC — and
// Allow / Block for each. "Approved PCs only" makes a new PC wait until it's
// allowed here. The server and the PC you are on can never be blocked.

const API = `${API_BASE_URL}/api/devices`;
const fmtWhen = (d) => (d ? new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');
function ago(d, now) {
  const s = Math.max(0, Math.round((now - new Date(d).getTime()) / 1000));
  if (s < 60) return 'abhi';
  if (s < 3600) return `${Math.floor(s / 60)} min pehle`;
  if (s < 86400) return `${Math.floor(s / 3600)} ghante pehle`;
  return `${Math.floor(s / 86400)} din pehle`;
}
const STATUS = { allowed: 'Allowed', blocked: 'Blocked', pending: 'Waiting approval' };

async function call(path, method = 'GET', body) {
  const res = await fetch(`${API}${path}`, { method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || j?.ok === false) throw new Error(j?.message || 'Request failed');
  return j.data;
}

export default function ConnectedDevices() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(null);
  const [q, setQ] = useState('');
  const [names, setNames] = useState({});

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const d = await call('');
      setData(d);
    } catch (e) {
      if (!quiet) toast.error(e.message);
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);
  useEffect(() => {
    load();
    const t = setInterval(() => load(true), 20000);
    return () => clearInterval(t);
  }, [load]);

  const now = data ? new Date(data.now).getTime() : Date.now();
  const devices = useMemo(() => {
    const list = data?.devices || [];
    const t = q.trim().toLowerCase();
    return t ? list.filter((d) => [d.ip, d.name, d.macAddress, d.lastUserName, d.lastUserEmail].some((v) => String(v || '').toLowerCase().includes(t))) : list;
  }, [data, q]);
  const counts = useMemo(() => {
    const list = data?.devices || [];
    return {
      online: list.filter((d) => d.online).length,
      total: list.length,
      blocked: list.filter((d) => d.status === 'blocked').length,
      pending: list.filter((d) => d.status === 'pending').length,
    };
  }, [data]);

  const update = async (d, patch, okMsg) => {
    setBusy(d.id);
    try {
      await call(`/${d.id}`, 'PUT', patch);
      if (okMsg) toast.success(okMsg);
      await load(true);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  };
  const label = (d) => d.name || d.ip;
  const block = async (d) => {
    const ok = await confirmDialog({ title: `${label(d)} block karein?`, message: `Is PC (${d.ip}) pe HMS band ho jayega — login bhi nahi hoga. Jo user abhi khula hai woh bahar ho jayega.`, confirmLabel: 'Block', danger: true });
    if (ok) update(d, { status: 'blocked' }, `${label(d)} block ho gaya`);
  };
  const allow = (d) => update(d, { status: 'allowed' }, `${label(d)} allow ho gaya`);
  const toggleProtect = (d) => update(d, { protected: !d.protected }, d.protected ? 'Protection hata di' : `${label(d)} protected — kabhi block nahi hoga`);
  const saveName = (d) => {
    const v = names[d.id];
    if (v === undefined || v === (d.name || '')) return;
    update(d, { name: v }, 'Naam save ho gaya');
  };
  const forget = async (d) => {
    const ok = await confirmDialog({ title: `${label(d)} list se hatayein?`, message: 'Sirf list se hatega. Yeh PC dobara HMS kholega to phir se list me aa jayega.', confirmLabel: 'Hatayein', danger: true });
    if (!ok) return;
    setBusy(d.id);
    try { await call(`/${d.id}`, 'DELETE'); await load(true); } catch (e) { toast.error(e.message); } finally { setBusy(null); }
  };
  const toggleApproval = async () => {
    const on = !data.approvalMode;
    const ok = await confirmDialog(on
      ? { title: 'Sirf approved PCs?', message: `Iske baad koi NAYA PC tab tak HMS nahi chala sakega jab tak aap yahan "Allow" na karein. Jo PCs abhi list me "Allowed" hain woh chalte rahenge. Yeh PC (${data.myIp}) aur server hamesha allowed rahenge.`, confirmLabel: 'On karein' }
      : { title: 'Approval band karein?', message: 'Har naya PC phir se seedha HMS chala sakega (blocked PCs blocked hi rahenge).', confirmLabel: 'Off karein' });
    if (!ok) return;
    try { await call('/settings', 'PUT', { approvalMode: on }); toast.success(on ? 'Ab sirf approved PCs' : 'Approval band'); await load(true); } catch (e) { toast.error(e.message); }
  };

  return (
    <div className="cpc">
      <div className="cpc__head">
        <div>
          <h1><Monitor size={20} /> Connected PCs</h1>
          <p>Har PC jo HMS chalata hai. Online = pichle 3 minute me dekha gaya. Block kiye gaye PC pe HMS nahi chalega.</p>
        </div>
        <button type="button" className="cpc__btn" onClick={() => load()} disabled={loading}><RefreshCw size={14} /> Refresh</button>
      </div>

      {data && (
        <>
          <div className="cpc__stats">
            <div><span>Online abhi</span><b className="cpc__on">{counts.online}</b></div>
            <div><span>Kul PCs</span><b>{counts.total}</b></div>
            <div><span>Blocked</span><b className={counts.blocked ? 'cpc__bad' : ''}>{counts.blocked}</b></div>
            <div><span>Approval ka intezar</span><b className={counts.pending ? 'cpc__warn' : ''}>{counts.pending}</b></div>
            <div><span>Yeh PC</span><b className="cpc__mono">{data.myIp}</b></div>
          </div>

          <div className={`cpc__mode${data.approvalMode ? ' cpc__mode--on' : ''}`}>
            <div>
              <b>Sirf approved PCs: {data.approvalMode ? 'ON' : 'OFF'}</b>
              <span>{data.approvalMode ? 'Naya PC "Approval ka intezar" me aayega — Allow karne tak HMS nahi chalega.' : 'Abhi har naya PC seedha HMS chala sakta hai.'}</span>
              {data.guardOff && <span className="cpc__bad">Server pe DEVICE_GUARD=off hai — block abhi kaam nahi kar raha.</span>}
            </div>
            <button type="button" className="cpc__btn" onClick={toggleApproval}>{data.approvalMode ? 'Off karein' : 'On karein'}</button>
          </div>

          <div className="cpc__card">
            <label className="cpc__search">
              <Search size={14} />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="IP, naam, MAC ya user se dhoondein" aria-label="Search PCs" />
            </label>
            <div className="table-wrap">
              <table className="cpc__table">
                <thead>
                  <tr><th>Online</th><th>PC ka naam</th><th>IP</th><th>MAC</th><th>Aakhri user</th><th>Aakhri dafa</th><th>Pehli dafa</th><th className="r">Calls</th><th>Access</th><th /></tr>
                </thead>
                <tbody>
                  {!devices.length && <tr><td colSpan={10} className="cpc__empty">{q ? 'Kuch nahi mila.' : 'Abhi tak koi PC note nahi hua.'}</td></tr>}
                  {devices.map((d) => {
                    const locked = d.isServer || d.isMe || d.protected;
                    return (
                      <tr key={d.id} className={d.status === 'blocked' ? 'is-blocked' : d.status === 'pending' ? 'is-pending' : ''}>
                        <td className="nowrap">
                          <span className={`cpc__dot${d.online ? ' cpc__dot--on' : ''}`} aria-hidden="true" />
                          <span className="cpc__muted">{d.online ? 'Online' : ago(d.lastSeenAt, now)}</span>
                        </td>
                        <td>
                          <input
                            className="cpc__name"
                            value={names[d.id] ?? d.name ?? ''}
                            placeholder="naam likhein"
                            onChange={(e) => setNames((n) => ({ ...n, [d.id]: e.target.value }))}
                            onBlur={() => saveName(d)}
                            onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                            aria-label={`Name for ${d.ip}`}
                          />
                        </td>
                        <td className="cpc__mono">
                          {d.ip}
                          <div className="cpc__tags">
                            {d.isServer && <span className="cpc__tag cpc__tag--server">Server</span>}
                            {d.isMe && <span className="cpc__tag cpc__tag--me">Yeh PC</span>}
                            {d.protected && <span className="cpc__tag cpc__tag--prot">Protected</span>}
                          </div>
                        </td>
                        <td className="cpc__mono cpc__muted">{d.macAddress || '—'}</td>
                        <td>{d.lastUserName || '—'}{d.lastUserEmail && d.lastUserEmail !== d.lastUserName ? <div className="cpc__muted">{d.lastUserEmail}</div> : null}</td>
                        <td className="nowrap">{fmtWhen(d.lastSeenAt)}</td>
                        <td className="nowrap cpc__muted">{fmtWhen(d.firstSeenAt)}</td>
                        <td className="r">{Number(d.requestCount || 0).toLocaleString()}</td>
                        <td><span className={`cpc__pill cpc__pill--${d.status}`}>{STATUS[d.status] || d.status}</span></td>
                        <td>
                          <div className="cpc__actions">
                          {d.status !== 'allowed' && (
                            <button type="button" className="cpc__btn cpc__btn--sm cpc__btn--ok" onClick={() => allow(d)} disabled={busy === d.id}><CheckCircle2 size={13} /> Allow</button>
                          )}
                          {d.status === 'allowed' && !locked && (
                            <button type="button" className="cpc__btn cpc__btn--sm cpc__btn--bad" onClick={() => block(d)} disabled={busy === d.id}><Ban size={13} /> Block</button>
                          )}
                          {!d.isServer && (
                            <button type="button" className="cpc__btn cpc__btn--sm" onClick={() => toggleProtect(d)} disabled={busy === d.id} title={d.protected ? 'Protection hatayein' : 'Protected: kabhi block na ho (jaise dev PC)'}>
                              {d.protected ? <ShieldOff size={13} /> : <Shield size={13} />}
                            </button>
                          )}
                          {!d.isMe && (
                            <button type="button" className="cpc__btn cpc__btn--sm" onClick={() => forget(d)} disabled={busy === d.id} title="List se hatayein" aria-label={`Forget ${d.ip}`}><Trash2 size={13} /></button>
                          )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="cpc__note">Yeh sirf HMS ki ijazat hai. PC ka internet aur USB band karna checklist (<code>/it/</code>) ki scripts se hota hai.</p>
          </div>
        </>
      )}
      {!data && loading && <p className="cpc__empty">Loading…</p>}
    </div>
  );
}
