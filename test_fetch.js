const http = require('http');

http.get('http://localhost:5001/api/employees', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log(JSON.parse(data).data.length));
});
