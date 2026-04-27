const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const ACCEPTED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/tiff',
  'image/bmp',
  'image/avif',
  'image/heic',
  'image/heif',
  'image/webp',
];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter(_req, file, cb) {
    if (ACCEPTED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}`));
    }
  },
});

app.use(express.static(path.join(__dirname, 'public')));

app.post('/convert', upload.array('images', 20), async (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No files uploaded.' });
  }

  const quality = Math.min(100, Math.max(1, parseInt(req.body.quality, 10) || 80));
  const lossless = req.body.lossless === 'true';

  const resizeWidth  = parseInt(req.body.resizeWidth, 10)  || null;
  const resizeHeight = parseInt(req.body.resizeHeight, 10) || null;
  const maintainAR   = req.body.maintainAR !== 'false';
  const noUpscale    = req.body.noUpscale  !== 'false';

  try {
    const results = await Promise.all(
      req.files.map(async (file) => {
        const baseName = path.parse(file.originalname).name;

        let pipeline = sharp(file.buffer);

        if (resizeWidth || resizeHeight) {
          const resizeOpts = {
            width:  resizeWidth  || undefined,
            height: resizeHeight || undefined,
            withoutEnlargement: noUpscale,
          };
          if (resizeWidth && resizeHeight) {
            resizeOpts.fit = maintainAR ? 'inside' : 'fill';
          }
          pipeline = pipeline.resize(resizeOpts);
        }

        const { data: webpBuffer, info } = await pipeline
          .webp({ quality, lossless })
          .toBuffer({ resolveWithObject: true });

        return {
          originalName: file.originalname,
          outputName: `${baseName}.webp`,
          data: webpBuffer.toString('base64'),
          originalSize: file.size,
          convertedSize: webpBuffer.length,
          outputWidth: info.width,
          outputHeight: info.height,
        };
      })
    );

    res.json({ files: results });
  } catch (err) {
    console.error('Conversion error:', err);
    res.status(500).json({ error: 'Conversion failed. The file may be corrupt or unsupported.' });
  }
});

// Multer error handler
app.use((err, _req, res, _next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'File too large. Maximum size is 20 MB.' });
  }
  res.status(400).json({ error: err.message });
});

app.listen(PORT, () => {
  console.log(`TCLP Image Converter running at http://localhost:${PORT}`);
});
