/* eslint-disable react/prop-types */

export const MasterSetupIllustration = () => (
  <svg viewBox="0 0 160 130" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    {/* Monitor */}
    <rect x="6" y="28" width="72" height="52" rx="5" fill="#1e3a5f"/>
    <rect x="10" y="32" width="64" height="44" rx="3" fill="#3b82f6" opacity="0.85"/>
    <rect x="15" y="38" width="36" height="3" rx="1.5" fill="white" opacity="0.9"/>
    <rect x="15" y="45" width="26" height="3" rx="1.5" fill="#bfdbfe"/>
    <rect x="15" y="52" width="32" height="3" rx="1.5" fill="white" opacity="0.9"/>
    <rect x="15" y="59" width="20" height="3" rx="1.5" fill="#bfdbfe"/>
    <rect x="15" y="66" width="28" height="3" rx="1.5" fill="white" opacity="0.9"/>
    <rect x="36" y="80" width="12" height="9" rx="1" fill="#1e3a5f" opacity="0.7"/>
    <rect x="28" y="89" width="28" height="4" rx="2" fill="#1e3a5f" opacity="0.7"/>
    {/* Large gear */}
    <g transform="translate(118, 72)">
      <circle r="32" fill="#dbeafe" stroke="#1e40af" strokeWidth="3.5"/>
      <circle r="17" fill="#93c5fd" stroke="#1e40af" strokeWidth="2.5"/>
      <circle r="7" fill="#1e40af"/>
      {[0,45,90,135,180,225,270,315].map((a, i) => (
        <rect key={i} x="-5" y="-36" width="10" height="12" rx="3" fill="#1e40af" transform={`rotate(${a})`}/>
      ))}
    </g>
    {/* Small gear */}
    <g transform="translate(85, 30)">
      <circle r="19" fill="#fef3c7" stroke="#d97706" strokeWidth="2.5"/>
      <circle r="10" fill="#fde68a" stroke="#d97706" strokeWidth="2"/>
      <circle r="4" fill="#d97706"/>
      {[0,60,120,180,240,300].map((a, i) => (
        <rect key={i} x="-3.5" y="-23" width="7" height="9" rx="2" fill="#d97706" transform={`rotate(${a})`}/>
      ))}
    </g>
    {/* Wrench */}
    <g transform="translate(12, 100) rotate(-38)">
      <rect x="-3.5" y="-38" width="7" height="48" rx="3.5" fill="#f97316"/>
      <circle cx="0" cy="-38" r="10" fill="none" stroke="#f97316" strokeWidth="4.5"/>
      <rect x="-10" y="-43" width="20" height="7" rx="2" fill="#f97316"/>
      <circle cx="0" cy="12" r="9" fill="#f97316"/>
    </g>
  </svg>
);

export const PurchaseOrderIllustration = () => (
  <svg viewBox="0 0 160 130" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    {/* PO Document */}
    <rect x="10" y="12" width="62" height="80" rx="5" fill="white" stroke="#cbd5e1" strokeWidth="1.5"/>
    <rect x="10" y="12" width="62" height="20" rx="5" fill="#1e40af"/>
    <rect x="10" y="26" width="62" height="6" fill="#1e40af"/>
    <text x="18" y="26" fontSize="8" fontWeight="bold" fill="white" fontFamily="Arial, sans-serif">PURCHASE ORDER</text>
    <rect x="18" y="40" width="42" height="3" rx="1.5" fill="#94a3b8"/>
    <rect x="18" y="48" width="32" height="3" rx="1.5" fill="#94a3b8"/>
    <rect x="18" y="56" width="38" height="3" rx="1.5" fill="#94a3b8"/>
    <rect x="18" y="64" width="28" height="3" rx="1.5" fill="#94a3b8"/>
    <rect x="18" y="72" width="36" height="3" rx="1.5" fill="#94a3b8"/>
    <rect x="18" y="80" width="24" height="3" rx="1.5" fill="#94a3b8"/>
    <circle cx="60" cy="68" r="15" fill="none" stroke="#22c55e" strokeWidth="3" strokeDasharray="4 2.5"/>
    <path d="M 52 68 L 58 74 L 68 60" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    {/* Shopping cart */}
    <g transform="translate(118, 72)">
      <path d="M -28 -30 L -18 -30 L -8 8 L 26 8 L 32 -18 L -10 -18"
        stroke="#1e3a5f" strokeWidth="3.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="-4" cy="18" r="7" fill="#1e3a5f" opacity="0.85"/>
      <circle cx="22" cy="18" r="7" fill="#1e3a5f" opacity="0.85"/>
      <circle cx="-4" cy="18" r="3.5" fill="#93c5fd"/>
      <circle cx="22" cy="18" r="3.5" fill="#93c5fd"/>
      <rect x="-5" y="-28" width="10" height="10" rx="2.5" fill="#f97316" opacity="0.9"/>
      <rect x="8" y="-28" width="10" height="10" rx="2.5" fill="#22c55e" opacity="0.9"/>
      <rect x="1" y="-28" width="10" height="10" rx="2.5" fill="#fbbf24" opacity="0.9"/>
    </g>
    {/* Coins */}
    <ellipse cx="130" cy="110" rx="18" ry="6" fill="#d97706" opacity="0.5"/>
    <ellipse cx="130" cy="104" rx="18" ry="6" fill="#fbbf24"/>
    <ellipse cx="130" cy="98" rx="18" ry="6" fill="#fcd34d"/>
    <text x="122" y="102" fontSize="7" fontWeight="bold" fill="#92400e" fontFamily="Arial, sans-serif">PKR</text>
  </svg>
);

export const ReceivingGRNIllustration = () => (
  <svg viewBox="0 0 160 130" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <rect x="0" y="106" width="160" height="10" rx="2" fill="#cbd5e1" opacity="0.4"/>
    {/* Truck body */}
    <rect x="4" y="56" width="80" height="50" rx="4" fill="#1e3a5f"/>
    <rect x="8" y="60" width="72" height="42" rx="3" fill="#3b82f6" opacity="0.65"/>
    {/* Cab */}
    <rect x="84" y="72" width="50" height="34" rx="4" fill="#1e3a5f"/>
    <rect x="89" y="76" width="28" height="18" rx="3" fill="#bfdbfe" opacity="0.9"/>
    {/* Wheels */}
    <circle cx="28" cy="110" r="13" fill="#334155"/>
    <circle cx="28" cy="110" r="6" fill="#94a3b8"/>
    <circle cx="68" cy="110" r="13" fill="#334155"/>
    <circle cx="68" cy="110" r="6" fill="#94a3b8"/>
    <circle cx="116" cy="110" r="11" fill="#334155"/>
    <circle cx="116" cy="110" r="5" fill="#94a3b8"/>
    {/* Box 1 */}
    <rect x="108" y="60" width="38" height="34" rx="3" fill="#d97706"/>
    <rect x="108" y="60" width="38" height="34" rx="3" fill="none" stroke="#92400e" strokeWidth="1.5"/>
    <line x1="127" y1="60" x2="127" y2="94" stroke="#92400e" strokeWidth="1.5" opacity="0.5"/>
    <line x1="108" y1="77" x2="146" y2="77" stroke="#92400e" strokeWidth="1.5" opacity="0.5"/>
    {/* Box 2 - stacked */}
    <rect x="113" y="30" width="33" height="30" rx="3" fill="#f59e0b"/>
    <rect x="113" y="30" width="33" height="30" rx="3" fill="none" stroke="#92400e" strokeWidth="1.5"/>
    <line x1="130" y1="30" x2="130" y2="60" stroke="#92400e" strokeWidth="1.5" opacity="0.5"/>
    <line x1="113" y1="45" x2="146" y2="45" stroke="#92400e" strokeWidth="1.5" opacity="0.5"/>
    {/* Checkmark badge */}
    <circle cx="28" cy="28" r="20" fill="#22c55e"/>
    <path d="M 18 28 L 25 36 L 38 18" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
  </svg>
);

export const IssuanceGINIllustration = () => (
  <svg viewBox="0 0 160 130" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    {/* Clipboard */}
    <rect x="8" y="16" width="65" height="90" rx="5" fill="white" stroke="#94a3b8" strokeWidth="1.5"/>
    <rect x="28" y="10" width="24" height="13" rx="3.5" fill="#334155"/>
    <rect x="8" y="28" width="65" height="14" rx="0" fill="#1e3a5f" opacity="0.9"/>
    <text x="14" y="39" fontSize="6.5" fontWeight="bold" fill="white" fontFamily="Arial, sans-serif">GOODS ISSUE NOTE</text>
    {/* Checklist */}
    <circle cx="19" cy="56" r="5" fill="none" stroke="#1e40af" strokeWidth="1.5"/>
    <rect x="28" y="53.5" width="36" height="3" rx="1.5" fill="#94a3b8"/>
    <circle cx="19" cy="68" r="5" fill="#22c55e"/>
    <path d="M 16 68 L 18.5 70.5 L 23 65.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
    <rect x="28" y="65.5" width="30" height="3" rx="1.5" fill="#94a3b8"/>
    <circle cx="19" cy="80" r="5" fill="#22c55e"/>
    <path d="M 16 80 L 18.5 82.5 L 23 77.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
    <rect x="28" y="77.5" width="38" height="3" rx="1.5" fill="#94a3b8"/>
    <circle cx="19" cy="92" r="5" fill="none" stroke="#1e40af" strokeWidth="1.5"/>
    <rect x="28" y="89.5" width="26" height="3" rx="1.5" fill="#94a3b8"/>
    {/* Arrows */}
    <path d="M 78 58 L 100 58" stroke="#1e3a5f" strokeWidth="3.5" strokeLinecap="round"/>
    <path d="M 94 51 L 102 58 L 94 65" stroke="#1e3a5f" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    <path d="M 78 78 L 100 78" stroke="#1e3a5f" strokeWidth="3.5" strokeLinecap="round"/>
    <path d="M 94 71 L 102 78 L 94 85" stroke="#1e3a5f" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    {/* Box */}
    <g transform="translate(130, 65)">
      <rect x="-24" y="-20" width="46" height="40" rx="3" fill="#d97706"/>
      <rect x="-24" y="-20" width="46" height="40" rx="3" fill="none" stroke="#92400e" strokeWidth="1.5"/>
      <path d="M -24 -20 L -1 -34 L 22 -20" fill="#f59e0b" stroke="#92400e" strokeWidth="1.5"/>
      <line x1="-1" y1="-34" x2="-1" y2="-20" stroke="#92400e" strokeWidth="1.5" opacity="0.6"/>
      <line x1="-24" y1="-3" x2="22" y2="-3" stroke="#92400e" strokeWidth="1" opacity="0.5"/>
    </g>
    {/* Department icon */}
    <circle cx="140" cy="22" r="12" fill="#3b82f6" opacity="0.85"/>
    <circle cx="140" cy="15" r="8" fill="#93c5fd"/>
    <path d="M 124 46 Q 140 32 156 46" fill="#3b82f6" opacity="0.85"/>
  </svg>
);

export const SalesInvoiceIllustration = () => (
  <svg viewBox="0 0 160 130" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    {/* Cash register */}
    <rect x="70" y="62" width="76" height="55" rx="5" fill="#1e3a5f"/>
    <rect x="73" y="46" width="70" height="20" rx="3" fill="#334155"/>
    {[0,1,2,3,4,5,6].map(i => (
      <rect key={i} x={76 + i*9} y="50" width="7" height="7" rx="2" fill={i % 2 === 0 ? '#93c5fd' : '#fbbf24'}/>
    ))}
    {[0,1,2,3,4,5,6].map(i => (
      <rect key={i} x={76 + i*9} y="60" width="7" height="4" rx="1.5" fill="#4b5563"/>
    ))}
    <rect x="80" y="66" width="56" height="20" rx="2" fill="#0f172a"/>
    <text x="84" y="79" fontSize="9" fill="#22c55e" fontFamily="monospace" fontWeight="bold">PKR 1,250</text>
    <rect x="73" y="90" width="70" height="10" rx="2" fill="#0f172a"/>
    <rect x="101" y="91" width="14" height="8" rx="1.5" fill="#334155"/>
    {/* Receipt strip out of register */}
    <rect x="121" y="20" width="16" height="30" rx="2" fill="white" stroke="#e2e8f0" strokeWidth="1"/>
    {[0,1,2,3].map(i => (
      <rect key={i} x="124" y={25 + i*6} width={i % 2 === 0 ? 10 : 7} height="2.5" rx="1" fill="#94a3b8"/>
    ))}
    <path d="M 121 50 Q 124 54 127 50 Q 130 46 133 50 Q 136 54 137 50 L 137 52 L 121 52 Z" fill="white"/>
    {/* Invoice document */}
    <rect x="8" y="10" width="52" height="68" rx="4" fill="white" stroke="#cbd5e1" strokeWidth="1.5"/>
    <rect x="8" y="10" width="52" height="16" rx="4" fill="#7c3aed"/>
    <rect x="8" y="21" width="52" height="5" fill="#7c3aed"/>
    <text x="16" y="23" fontSize="8" fontWeight="bold" fill="white" fontFamily="Arial, sans-serif">INVOICE</text>
    {[0,1,2,3,4].map(i => (
      <rect key={i} x="14" y={34 + i*9} width={i === 0 ? 36 : 28} height="3" rx="1.5" fill="#94a3b8"/>
    ))}
    <rect x="14" y="70" width="32" height="3" rx="1.5" fill="#7c3aed" opacity="0.8"/>
    {/* Coins */}
    <ellipse cx="40" cy="108" rx="22" ry="7" fill="#d97706" opacity="0.5"/>
    <ellipse cx="40" cy="100" rx="22" ry="7" fill="#fbbf24"/>
    <ellipse cx="40" cy="93" rx="22" ry="7" fill="#fcd34d"/>
    <text x="30" y="97" fontSize="8" fontWeight="bold" fill="#92400e" fontFamily="Arial, sans-serif">PKR</text>
  </svg>
);

export const DiscardGDNIllustration = () => (
  <svg viewBox="0 0 160 130" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    {/* Open damaged box */}
    <g transform="translate(68, 78)">
      <rect x="-32" y="0" width="64" height="46" rx="3" fill="#d97706"/>
      <rect x="-32" y="0" width="64" height="46" rx="3" fill="none" stroke="#92400e" strokeWidth="2"/>
      <path d="M -32 0 L -50 -22 L 0 -28 L 0 0 Z" fill="#f59e0b" stroke="#92400e" strokeWidth="1.5"/>
      <path d="M 32 0 L 50 -22 L 0 -28 L 0 0 Z" fill="#fbbf24" stroke="#92400e" strokeWidth="1.5"/>
      <line x1="-32" y1="22" x2="32" y2="22" stroke="#92400e" strokeWidth="1.5" opacity="0.5"/>
      <line x1="0" y1="0" x2="0" y2="46" stroke="#92400e" strokeWidth="1.5" opacity="0.5"/>
      <path d="M -22 10 L -11 22 M -11 10 L -22 22" stroke="#ef4444" strokeWidth="3" strokeLinecap="round"/>
      <path d="M 10 10 L 21 22 M 21 10 L 10 22" stroke="#ef4444" strokeWidth="3" strokeLinecap="round"/>
    </g>
    {/* Warning triangle */}
    <path d="M 24 40 L 6 74 L 42 74 Z" fill="#fbbf24" stroke="#d97706" strokeWidth="2"/>
    <rect x="22" y="50" width="4" height="13" rx="2" fill="#92400e"/>
    <circle cx="24" cy="68" r="2.5" fill="#92400e"/>
    {/* Return/recycle arrows */}
    <g transform="translate(128, 52)">
      <path d="M 0 -28 A 28 28 0 1 1 -28 0" stroke="#22c55e" strokeWidth="4" fill="none" strokeLinecap="round"/>
      <path d="M -5 -33 L 2 -26 L -6 -20" stroke="#22c55e" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      <text x="-15" y="5" fontSize="7.5" fontWeight="bold" fill="#15803d" fontFamily="Arial, sans-serif">RETURN</text>
    </g>
    {/* Trash bin */}
    <g transform="translate(22, 100)">
      <rect x="-13" y="-5" width="26" height="30" rx="3" fill="#ef4444" opacity="0.9"/>
      <rect x="-16" y="-11" width="32" height="7" rx="2" fill="#dc2626"/>
      <rect x="-5" y="-16" width="10" height="7" rx="2" fill="#dc2626"/>
      <line x1="-5" y1="1" x2="-5" y2="20" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.7"/>
      <line x1="0" y1="1" x2="0" y2="20" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.7"/>
      <line x1="5" y1="1" x2="5" y2="20" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.7"/>
    </g>
  </svg>
);

export const InventoryReportsIllustration = () => (
  <svg viewBox="0 0 160 130" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    {/* Chart board */}
    <rect x="4" y="8" width="100" height="106" rx="6" fill="white" stroke="#e2e8f0" strokeWidth="1.5" opacity="0.95"/>
    {[25,42,59,76,93].map(y => (
      <line key={y} x1="20" y1={y} x2="98" y2={y} stroke="#f1f5f9" strokeWidth="1"/>
    ))}
    {/* Bars */}
    <rect x="22" y="62" width="16" height="46" rx="3.5" fill="#93c5fd"/>
    <rect x="43" y="38" width="16" height="70" rx="3.5" fill="#3b82f6"/>
    <rect x="64" y="50" width="16" height="58" rx="3.5" fill="#93c5fd"/>
    <rect x="83" y="24" width="14" height="84" rx="3.5" fill="#1e40af"/>
    {/* Trend line */}
    <path d="M 30 60 L 51 36 L 72 48 L 90 22" stroke="#ef4444" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
    <circle cx="30" cy="60" r="3.5" fill="#ef4444"/>
    <circle cx="51" cy="36" r="3.5" fill="#ef4444"/>
    <circle cx="72" cy="48" r="3.5" fill="#ef4444"/>
    <circle cx="90" cy="22" r="3.5" fill="#ef4444"/>
    {/* Axes */}
    <line x1="18" y1="108" x2="100" y2="108" stroke="#334155" strokeWidth="2"/>
    <line x1="18" y1="10" x2="18" y2="108" stroke="#334155" strokeWidth="2"/>
    {/* Labels */}
    <text x="25" y="117" fontSize="6" fill="#64748b" fontFamily="Arial, sans-serif">Q1</text>
    <text x="46" y="117" fontSize="6" fill="#64748b" fontFamily="Arial, sans-serif">Q2</text>
    <text x="67" y="117" fontSize="6" fill="#64748b" fontFamily="Arial, sans-serif">Q3</text>
    <text x="85" y="117" fontSize="6" fill="#64748b" fontFamily="Arial, sans-serif">Q4</text>
    {/* Pie chart */}
    <g transform="translate(136, 40)">
      <circle r="24" fill="#dbeafe"/>
      <path d="M 0 0 L 0 -24 A 24 24 0 0 1 20.8 -12 Z" fill="#1e40af"/>
      <path d="M 0 0 L 20.8 -12 A 24 24 0 0 1 24 0 Z" fill="#3b82f6"/>
      <path d="M 0 0 L 24 0 A 24 24 0 0 1 -12 20.8 Z" fill="#93c5fd"/>
      <path d="M 0 0 L -12 20.8 A 24 24 0 0 1 0 -24 Z" fill="#bfdbfe"/>
      <circle r="9" fill="white"/>
    </g>
    {/* Magnifying glass */}
    <g transform="translate(130, 92)">
      <circle r="18" fill="#dbeafe" opacity="0.5"/>
      <circle r="18" fill="none" stroke="#334155" strokeWidth="4" opacity="0.9"/>
      <line x1="13" y1="13" x2="26" y2="26" stroke="#334155" strokeWidth="5" strokeLinecap="round"/>
      <rect x="-9" y="-4" width="6" height="14" rx="1.5" fill="#3b82f6" opacity="0.85"/>
      <rect x="-2" y="-10" width="6" height="20" rx="1.5" fill="#1e40af" opacity="0.85"/>
      <rect x="5" y="-2" width="6" height="12" rx="1.5" fill="#3b82f6" opacity="0.85"/>
    </g>
  </svg>
);

export const MaintenanceIllustration = () => (
  <svg viewBox="0 0 160 130" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    {/* Clipboard / MO sheet */}
    <rect x="6" y="18" width="54" height="72" rx="4" fill="white" stroke="#cbd5e1" strokeWidth="1.5"/>
    <rect x="6" y="18" width="54" height="16" rx="4" fill="#7c3aed"/>
    <rect x="6" y="28" width="54" height="6" fill="#7c3aed"/>
    <rect x="22" y="12" width="22" height="10" rx="3" fill="#6d28d9"/>
    <rect x="14" y="42" width="38" height="3" rx="1.5" fill="#94a3b8"/>
    <rect x="14" y="50" width="28" height="3" rx="1.5" fill="#94a3b8"/>
    <rect x="14" y="58" width="34" height="3" rx="1.5" fill="#94a3b8"/>
    <rect x="14" y="66" width="22" height="3" rx="1.5" fill="#94a3b8"/>
    {/* Status badge */}
    <rect x="14" y="74" width="36" height="10" rx="3" fill="#fef3c7"/>
    <rect x="17" y="77" width="7" height="4" rx="1" fill="#f59e0b"/>
    <rect x="27" y="78" width="20" height="2.5" rx="1" fill="#92400e" opacity="0.7"/>
    {/* Big wrench */}
    <g transform="translate(122, 68) rotate(-38)">
      <rect x="-5" y="-44" width="10" height="56" rx="5" fill="#7c3aed"/>
      <circle cx="0" cy="-44" r="14" fill="none" stroke="#7c3aed" strokeWidth="6"/>
      <rect x="-14" y="-51" width="28" height="10" rx="3" fill="#7c3aed"/>
      <circle cx="0" cy="14" r="12" fill="#7c3aed"/>
      <circle cx="0" cy="14" r="5" fill="white" opacity="0.4"/>
    </g>
    {/* Gear */}
    <g transform="translate(106, 36)">
      <circle r="20" fill="#ddd6fe" stroke="#6d28d9" strokeWidth="2.5"/>
      <circle r="11" fill="#a78bfa" stroke="#6d28d9" strokeWidth="2"/>
      <circle r="5" fill="#6d28d9"/>
      {[0,45,90,135,180,225,270,315].map((a, i) => (
        <rect key={i} x="-3.5" y="-23" width="7" height="8" rx="2" fill="#6d28d9" transform={`rotate(${a})`}/>
      ))}
    </g>
    {/* Screwdriver */}
    <g transform="translate(144, 100) rotate(40)">
      <rect x="-3" y="-36" width="6" height="44" rx="3" fill="#f97316"/>
      <rect x="-5" y="-36" width="10" height="14" rx="2" fill="#ea580c"/>
      <rect x="-2" y="8" width="4" height="12" rx="1" fill="#94a3b8"/>
    </g>
    {/* Repair spark */}
    <path d="M 70 90 L 78 78 L 74 82 L 82 68" stroke="#fbbf24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
  </svg>
);

export const MRNIllustration = () => (
  <svg viewBox="0 0 160 130" xmlns="http://www.w3.org/2020/svg" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    {/* Store shelf (destination) */}
    <rect x="4" y="96" width="68" height="6" rx="2" fill="#334155"/>
    <rect x="4" y="70" width="68" height="6" rx="2" fill="#334155"/>
    <rect x="4" y="44" width="68" height="6" rx="2" fill="#334155"/>
    <rect x="4" y="44" width="4" height="58" rx="2" fill="#334155"/>
    <rect x="68" y="44" width="4" height="58" rx="2" fill="#334155"/>
    {/* Items on shelf */}
    <rect x="10" y="78" width="14" height="18" rx="2" fill="#93c5fd"/>
    <rect x="27" y="80" width="14" height="16" rx="2" fill="#6ee7b7"/>
    <rect x="44" y="76" width="14" height="20" rx="2" fill="#fcd34d"/>
    <rect x="10" y="52" width="14" height="18" rx="2" fill="#a5b4fc"/>
    <rect x="27" y="54" width="14" height="16" rx="2" fill="#93c5fd"/>
    {/* Return arrow — curved, prominent */}
    <path d="M 118 38 C 148 38 155 65 140 82 C 128 96 108 98 90 90"
      stroke="#10b981" strokeWidth="5" fill="none" strokeLinecap="round"/>
    <path d="M 84 85 L 90 93 L 98 87" stroke="#10b981" strokeWidth="4"
      strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    {/* Returning box */}
    <g transform="translate(124, 65)">
      <rect x="-18" y="-16" width="36" height="32" rx="3" fill="#d97706"/>
      <rect x="-18" y="-16" width="36" height="32" rx="3" fill="none" stroke="#92400e" strokeWidth="1.5"/>
      <path d="M -18 -16 L -26 -28 L 0 -32 L 0 -16 Z" fill="#f59e0b" stroke="#92400e" strokeWidth="1"/>
      <path d="M 18 -16 L 26 -28 L 0 -32 L 0 -16 Z" fill="#fbbf24" stroke="#92400e" strokeWidth="1"/>
      <line x1="-18" y1="0" x2="18" y2="0" stroke="#92400e" strokeWidth="1" opacity="0.5"/>
      <line x1="0" y1="-16" x2="0" y2="16" stroke="#92400e" strokeWidth="1" opacity="0.5"/>
    </g>
    {/* MRN tag */}
    <rect x="88" y="104" width="64" height="20" rx="4" fill="#059669"/>
    <text x="96" y="118" fontSize="9" fontWeight="bold" fill="white" fontFamily="Arial, sans-serif">MRN</text>
    <rect x="128" y="108" width="18" height="4" rx="1.5" fill="white" opacity="0.6"/>
    <rect x="128" y="115" width="12" height="4" rx="1.5" fill="white" opacity="0.4"/>
    {/* Green check */}
    <circle cx="26" cy="32" r="13" fill="#059669" opacity="0.15"/>
    <circle cx="26" cy="32" r="13" fill="none" stroke="#059669" strokeWidth="2.5"/>
    <path d="M 19 32 L 24 37 L 33 25" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
  </svg>
);

export const FuelManagementIllustration = () => (
  <svg viewBox="0 0 160 130" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    {/* Fuel drum / barrel */}
    <ellipse cx="36" cy="38" rx="26" ry="10" fill="#1e3a5f"/>
    <rect x="10" y="38" width="52" height="56" fill="#1e4d7b"/>
    <ellipse cx="36" cy="94" rx="26" ry="10" fill="#1e3a5f"/>
    {/* Barrel rings */}
    <ellipse cx="36" cy="54" rx="26" ry="5" fill="none" stroke="#93c5fd" strokeWidth="2.5" opacity="0.5"/>
    <ellipse cx="36" cy="70" rx="26" ry="5" fill="none" stroke="#93c5fd" strokeWidth="2.5" opacity="0.5"/>
    <ellipse cx="36" cy="86" rx="26" ry="5" fill="none" stroke="#93c5fd" strokeWidth="2.5" opacity="0.5"/>
    {/* Fuel level inside barrel (fill indicator) */}
    <ellipse cx="36" cy="70" rx="23" ry="4" fill="#fbbf24" opacity="0.9"/>
    <rect x="13" y="70" width="46" height="24" fill="#fbbf24" opacity="0.3"/>
    <ellipse cx="36" cy="94" rx="23" ry="4" fill="#f59e0b" opacity="0.7"/>
    {/* Spout on top */}
    <rect x="32" y="26" width="8" height="14" rx="3" fill="#94a3b8"/>
    <rect x="28" y="24" width="16" height="6" rx="3" fill="#64748b"/>
    {/* Generator body */}
    <rect x="84" y="50" width="70" height="50" rx="6" fill="#374151"/>
    <rect x="84" y="50" width="70" height="50" rx="6" fill="none" stroke="#1f2937" strokeWidth="2"/>
    {/* Generator panel */}
    <rect x="90" y="58" width="28" height="34" rx="3" fill="#1f2937"/>
    <circle cx="104" cy="68" r="7" fill="none" stroke="#fbbf24" strokeWidth="2.5"/>
    <circle cx="104" cy="68" r="3" fill="#fbbf24"/>
    <rect x="92" y="80" width="8" height="5" rx="1.5" fill="#22c55e"/>
    <rect x="103" y="80" width="8" height="5" rx="1.5" fill="#ef4444"/>
    <rect x="92" y="88" width="19" height="3" rx="1" fill="#374151"/>
    {/* Exhaust pipe */}
    <rect x="148" y="44" width="6" height="22" rx="3" fill="#6b7280"/>
    <ellipse cx="151" cy="44" rx="3" ry="5" fill="#4b5563"/>
    {/* Exhaust smoke */}
    <circle cx="151" cy="34" r="5" fill="#9ca3af" opacity="0.4"/>
    <circle cx="155" cy="26" r="4" fill="#9ca3af" opacity="0.3"/>
    <circle cx="150" cy="18" r="3" fill="#9ca3af" opacity="0.2"/>
    {/* Power bolt */}
    <path d="M 126 56 L 120 72 L 126 72 L 118 90 L 136 68 L 128 68 Z"
      fill="#fbbf24" stroke="#d97706" strokeWidth="1"/>
    {/* Ground line */}
    <rect x="84" y="100" width="70" height="6" rx="3" fill="#1f2937" opacity="0.5"/>
    <line x1="84" y1="106" x2="154" y2="106" stroke="#374151" strokeWidth="1"/>
    {/* Fuel pipe from drum to generator */}
    <path d="M 62 72 Q 72 72 72 80 Q 72 90 84 90"
      stroke="#fbbf24" strokeWidth="3" fill="none" strokeLinecap="round" strokeDasharray="5 3"/>
  </svg>
);
