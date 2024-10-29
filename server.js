const express = require('express');
const path = require('path');
const axios = require('axios');
const fs = require('fs');
const multer = require('multer');
const xlsx = require('xlsx');
const app = express();
const PORT = 3000;

app.use(express.json());

// Đường dẫn đến file JSON
const jsonFilePath = path.join(__dirname, 'translations.json');

const upload = multer({ dest: 'uploads/' });
// Hàm để lấy dữ liệu từ Baidu Fanyi
async function fetchTranslation(query) {
  try {
    const response = await axios.post('https://fanyi.baidu.com/ait/text/translate', {
      query: query,
      from: 'zh',
      to: 'en',
      reference: '',
      corpusIds: [],
      needPhonetic: true,
      domain: 'common',
      milliTimestamp: Date.now(),
    }, {
      headers: {
        'Content-Type': 'application/json',
      },
    });
    // Giả sử response.data có chuỗi event như bạn đã cung cấp
    const rawData = response.data || "";
    return rawData;
  } catch (error) {
    return null;
  }
}

function extractEvents(eventStrings) {
  const events = eventStrings.trim().split('\n\n'); // Tách theo dòng trống
  return events.map(eventString => {
    const dataMatch = eventString.match(/data:\s*(.*)/);
    if (dataMatch && dataMatch[1]) {
      try {
        return JSON.parse(dataMatch[1]); // Parse phần dữ liệu JSON
      } catch (error) {
        console.error("Invalid JSON format", error);
        return null;
      }
    }
    return null;
  }).filter(event => event !== null); // Lọc ra các sự kiện không hợp lệ
}


// API endpoint để nhập từ và lấy dữ liệu
// app.post('/translate', async (req, res) => {
//   const { word } = req.body; // Nhận từ duy nhất từ body
//   if (!word) {
//     return res.status(400).json({ error: 'No word provided' });
//   }
//   const translation = await fetchTranslation(word);
//   if (translation) {
//     // Tạo đối tượng cho JSON
//     const record = { query: word, translation: translation.toString() }; // Chuyển đổi thành chuỗi nếu cần
//     // Đọc file JSON hiện tại (nếu tồn tại)
//     let jsonData = [];
//     if (fs.existsSync(filePath)) {
//       const fileContent = fs.readFileSync(filePath);
//       jsonData = JSON.parse(fileContent);
//     }
//     // Thêm bản ghi mới vào dữ liệu
//     jsonData.push(record);
//     // Ghi dữ liệu mới vào file JSON
//     fs.writeFileSync(filePath, JSON.stringify(jsonData, null, 2), 'utf8');
//     return res.json(record);
//   } else {
//     return res.status(500).json({ error: 'Failed to fetch translation' });
//   }
// });

// API để tải lên file và xử lý từ
app.post('/upload', upload.single('file'), async (req, res) => {
  const file = req.file;
  if (!file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  const filePath = file.path;
  // Đọc file ODS bằng thư viện xlsx
  const workbook = xlsx.readFile(filePath, { type: 'file' });
  const sheetName = workbook.SheetNames[0]; // Lấy tên của sheet đầu tiên
  const worksheet = workbook.Sheets[sheetName]; // Lấy nội dung của sheet đó
  const data = xlsx.utils.sheet_to_json(worksheet, { header: 1 }); // Chuyển đổi thành mảng với từng dòng là 1 mảng con

  if (data.length < 2) { // Kiểm tra ít nhất phải có tiêu đề và 1 dòng dữ liệu
    return res.status(400).json({ error: 'File must contain at least one row of data' });
  }
  // Lấy tiêu đề và giá trị từ dòng đầu tiên
  const headers = data[0]; // Lấy dòng đầu tiên làm tiêu đề // Lấy dòng thứ hai làm giá trị
  const result = data.map((row) => {
    return { [headers[0]]: row[0] }; // Tạo đối tượng với tiêu đề là key
  });
  // Mảng để chứa bản dịch
  let translations = [];
  let convertData = [];
  for (const word of result) {
    const translation = await fetchTranslation(word?.study);
    if (translation) {
      translations.push({ query: word, translation: translation });
    }
  }

  // Đọc nội dung hiện có từ file JSON (nếu có)
  let jsonData = [];
  if (fs.existsSync(jsonFilePath)) {
    const fileContent = fs.readFileSync(jsonFilePath, 'utf8');
    jsonData = JSON.parse(fileContent);
  }

  // Thêm bản ghi mới vào dữ liệu JSON hiện có
  jsonData.push(...translations);
  // Ghi dữ liệu mới vào file JSON
 for (const item of jsonData) {
  const parsedData1 = extractEvents(item.translation);
  convertData.push({ query: item.query, translation: parsedData1[3] })
 }
  fs.writeFileSync(jsonFilePath, JSON.stringify(convertData, null, '\t'), 'utf8');
  // Trả về dữ liệu dịch đã lưu vào file JSON
  return res.json({ data: convertData });
});

// Tạo trang HTML để tải lên file
app.get('/', (req, res) => {
  res.send(`
    <h2>Upload File</h2>
    <form action="/upload" method="POST" enctype="multipart/form-data">
      <input type="file" name="file" />
      <button type="submit">Upload</button>
    </form>
  `);
});

// Khởi động server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
