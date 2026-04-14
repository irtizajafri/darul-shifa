const { Dates, DatesTo } = { Dates: "2026/02/01", DatesTo: "2026/02/28" };
const url = 'http://cloud.intellitech.com.pk:30565/API/Product/read.php?action=allempdaterange565';
fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ Dates, DatesTo })
}).then(r => r.json()).then(d => {
  console.log("Total records:", d.data ? d.data.length : 0);
  const empData = (d.data || []).filter(x => x.staff_id == "2341");
  console.log("Records for 2341:", empData.length);
  if(empData.length > 0) console.log("Sample:", empData[0]);
}).catch(console.error);
