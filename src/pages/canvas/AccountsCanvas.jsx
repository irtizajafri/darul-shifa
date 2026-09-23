import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  NodeResizer,
  useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  ArrowLeft, Wallet, Building2, Users, Settings, FileText, Search, BarChart3, X, ChevronRight,
  BookOpen, AlignLeft, Layers, Settings2, Landmark, FileDigit, Tag,
  TrendingUp, TrendingDown, Upload, SlidersHorizontal,
  Printer, LayoutList, CheckSquare, CalendarDays, History, AlertCircle,
  ReceiptText, UserCheck, Workflow, HandCoins, Scale, FileSpreadsheet,
} from 'lucide-react';
import ExcelWorkspace from './ExcelWorkspace';
import './AccountsCanvas.scss';

// Accounts module ki HAR screen yahan wire hai — sirf Parameters/Transactions/
// Inquiry/Reports hi nahi, balke unke andar ki individual screens bhi (Main
// GL, Voucher Expense, GL Balance Report, waghera — sab). Har node ka path
// asal AccountsModuleDashboard/AccountsParameters/AccountsTransactions/
// AccountsReports me jo items hain unhi se liya gaya hai (same source of
// truth, koi naya route nahi). Click hone par asal page "/canvas" ke andar
// hi (nested child route + <Outlet/>) khulta hai.
//
// Khuli screens (aur Excel window) ab bilkul Figma/Canva ki tarah is canvas
// ke ASAL coordinate-space ke andar rehte hain — ReactFlow ke apne nodes hain,
// isliye canvas zoom/pan karne se yeh bhi sab ke sath scale/move hote hain.
// Drag aur resize dono library ke native mechanism (onNodesChange +
// NodeResizer) se hote hain — koi apna hand-rolled pointer-math nahi (pehli
// koshish me yehi cheez fragile sabit hui thi).

const parametersItems = [
  { key: 'main-gl',          label: 'Main GL',            icon: BookOpen },
  { key: 'sub-gl',           label: 'Sub GL',             icon: AlignLeft },
  { key: 'main-account',     label: 'Main Account',       icon: Layers },
  { key: 'sub-account',      label: 'Sub Account',        icon: Settings2 },
  { key: 'list-attachments', label: 'List Attachments',   icon: Users },
  { key: 'bank-accounts',    label: 'Bank Accounts',      icon: Landmark },
  { key: 'cheque-serial',    label: 'Cheque Serial',      icon: FileDigit },
  { key: 'income-category',  label: 'Income Category',    icon: Tag },
];

// "Cheque Printing" is list me nahi hai — AccountsTransactions.jsx me
// dikhta tw hai lekin uska abhi koi asal route/page nahi banaya gaya
// (pre-existing gap, is feature se pehle ka) — isliye jab tak wo page nahi
// banta, canvas pe bhi node nahi daal rahe taky click dead na jaye.
const transactionsItems = [
  { key: 'voucher-income',      label: 'Voucher Income',      icon: TrendingUp },
  { key: 'voucher-expense',     label: 'Voucher Expense',     icon: TrendingDown },
  { key: 'expense-drafts',      label: 'Pending Drafts',      icon: FileText },
  { key: 'bank-deposit',        label: 'Bank Deposit',        icon: Landmark },
  { key: 'bank-statement',      label: 'Bank Statement',      icon: Upload },
  { key: 'deposit-adjustment',  label: 'Deposit Adjustment',  icon: SlidersHorizontal },
];

// AccountsReports.jsx ke saare 17 items — jin 9 ka asal page bana hua hai
// wo seedha khulte hain, baaki 8 abhi "Coming Soon" pe jaate hain (yeh
// fallback pehle se ProtectedRoutes.jsx me hai — canvas usi ko use karta
// hai, alag se kuch nahi banaya).
const reportsItems = [
  { key: 'voucher-reprint',               label: 'Voucher Reprint',               icon: Printer },
  { key: 'voucher-summary',               label: 'Voucher Summary',               icon: FileText },
  { key: 'voucher-summary-matrix',        label: 'Expense Summary Matrix',        icon: LayoutList },
  { key: 'cheque-wise-voucher-summary',   label: 'Cheque Wise Voucher Summary',   icon: CheckSquare },
  { key: 'income-summary-matrix',         label: 'Income Summary Matrix',         icon: TrendingUp },
  { key: 'gl-balance-report',             label: 'GL Balance Report',             icon: BookOpen },
  { key: 'date-wise-supplier-summary',    label: 'Date Wise Supplier Summary',    icon: CalendarDays },
  { key: 'supplier-payment-history',      label: 'Supplier Payment History',      icon: History },
  { key: 'un-presented-cheque-list',      label: 'Un-Presented Cheque List',      icon: AlertCircle },
  { key: 'slip-refund-statement',         label: 'Slip Refund Statement',         icon: ReceiptText },
  { key: 'consultant-payment-history',    label: 'Consultant Payment History',    icon: UserCheck },
  { key: 'cash-flow-statement',           label: 'Cash Flow Statement',           icon: Workflow },
  { key: 'bank-reconciliation-statement', label: 'Bank Reconciliation Statement', icon: Landmark },
  { key: 'cash-in-hand-statement',        label: 'Cash In Hand Statement',        icon: HandCoins },
  { key: 'bank-balance-statement',        label: 'Bank Balance Statement',        icon: Building2 },
  { key: 'income-expense-summary',        label: 'Income & Expense Summary',      icon: BarChart3 },
  { key: 'balance-sheet',                 label: 'Balance Sheet',                 icon: Scale },
];

const subModules = [
  { key: 'parameters',   title: 'Parameters',   icon: Settings,  items: parametersItems },
  { key: 'transactions', title: 'Transactions', icon: FileText,  items: transactionsItems },
  { key: 'inquiry',      title: 'Inquiry',      icon: Search,    items: null },
  { key: 'reports',      title: 'Reports',      icon: BarChart3, items: reportsItems },
];

const accountTypes = [
  { key: 'corporate',     title: 'Corporate',     icon: Building2 },
  { key: 'non-corporate', title: 'Non-Corporate', icon: Users },
];

// ── Tree node (Accounts / Corporate / Parameters / Main GL ...) ───────────
function CanvasNode({ data }) {
  const Icon = data.icon;
  return (
    <div className={`ac-node ac-node--${data.variant} ${data.isOpen ? 'ac-node--is-open' : ''}`}>
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
      <div className="ac-node__icon"><Icon className="w-4 h-4" /></div>
      <div className="ac-node__text">
        <span className="ac-node__title">{data.label}</span>
        {data.hint && <span className="ac-node__hint">{data.hint}</span>}
      </div>
      {data.hasChildren && (
        <ChevronRight className={`ac-node__chevron ${data.expanded ? 'ac-node__chevron--open' : ''}`} />
      )}
      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
    </div>
  );
}

// ── Open screen / Excel — ab yeh khud ek ReactFlow node hai, isliye canvas
// ke pan/zoom ke sath hi move/scale hota hai — bilkul Figma/Canva ki tarah.
// Drag sirf header se (native RF drag), resize NodeResizer se (bottom-right
// handle) — dono library ke apne, zoom-aware mechanism hain. "nodrag"/
// "nowheel" embedded page ke andar click/scroll ko canvas ke drag/zoom se
// takrane nahi dete (React Flow ka documented pattern).
function ScreenWindowNode({ data }) {
  const Icon = data.icon;
  return (
    <>
      <NodeResizer
        minWidth={340}
        minHeight={240}
        lineStyle={{ borderColor: '#2563eb' }}
        handleStyle={{ width: 9, height: 9, borderRadius: 4, background: '#2563eb', border: '1.5px solid #fff' }}
      />
      <div className={`ac-screen-node ${data.isActive ? 'ac-screen-node--active' : ''}`}>
        <div className="ac-screen-node__header">
          <Icon className="w-3.5 h-3.5" />
          <span>{data.label}</span>
          <button
            className="ac-screen-node__close nodrag"
            onClick={(e) => { e.stopPropagation(); data.onClose(); }}
            title="Close"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="ac-screen-node__body nodrag nowheel">
          {data.kind === 'excel' ? (
            <ExcelWorkspace />
          ) : data.isActive ? (
            <Outlet />
          ) : (
            <div className="ac-screen-node__placeholder" onClick={data.onActivate}>
              <Icon className="w-6 h-6" />
              <p>{data.label}</p>
              <span>Click to activate →</span>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

const nodeTypes = { card: CanvasNode, window: ScreenWindowNode };

const COL_WIDTH = 260;
const ROW_HEIGHT = 66;

// Poora Accounts tree ek data-structure ki tarah — root -> entity type ->
// submodule -> individual screen.
function buildTree() {
  return {
    key: 'root',
    label: 'Accounts',
    icon: Wallet,
    variant: 'root',
    children: accountTypes.map((type) => ({
      key: type.key,
      label: type.title,
      icon: type.icon,
      variant: 'type',
      hint: 'Entity type',
      children: subModules.map((sm) => {
        const basePath = `accounts/${type.key}/${sm.key}`;
        const node = {
          key: sm.key,
          label: sm.title,
          icon: sm.icon,
          variant: sm.items ? 'hub' : 'leaf',
          hint: type.title,
          path: basePath,
        };
        if (sm.items) {
          node.children = sm.items.map((item) => ({
            key: item.key,
            label: item.label,
            icon: item.icon,
            variant: 'leaf',
            hint: type.title,
            path: `${basePath}/${item.key}`,
          }));
        }
        return node;
      }),
    })),
  };
}

// Sirf wahi hissa build hota hai jo abhi "expanded" hai — root akela shuru
// hota hai; jab tak koi node expand na ho, uske bachche bilkul nahi bante
// (na node, na row-space). Yehi progressive drill-down ka core hai.
function buildGraph(expandedIds, activePath) {
  const nodes = [];
  const edges = [];
  let leafRow = 0;

  function visit(node, depth, parentId, id) {
    const hasChildren = !!node.children?.length;
    const expanded = hasChildren && expandedIds.has(id);
    let y;
    if (expanded) {
      const childYs = node.children.map((child) => visit(child, depth + 1, id, `${id}.${child.key}`));
      y = childYs.reduce((a, b) => a + b, 0) / childYs.length;
    } else {
      y = leafRow * ROW_HEIGHT;
      leafRow += 1;
    }

    nodes.push({
      id,
      type: 'card',
      position: { x: depth * COL_WIDTH, y },
      data: {
        label: node.label,
        hint: node.hint,
        icon: node.icon,
        variant: node.variant,
        path: node.path,
        hasChildren,
        expanded,
        isOpen: !!node.path && node.path === activePath,
      },
      draggable: false,
    });
    if (parentId) {
      edges.push({ id: `e-${parentId}-${id}`, source: parentId, target: id, type: 'smoothstep' });
    }
    return y;
  }

  visit(buildTree(), 0, null, 'root');
  return { nodes, edges };
}

const WINDOW_CASCADE = 8;

function AccountsCanvasInner() {
  const navigate = useNavigate();
  const location = useLocation();
  const { fitView, screenToFlowPosition } = useReactFlow();

  // Shuru me sirf "Accounts" node dikhta hai. Click karte hi uske bachche
  // ek level neeche khulte hain — Accounts -> 2 types -> 4 submodules ->
  // individual screens.
  const [expandedIds, setExpandedIds] = useState(() => new Set());

  // Kitni bhi screens (aur Excel) ek sath khuli reh sakti hain (replace
  // nahi hoti) — sab canvas ke flow-coordinate space me rehte hain, isliye
  // zoom/pan sab ke sath equally lagta hai. Sirf EK accounts-screen window
  // "active/live" hoti hai (jiska path URL "/canvas/accounts/..." se match
  // kare) — Excel hamesha live rehta hai (koi route nahi).
  const [windows, setWindows] = useState([]); // [{ path, label, icon, kind, x, y, width, height }]

  const activePath = location.pathname.startsWith('/canvas/')
    ? location.pathname.slice('/canvas/'.length)
    : null;

  const { nodes: treeNodes, edges } = useMemo(() => buildGraph(expandedIds, activePath), [expandedIds, activePath]);

  // Jaanboojh ke `windows` is function ki dependency NAHI hai — agar hoti,
  // tw har windows-change pe closeWindow ka naya reference banta, jo aage
  // windowNodes -> allNodes -> ReactFlow re-render tak cascade karke ek
  // INFINITE LOOP bana deta tha (yehi asal bug tha — "kuch khulta hi nahi"
  // dikhta tha kyunke page render-loop me hi atka reh jata tha). "Active
  // screen band ho gayi tw kahan navigate karein" wala kaam ab neeche ek
  // alag, sirf-activePath-pe-depend karne wale useEffect me hai.
  const closeWindow = useCallback((path) => {
    setWindows((prev) => prev.filter((w) => w.path !== path));
  }, []);

  // Agar jo screen abhi active thi wahi close ho gayi, tw kisi baaki khuli
  // (accounts-)screen pe ya wapas khali canvas pe navigate kar dete hain.
  useEffect(() => {
    if (!activePath) return;
    const stillOpen = windows.some((w) => w.path === activePath);
    if (stillOpen) return;
    const fallback = [...windows].reverse().find((w) => w.kind !== 'excel');
    navigate(fallback ? `/canvas/${fallback.path}` : '/canvas', { replace: true });
  }, [windows, activePath, navigate]);

  // Naya window canvas ke abhi visible hisse ke center me spawn hota hai
  // (screenToFlowPosition — screen pixels ko flow-coordinates me convert
  // karta hai), taky zoom kitna bhi ho, window hamesha nazar aaye.
  const openWindow = useCallback(
    (path, label, icon) => {
      setWindows((prev) => {
        if (prev.some((w) => w.path === path)) return prev;
        const idx = prev.length;
        const center = screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
        return [
          ...prev,
          {
            path, label, icon, kind: 'screen',
            x: center.x - 260 + (idx % WINDOW_CASCADE) * 30,
            y: center.y - 200 + (idx % WINDOW_CASCADE) * 26,
            width: 520, height: 400,
          },
        ];
      });
      navigate(`/canvas/${path}`);
    },
    [navigate, screenToFlowPosition]
  );

  // Excel workspace singleton — dobara button dabao tw jo pehle se khula
  // hai wahi rehta hai (naya nahi banta).
  const openExcelWindow = useCallback(() => {
    setWindows((prev) => {
      if (prev.some((w) => w.kind === 'excel')) return prev;
      const idx = prev.length;
      const center = screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
      return [
        ...prev,
        {
          path: 'excel:main',
          label: 'Excel Workbook',
          icon: FileSpreadsheet,
          kind: 'excel',
          x: center.x - 380 + (idx % WINDOW_CASCADE) * 30,
          y: center.y - 260 + (idx % WINDOW_CASCADE) * 26,
          width: 820, height: 560,
        },
      ];
    });
  }, [screenToFlowPosition]);

  const focusWindow = useCallback(
    (win) => {
      if (win.kind !== 'excel' && win.path !== activePath) navigate(`/canvas/${win.path}`);
    },
    [navigate, activePath]
  );

  const handleNodeClick = useCallback(
    (_event, node) => {
      if (node.type === 'window') {
        // Sirf inactive window ko click se activate karte hain — active
        // window ke andar (form/report) click karne par baar baar
        // navigate() na ho.
        if (!node.data.isActive) focusWindow({ path: node.data.path, kind: node.data.kind });
        return;
      }
      const { hasChildren, path, label, icon } = node.data;
      if (hasChildren) {
        setExpandedIds((prev) => {
          const next = new Set(prev);
          if (next.has(node.id)) {
            for (const id of Array.from(next)) {
              if (id === node.id || id.startsWith(`${node.id}.`)) next.delete(id);
            }
          } else {
            next.add(node.id);
          }
          return next;
        });
      } else if (path) {
        openWindow(path, label, icon);
      }
    },
    [openWindow, focusWindow]
  );

  // Window ki drag/resize se aayi position/size changes wapas humari apni
  // "windows" state me likhni hain (tree/card nodes draggable:false hain,
  // unke liye yeh no-op rehta hai). Yeh dono field-shapes ("position"/
  // "dimensions") React Flow khud isi tarah emit karta hai (drag aur
  // NodeResizer dono se) — library source se confirm kiya hua.
  const handleNodesChange = useCallback((changes) => {
    const relevant = changes.filter((c) => c.id?.startsWith('win:'));
    if (!relevant.length) return;
    setWindows((prev) => {
      let next = prev;
      let changed = false;
      for (const c of relevant) {
        const path = c.id.slice(4);
        if (c.type === 'position' && c.position) {
          next = next.map((w) => {
            if (w.path !== path || (w.x === c.position.x && w.y === c.position.y)) return w;
            changed = true;
            return { ...w, x: c.position.x, y: c.position.y };
          });
        } else if (c.type === 'dimensions' && c.dimensions) {
          next = next.map((w) => {
            if (w.path !== path || (w.width === c.dimensions.width && w.height === c.dimensions.height)) return w;
            changed = true;
            return { ...w, width: c.dimensions.width, height: c.dimensions.height };
          });
        }
      }
      // Value-level no-op ho tw wahi purani array reference return karte
      // hain — React tab setState ko silently ignore kar deta hai, koi
      // re-render nahi hota. Yehi cheez feedback-loop ko rokti hai.
      return changed ? next : prev;
    });
  }, []);

  const windowNodes = useMemo(
    () =>
      windows.map((w) => ({
        id: `win:${w.path}`,
        type: 'window',
        position: { x: w.x, y: w.y },
        style: { width: w.width, height: w.height },
        data: {
          path: w.path,
          label: w.label,
          icon: w.icon,
          kind: w.kind,
          isActive: w.kind === 'excel' || w.path === activePath,
          onClose: () => closeWindow(w.path),
          onActivate: () => focusWindow(w),
        },
      })),
    [windows, activePath, closeWindow, focusWindow]
  );

  const allNodes = useMemo(() => [...treeNodes, ...windowNodes], [treeNodes, windowNodes]);

  // Expand/collapse hone par graph ka size badalta hai, aur jab bhi koi
  // naya window khulta hai (windows.length badalta hai) — dono cases me
  // view ko naye visible hisse (tree + saari khuli windows) ke around
  // re-center kar dete hain. Isse pehle sirf expand/collapse pe fit hota
  // tha, isliye naya window agar tight-zoomed view ke bahar spawn hota tw
  // dikhta hi nahi tha.
  useEffect(() => {
    const t = setTimeout(() => fitView({ padding: 0.2, duration: 300 }), 120);
    return () => clearTimeout(t);
  }, [expandedIds, windows.length, fitView]);

  return (
    <div className="accounts-canvas">
      <div className="ac-header">
        <button className="ac-back-btn" onClick={() => navigate('/dashboard')}>
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        <div className="ac-title">
          <Wallet className="w-5 h-5" />
          <h2>Accounts — Module Canvas</h2>
        </div>
        <p className="ac-subtitle">Figma/Canva jaisa canvas — zoom in/out karo, sab (nodes + screens) ek sath scale hote hain</p>
        <button className="ac-excel-btn" onClick={openExcelWindow}>
          <FileSpreadsheet className="w-4 h-4" />
          Excel
        </button>
      </div>

      <div className="ac-canvas-wrap">
        <ReactFlow
          nodes={allNodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodeClick={handleNodeClick}
          onNodesChange={handleNodesChange}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          nodesConnectable={false}
          elementsSelectable={true}
          panOnScroll
          zoomOnScroll={false}
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={18} color="#e2e8f0" />
          <Controls showInteractive={false} />
          <MiniMap pannable zoomable nodeColor="#93c5fd" maskColor="rgba(15,23,42,0.06)" />
        </ReactFlow>
      </div>
    </div>
  );
}

export default function AccountsCanvas() {
  return (
    <ReactFlowProvider>
      <AccountsCanvasInner />
    </ReactFlowProvider>
  );
}
