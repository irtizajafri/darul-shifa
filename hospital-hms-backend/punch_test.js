const { Dates, DatesTo } = { Dates: "2026/01/31", DatesTo: "2026/02/06" };
const url = 'http://cloud.intellitech.com.pk:30565/API/Product/read.php?action=allempdaterange565';
fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ Dates, DatesTo })
}).then(r => r.json()).then(d => {
  const e = (d.data || []).filter(x => x.staff_id == "94181");
  console.log(e);
}).catch(console.error);
