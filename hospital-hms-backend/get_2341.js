const { Dates, DatesTo } = { Dates: "2026/02/01", DatesTo: "2026/03/12" };
const url = 'http://cloud.intellitech.com.pk:30565/API/Product/read.php?action=allempdaterange565';
fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ Dates, DatesTo })
}).then(r => r.json()).then(d => {
  const e = (d.data || []).filter(x => x.staff_id == "2341");
  console.log("Records for 2341:", e.length);
}).catch(console.error);
