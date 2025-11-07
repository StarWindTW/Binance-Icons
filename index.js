const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3002;

// 啟用 CORS
app.use(cors({
  origin: '*',
  methods: ['GET'],
  allowedHeaders: ['Content-Type'],
}));

// 生成或更新 manifest.json
function updateManifest() {
  try {
    const iconsDir = path.join(__dirname, 'icons');
    
    if (!fs.existsSync(iconsDir)) {
      return;
    }

    const files = fs.readdirSync(iconsDir);
    const cryptoIcons = [];
    const iconDetails = [];
    
    files.forEach(file => {
      if (/\.(png|svg|jpg|jpeg)$/i.test(file)) {
        const ext = path.extname(file);
        const symbol = path.basename(file, ext).toUpperCase();
        cryptoIcons.push(symbol);
        iconDetails.push({
          symbol,
          format: ext.substring(1),
          url: `/icons/${symbol}`,
          cdnUrl: `${process.env.BASE_URL || 'http://localhost:3002'}/icons/${symbol}`
        });
      }
    });

    const manifest = {
      name: 'binance-icons-collection',
      version: '1.0.0',
      description: 'Cryptocurrency icons from Binance',
      crypto: cryptoIcons.sort(),
      icons: iconDetails,
      totalIcons: cryptoIcons.length,
      formats: ['png', 'svg'],
      lastUpdated: new Date().toISOString()
    };

    fs.writeFileSync(
      path.join(__dirname, 'manifest.json'), 
      JSON.stringify(manifest, null, 2)
    );
    
    console.log(`✅ Manifest updated: ${cryptoIcons.length} icons`);
  } catch (error) {
    console.error('Error updating manifest:', error);
  }
}

// 啟動時更新 manifest
updateManifest();

// 首頁 / API 文檔
app.get('/', (req, res) => {
  res.json({
    name: 'Crypto Icon API',
    version: '1.0.0',
    endpoints: {
      manifest: '/manifest.json',
      icon: '/icons/:symbol',
      list: '/icons',
      search: '/search?q=btc',
      health: '/health'
    },
    usage: {
      cdn: `${process.env.BASE_URL || 'http://localhost:3002'}/icons/BTC`,
      jsdelivr: 'https://cdn.jsdelivr.net/gh/YOUR_USERNAME/crypto-icons/icons/BTC.png',
      example: '/icons/BTC',
      formats: ['png', 'svg', 'jpg', 'jpeg']
    },
    github: {
      note: 'After deploying to GitHub, you can use jsdelivr CDN:',
      example: 'https://cdn.jsdelivr.net/gh/YOUR_USERNAME/crypto-icons/icons/BTC.png'
    }
  });
});

// 健康檢查
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// 獲取 manifest.json
app.get('/manifest.json', (req, res) => {
  try {
    const manifestPath = path.join(__dirname, 'manifest.json');
    
    if (!fs.existsSync(manifestPath)) {
      updateManifest();
    }
    
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    res.json(manifest);
  } catch (error) {
    console.error('Error reading manifest:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 列出所有可用的圖標
app.get('/icons', (req, res) => {
  try {
    const iconsDir = path.join(__dirname, 'icons');
    
    if (!fs.existsSync(iconsDir)) {
      return res.status(404).json({ error: 'Icons directory not found' });
    }

    const files = fs.readdirSync(iconsDir);
    const icons = files
      .filter(file => /\.(png|svg|jpg|jpeg)$/i.test(file))
      .map(file => {
        const ext = path.extname(file);
        const symbol = path.basename(file, ext);
        return {
          symbol,
          format: ext.substring(1),
          url: `/icons/${symbol}`
        };
      });

    res.json({
      total: icons.length,
      icons: icons
    });
  } catch (error) {
    console.error('Error listing icons:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 獲取特定圖標
app.get('/icons/:symbol', (req, res) => {
  try {
    const symbol = req.params.symbol.toUpperCase();
    const iconsDir = path.join(__dirname, 'icons');
    
    // 嘗試不同的圖片格式
    const formats = ['png', 'svg', 'jpg', 'jpeg'];
    
    for (const format of formats) {
      const iconPath = path.join(iconsDir, `${symbol}.${format}`);
      
      if (fs.existsSync(iconPath)) {
        const contentType = format === 'svg' 
          ? 'image/svg+xml' 
          : `image/${format}`;
        
        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        res.setHeader('Access-Control-Allow-Origin', '*');
        
        return res.sendFile(iconPath);
      }
    }
    
    res.status(404).json({ 
      error: 'Icon not found',
      symbol: symbol,
      searched_formats: formats
    });
    
  } catch (error) {
    console.error('Error serving icon:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 搜索圖標
app.get('/search', (req, res) => {
  try {
    const query = req.query.q?.toLowerCase() || '';
    const iconsDir = path.join(__dirname, 'icons');
    
    if (!query) {
      return res.status(400).json({ error: 'Query parameter "q" is required' });
    }

    if (!fs.existsSync(iconsDir)) {
      return res.status(404).json({ error: 'Icons directory not found' });
    }

    const files = fs.readdirSync(iconsDir);
    const icons = files
      .filter(file => {
        const symbol = path.basename(file, path.extname(file)).toLowerCase();
        return symbol.includes(query) && /\.(png|svg|jpg|jpeg)$/i.test(file);
      })
      .map(file => {
        const ext = path.extname(file);
        const symbol = path.basename(file, ext);
        return {
          symbol,
          format: ext.substring(1),
          url: `/icons/${symbol}`
        };
      });

    res.json({
      query,
      total: icons.length,
      icons: icons
    });
  } catch (error) {
    console.error('Error searching icons:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 404 處理
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// 啟動服務器
app.listen(PORT, () => {
  console.log(`🚀 Crypto Icon API is running on http://localhost:${PORT}`);
  console.log(`📖 API Documentation: http://localhost:${PORT}`);
  console.log(`🔍 Health Check: http://localhost:${PORT}/health`);
  console.log(`📂 Icons List: http://localhost:${PORT}/icons`);
  console.log(`🎨 Icon Example: http://localhost:${PORT}/icons/BTC`);
  console.log(`📋 Manifest: http://localhost:${PORT}/manifest.json`);
});
