import fetch from 'node-fetch';

export default async function handler(req, res) {
  const { mylistId } = req.query;

  try {
    const response = await fetch(`https://export.nicovideo.jp/mylist/${mylistId}?rss=2.0`);
    const text = await response.text();
    res.setHeader('Content-Type', 'application/xml');
    res.status(200).send(text);
  } catch (error) {
    console.error(error); // ★エラーも出しておくと良い
    res.status(500).json({ error: 'Failed to fetch mylist info' });
  }
}
