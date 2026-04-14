const { Dates, DatesTo } = { Dates: "2026/04/12", DatesTo: "2026/04/13" };
const url = 'http://cloud.intellitech.com.pk:30565/API/Product/read.php?action=allempdaterange565';
fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ Dates, DatesTo })
}).then(r => r.json()).then(d => {
  const records = d.data || [];
  const emp251 = records.filter(r => r.enrollid == "251");
  console.log("Punches for 251 on 04/12 - 04/13:", emp251.length);
}).catch(console.error);
