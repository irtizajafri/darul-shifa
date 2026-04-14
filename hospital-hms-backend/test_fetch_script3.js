const { Dates, DatesTo } = { Dates: "2026/02/01", DatesTo: "2026/02/05" };
const url = 'http://cloud.intellitech.com.pk:30565/API/Product/read.php?action=allempdaterange565';
fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ Dates, DatesTo })
}).then(r => r.json()).then(d => {
  const ids = Array.from(new Set((d.data || []).map(x => x.staff_id)));
  console.log("Found Staff IDs:", ids.slice(0, 10).join(", "));
}).catch(console.error);
