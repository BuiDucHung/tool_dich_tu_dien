const express = require('express');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const FormData = require('form-data');
const xlsx = require('xlsx');
const router = express.Router();
const multer = require('multer');

const jsonFilePathFile = path.join(__dirname, 'transitionData.json');
const upload = multer({ dest: 'uploads/' });

async function fetchTranslationYoudao(query) {
  try {
    const formData = new FormData();
    formData.append('q', query);
    formData.append('le', 'fr');
    formData.append('t', '8');
    formData.append('client', 'web');
    formData.append('keyfrom', 'webdict');

    const response = await axios.post('https://dict.youdao.com/jsonapi_s?doctype=json&jsonversion=4', formData, {
      headers: formData.getHeaders(),
    });
    const rawData = response.data || {};

    let jsonData = [];
    if (fs.existsSync(jsonFilePathFile)) {
      const fileContent = fs.readFileSync(jsonFilePathFile, 'utf8');
      jsonData = JSON.parse(fileContent);
    }

    jsonData.push(rawData);
    fs.writeFileSync(jsonFilePathFile, JSON.stringify(jsonData, null, '\t'), 'utf8');
    return rawData;
  } catch (error) {
    console.error('Error fetching translation:', error);
    return null;
  }
}

/* upload form thứ hai api thứ 2 */
router.post('/upload2', upload.single('file'), async (req, res) => {
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
  for (const word of result) {
    const translation = await fetchTranslationYoudao(word?.name);
    if (translation) {
      translations.push(translation); // Đẩy vào mảng translations
    }
  }
  // console.log('Translations:', translations);
  // Trả về kết quả dịch
  return res.json({ translations });
});

router.get('/', (req, res) => {
  res.send(`
      <h2>Upload File số 2</h2>
      <form action="/page2/upload2" method="POST" enctype="multipart/form-data">
        <input type="file" name="file" />
        <button type="submit">Upload</button>
      </form>
  `);
});

module.exports = router;


