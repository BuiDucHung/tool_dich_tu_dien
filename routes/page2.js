const express = require('express');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const FormData = require('form-data');
const xlsx = require('xlsx');
const router = express.Router();
const multer = require('multer');
// import { jsonDataPlaceholder } from './data';

const jsonFilePathFile = path.join(__dirname, 'transitionData.json');
const upload = multer({ dest: 'uploads/' });

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchTranslationYoudao(query) {
	console.log('query', query);
  try {
    const formData = new FormData();
    formData.append('q', query);
    formData.append('le', 'en');
    formData.append('t', '9');
    formData.append('client', 'web');
    formData.append('keyfrom', 'webdict');
    const response = await axios.post('https://dict.youdao.com/jsonapi_s?doctype=json&jsonversion=4', formData, {
      headers: formData.getHeaders(),
    });
    const rawData = response.data || {};

    // xóa phần "aligned-words" nếu tồn tại
    rawData?.blng_sents_part?.['sentence-pair'].map(item => {
      delete item["aligned-words"];
      return item;
    });
    // Loại bỏ thẻ html khi xuất ra file excel
    // Loại bỏ thẻ HTML
    rawData.video_sents.sents_data = rawData.video_sents.sents_data.map(item => {
      const cleanedSrt = item.subtitle_srt
        .replace(/\r?\n|\r/g, ' ')  // Loại bỏ ký tự xuống dòng
        .replace(/\s+/g, ' ')       // Loại bỏ nhiều khoảng trắng liên tiếp
        .trim();                    // Loại bỏ khoảng trắng thừa ở đầu và cuối
      return {
        ...item,
        subtitle_srt: cleanedSrt.replace(/<[^>]*>/g, '') // Loại bỏ thẻ HTML
      };
    });

    if (rawData.aligned_words) {
      delete rawData.aligned_words;
    }
    if (rawData.oxfordAdvanceHtml) {
      delete rawData.oxfordAdvanceHtml;
    }
    if (rawData.oxford) {
      delete rawData.oxford;
    }
    if (rawData.webster) {
      delete rawData.webster;
    }
    if (rawData.senior) {
      delete rawData.senior;
    }
    if (rawData.oxfordAdvance) {
      delete rawData.oxfordAdvance;
    }
    if (rawData.wordElaboration) {
      delete rawData.wordElaboration;
    }
    let jsonData = [];
    if (fs.existsSync(jsonFilePathFile)) {
      const fileContent = fs.readFileSync(jsonFilePathFile, 'utf8');
      jsonData = JSON.parse(fileContent);
    }
		// xử lý lại mảng data
		const newItem = {
			"Phiên âm (simple)": rawData.simple,
			"Ngắn gọn (word_info)": rawData.video_sents.word_info,
			"Từ điển (collins)": rawData.collins,
			"Exam_type": rawData.exam_type,
			"Cụm từ: (网络释义)": rawData.web_trans,
			"Phiên dịch chuyên nghiệp (专业释义)": rawData.special,
			"Phiên dịch anh-anh (英英释义)": rawData.ee,
			"Ví dụ song ngữ (双语例句)": rawData.blng_sents_part,
			"Ví dụ câu gốc (原声例句)": rawData.media_sents_part,
			"Ví dụ có thẩm quyền (权威例句)": rawData.auth_sents_part,
			"Cụm từ từ điển (词典短语)": rawData.phrs,
			"Từ đồng nghĩa (同近义词)": rawData.syno
		}
    jsonData.push(newItem);
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
    try {
      const translation = await fetchTranslationYoudao(word?.name);
      if (translation) {
        translations.push(translation);  // Đẩy vào mảng translations
      } else {
        console.log("No translation for:", word.name);
      }

      // Chờ 2 giây trước khi tiếp tục lần lặp tiếp theo
      console.log("Waiting 2 seconds...");
      await delay(2000);
    } catch (error) {
      console.error("Error processing word:", word.name, error);
    }
  }

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


