export default async function handler(req, res) {
  const { videoId } = req.query;
  const response = await fetch(`https://ext.nicovideo.jp/api/getthumbinfo/${videoId}`);
  const text = await response.text();
  res.setHeader('Content-Type', 'application/xml');
  res.status(200).send(text);
}
