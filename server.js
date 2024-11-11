const express = require('express');
const app = express();
const PORT = 3005;

app.use(express.json());

const page1Router = require('./routes/page1');
const page2Router = require('./routes/page2');
app.use('/', page1Router);
app.use('/page2', page2Router);

// Khởi động server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});




/* API dịch từ tiếng trung sang anh https://www.iciba.com/_next/data/uGKktS1eP3HVzdLazkkJY/word.json?w=简明 
  https://hanzii.net/search/word/study?hl=en
*/
