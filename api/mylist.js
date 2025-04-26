export default async function handler(req, res) {
  const { mylistId } = req.query;
  const response = await fetch(`https://export.nicovideo.jp/mylist/${mylistId}?rss=2.0`);
  const text = await response.text();
  res.setHeader('Content-Type', 'application/xml');
  res.status(200).send(text);
}
