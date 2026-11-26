import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Printer, RefreshCw } from 'lucide-react';
import { getPrintConfig, printTestPage, refreshPrintConfig, subscribePrintConfig } from '../../utils/printRelay';
import './PrintStatus.scss';

// Next to "Save & Print" / "Thermal & Save" (owner, 2026-11-26): whether this
// PC prints straight to its printers (Connected PCs) or through the print
// dialog — seen at a glance, with no slip made — and a "Test print" that sends
// a small parcha through the very same server route a slip takes.
const RESULT_OK = 'bhej diya — printer se nikla?';

export default function PrintStatus() {
  const [state, setState] = useState(getPrintConfig);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState('');
  const [result, setResult] = useState({}); // target -> { ok, text }
  const box = useRef(null);
  const pop = useRef(null);
  const [pos, setPos] = useState(null); // where the box opens (fixed, above the pill)

  useEffect(() => {
    const off = subscribePrintConfig(() => setState(getPrintConfig()));
    refreshPrintConfig();
    return off;
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (box.current?.contains(e.target) || pop.current?.contains(e.target)) return;
      setOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); window.removeEventListener('keydown', onKey); };
  }, [open]);

  const { config, error } = state;
  const thermal = !!config?.thermal;
  const normal = !!config?.normal;
  const direct = thermal || normal;
  let tone = 'off';
  let text = 'Printer setting load ho rahi hai…';
  if (config) {
    tone = direct ? (thermal && normal ? 'on' : 'half') : 'off';
    text = direct
      ? `Seedha print: Thermal ${thermal ? '✔' : '✘'} · Normal ${normal ? '✔' : '✘'}`
      : 'Dialog — is PC ke printers set nahi';
  } else if (error) {
    tone = 'bad';
    text = `Dialog — ${error}`;
  }

  const test = async (target) => {
    setBusy(target);
    setResult((r) => ({ ...r, [target]: null }));
    try {
      await printTestPage(target);
      setResult((r) => ({ ...r, [target]: { ok: true, text: RESULT_OK } }));
    } catch (e) {
      setResult((r) => ({ ...r, [target]: { ok: false, text: e.message } }));
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="pst" ref={box}>
      <button
        type="button"
        className={`pst__pill pst__pill--${tone}`}
        onClick={(e) => {
          // Opens over the page (the OPD panel clips anything inside it).
          const r = e.currentTarget.getBoundingClientRect();
          setPos({ right: Math.max(8, window.innerWidth - r.right), bottom: Math.max(8, window.innerHeight - r.top + 6) });
          setOpen((o) => !o);
        }}
        aria-expanded={open}
        title="Printer ki setting aur test print"
      >
        <Printer size={13} aria-hidden="true" /> {text}
      </button>
      {open && pos && createPortal(
        <div className="pst__pop" ref={pop} role="dialog" aria-label="Printer test" style={{ right: pos.right, bottom: pos.bottom }}>
          <div className="pst__head">
            <strong>Is PC ke printers</strong>
            <span>{config?.pc || '—'}</span>
          </div>
          {[['thermal', 'Thermal', thermal], ['normal', 'Normal', normal]].map(([key, label, set]) => (
            <div key={key} className="pst__row">
              <span className={`pst__dot ${set ? 'is-on' : ''}`} aria-hidden="true" />
              <span className="pst__label">{label}: {set ? 'seedha (server se)' : 'dialog'}</span>
              <button type="button" className="pst__btn" onClick={() => test(key)} disabled={!set || busy !== ''}>
                {busy === key ? 'Bhej raha…' : 'Test print'}
              </button>
              {result[key] && (
                <div className={`pst__result ${result[key].ok ? 'is-ok' : 'is-bad'}`}>
                  {result[key].ok ? '✔' : '✘'} {label} {result[key].text}
                </div>
              )}
            </div>
          ))}
          <div className="pst__foot">
            <button type="button" className="pst__link" onClick={() => refreshPrintConfig()}>
              <RefreshCw size={12} aria-hidden="true" /> Setting dobara lo
            </button>
            {!direct && <span>Printers Super Admin → Connected PCs me set hote hain.</span>}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
