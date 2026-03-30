require('dotenv').config();
const app = require('./src/app');
const prisma = require('./src/config/db');

app.get('/', (req, res) => {
  res.json({ message: '🏥 Darul Shifa Imam Khomeini API Running!' });
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
