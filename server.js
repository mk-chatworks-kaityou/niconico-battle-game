const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.static(__dirname));

// プロキシ：マイリストRSS取得
app.get('/api/mylist/:mylistId', async (req, res) => {
  const mylistId = req.params.mylistId;
  const url = `https://www.nicovideo.jp/mylist/${mylistId}?rss=2.0`;

  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" }
    });
    const data = await response.text();
    res.send(data);
  } catch (error) {
    console.error(error);
    res.status(500).send('Error fetching mylist RSS');
  }
});

// プロキシ：getthumbinfo取得
app.get('/api/getthumbinfo/:videoId', async (req, res) => {
  const videoId = req.params.videoId;
  const url = `https://ext.nicovideo.jp/api/getthumbinfo/${videoId}`;

  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" }
    });
    const data = await response.text();
    res.send(data);
  } catch (error) {
    console.error(error);
    res.status(500).send('Error fetching getthumbinfo');
  }
});

app.listen(PORT, () => {
  console.log(`サーバー起動！ http://localhost:${PORT}`);
});
