const { Dates, DatesTo } = { Dates: "2026/03/01", DatesTo: "2026/03/12" };
const url = 'http://cloud.intellitech.com.pk:30565/API/Product/read.php?action=allempdaterange565';
fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ Dates, DatesTo })
}).then(r => r.json()).then(d => {
  const empData = (d.data || []).filter(x => x.staff_id == "2341" || x.staff_id == "251");
  console.log("Records for 2341/251 in March:", empData.length);
  if(empData.length > 0) console.log("Sample:", empData[0]);
}).catch(console.error);
