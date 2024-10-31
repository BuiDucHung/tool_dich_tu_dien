const express = require('express');
const path = require('path');
const axios = require('axios');
const fs = require('fs');
const multer = require('multer');
const xlsx = require('xlsx');
const router = express.Router();

// Đường dẫn đến file JSON
const jsonFilePath = path.join(__dirname, 'translations.json');
const upload = multer({ dest: 'uploads/' });

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
    return response.data || "";
  } catch (error) {
    return null;
  }
}

function extractEvents(eventStrings) {
  const events = eventStrings.trim().split('\n\n');
  return events.map(eventString => {
    const dataMatch = eventString.match(/data:\s*(.*)/);
    if (dataMatch && dataMatch[1]) {
      try {
        return JSON.parse(dataMatch[1]);
      } catch (error) {  
        return null;
      }
    }
    return null;
  }).filter(event => event !== null);
}

// API để tải lên file và xử lý từ
router.post('/upload', upload.single('file'), async (req, res) => {
  const file = req.file;
  if (!file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  const filePath = file.path;
  const workbook = xlsx.readFile(filePath, { type: 'file' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data = xlsx.utils.sheet_to_json(worksheet, { header: 1 });

  const result = data.map((row) => {
    return { name: row[0] };
  });

  let translations = [];
  let convertData = [];
  for (const word of result) {
    const translation = await fetchTranslation(word?.name);
    if (translation) {
      translations.push({ query: word, translation: translation });
    }
  }

  let jsonData = [];
  if (fs.existsSync(jsonFilePath)) {
    const fileContent = fs.readFileSync(jsonFilePath, 'utf8');
    jsonData = JSON.parse(fileContent);
  }

  jsonData.push(...translations);
  // Ghi dữ liệu mới vào file JSON
  for (const item of jsonData) {
    const parsedData1 = extractEvents(item.translation);
    convertData.push({
      query: item.query, translation: {
        phrase: parsedData1[2],
        dictionary: parsedData1[3]
      }
    })
  }
  fs.writeFileSync(jsonFilePath, JSON.stringify(convertData, null, '\t'), 'utf8');
  return res.json({ data: convertData });
});

router.get('/', (req, res) => {
  res.send(`
        <h2>Upload File</h2>
        <form action="/upload" method="POST" enctype="multipart/form-data">
          <input type="file" name="file" />
          <button type="submit">Upload</button>
        </form>
      `);
});

module.exports = router;
