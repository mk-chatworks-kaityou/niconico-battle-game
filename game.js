let player = null;
let enemies = [];
let allVideos = [];
let turnNumber = 1;
let battleNumber = 1;
let commentaryLog = [];  // 実況ログ用

const explosionSound = new Audio('assets/sounds/explosion.mp3');
const criticalSound = new Audio('assets/sounds/critical.mp3');

// マイリストIDから動画基本情報（ID・タイトル・サムネURL）取得
async function fetchMylistVideos(mylistId) {
  const response = await fetch(`/api/mylist?mylistId=${mylistId}`);
  const text = await response.text();
  const parser = new DOMParser();
  const xml = parser.parseFromString(text, "application/xml");
  const items = xml.getElementsByTagName("item");

  const videos = [];

  for (let item of items) {
    const titleEl = item.getElementsByTagName("title")[0];
    const linkEl = item.getElementsByTagName("link")[0];
    const thumbEl = item.getElementsByTagName("media:thumbnail")[0];

    if (!linkEl) continue;

    const link = linkEl.textContent;
    const idMatch = link.match(/watch\/([a-z0-9]+)/);
    if (!idMatch) continue;
    const id = idMatch[1];

    videos.push({
      id,
      title: titleEl?.textContent || "No Title",
      thumbnailUrl: thumbEl?.getAttribute("url") || "",
    });
  }

  return videos;
}

// 動画IDからステータス取得
async function fetchVideoStats(videoId) {
  const response = await fetch(`/api/getthumbinfo?videoId=${videoId}`);
  const text = await response.text();
  const parser = new DOMParser();
  const xml = parser.parseFromString(text, "application/xml");
  const thumb = xml.querySelector("thumb");
  if (!thumb) return null;

  return {
    viewCounter: parseInt(thumb.querySelector("view_counter")?.textContent || 0),
    commentCounter: parseInt(thumb.querySelector("comment_num")?.textContent || 0),
    mylistCounter: parseInt(thumb.querySelector("mylist_counter")?.textContent || 0),
  };
}

// 主人公選択画面セットアップ
async function setupChoice() {
  const choiceMessage = document.getElementById("choice-message");
  choiceMessage.innerHTML = `
    <h3>この3つの中から、使いたい動画を選んでください</h3>
    <p>（ステータス：HP＝再生数、攻撃力＝コメント数、スピード＝マイリスト数）</p>
  `;

  const choiceArea = document.getElementById("choice-area");
  choiceArea.innerHTML = "読み込み中...";

  const selected = pickRandom(allVideos, 8);
  const choices = selected.slice(0, 3);
  enemies = selected.slice(3, 8);

  const promises = [...choices, ...enemies].map(async video => {
    const stats = await fetchVideoStats(video.id);
    if (stats) {
      video.viewCounter = stats.viewCounter;
      video.commentCounter = stats.commentCounter;
      video.mylistCounter = stats.mylistCounter;
    } else {
      video.viewCounter = 1;
      video.commentCounter = 1;
      video.mylistCounter = 1;
    }
  });

  await Promise.all(promises);

  choiceArea.innerHTML = "";
  for (let video of choices) {
    const div = document.createElement("div");
    div.className = "choice-card";

    const img = document.createElement("img");
    img.src = video.thumbnailUrl;
    img.width = 150;

    const title = document.createElement("div");
    title.innerText = video.title;
    title.className = "choice-title";

    const stats = document.createElement("div");
    stats.innerHTML = `
      HP: ${video.viewCounter}<br>
      攻撃力: ${video.commentCounter}<br>
      スピード: ${video.mylistCounter}
    `;
    stats.className = "choice-stats";

    div.appendChild(img);
    div.appendChild(title);
    div.appendChild(stats);

    div.onclick = () => selectPlayer(video);
    choiceArea.appendChild(div);
  }
}

// 主人公を決定
function selectPlayer(video) {
  player = { ...video };
  document.getElementById("start-button").disabled = false;
  document.getElementById("choice-area").innerHTML = `<h2>主人公: ${video.title}</h2><img src="${video.thumbnailUrl}" width="150">`;

  // 主人公ステータス表示
  const heroStatus = document.getElementById("hero-status-area");
  heroStatus.innerHTML = `
    <h3>主人公ステータス</h3>
    <img src="${video.thumbnailUrl}" width="120"><br>
    <b>${video.title}</b><br>
    HP: ${video.viewCounter}<br>
    攻撃力: ${video.commentCounter}<br>
    スピード: ${video.mylistCounter}
  `;

  showEnemyList();
}

// 敵リストを表示（回戦番号付き）
function showEnemyList() {
  const area = document.getElementById("enemy-list-area");
  area.innerHTML = "<h3>控えの敵たち</h3>";

  enemies.forEach((enemy, idx) => {
    const div = document.createElement("div");
    div.className = "enemy-list-item";
    div.innerHTML = `
      第${idx + 1}回戦：<br>
      <img src="${enemy.thumbnailUrl}" width="100"><br>
      ${enemy.title}<br>
      HP:${enemy.viewCounter} 攻撃力:${enemy.commentCounter} スピード:${enemy.mylistCounter}
    `;
    area.appendChild(div);
  });
}

// バトル開始
function startBattle() {
  // バトル開始時に入力エリア＆選択肢を非表示
  document.getElementById("user-input-area").style.display = "none";
  document.getElementById("choice-message").style.display = "none";
  document.getElementById("choice-area").style.display = "none";
  document.getElementById("start-button").style.display = "none";

  battleNumber = 1;
  battleNext();
}

// バトル次のターンへ
function battleNext() {
  if (enemies.length === 0) {
    showMessage("ゲームクリア！🎉");
    return;
  }

  const enemy = enemies.shift();
  battleScene(player, enemy);
}

// バトルシーン
async function battleScene(playerChar, enemyChar) {
  const battleArea = document.getElementById("battle-area");
  battleArea.innerHTML = `
    <h2>バトル開始！</h2>
    <div class="battle-field">
      <div class="character" id="player">
        <div class="character-title">${playerChar.title}</div>
        <img src="${playerChar.thumbnailUrl}" width="150">
        <div class="hp-bar" id="player-hp"></div>
        <div id="player-hp-text"></div>
        <div class="character-stats">攻撃力:${playerChar.commentCounter} スピード:${playerChar.mylistCounter}</div>
      </div>

      <div id="commentary-area" class="commentary-area"></div>

      <div class="character" id="enemy">
        <div class="character-title">${enemyChar.title}</div>
        <img src="${enemyChar.thumbnailUrl}" width="150">
        <div class="hp-bar" id="enemy-hp"></div>
        <div id="enemy-hp-text"></div>
        <div class="character-stats">攻撃力:${enemyChar.commentCounter} スピード:${enemyChar.mylistCounter}</div>
      </div>
    </div>
  `;

  turnNumber = 1;
  commentaryLog = [];
  updateStatus();

  await delay(1000);

  let pHP = playerChar.viewCounter;
  let eHP = enemyChar.viewCounter;
  let pPower = playerChar.commentCounter;
  let ePower = enemyChar.commentCounter;
  let pSpeed = playerChar.mylistCounter;
  let eSpeed = enemyChar.mylistCounter;

  updateHpBar('player', pHP, playerChar.viewCounter);
  updateHpBar('enemy', eHP, enemyChar.viewCounter);

  let turn = pSpeed >= eSpeed ? 'player' : 'enemy';

  while (pHP > 0 && eHP > 0) {
    await delay(800);

    const isCritical = (turnNumber % 10 === 0);
    let damage;

    if (turn === 'player') {
      damage = isCritical ? pPower * 10 : pPower;
      eHP -= damage;
      updateHpBar('enemy', eHP, enemyChar.viewCounter);
      addCommentary(`ターン${turnNumber}：主人公の攻撃！敵に${damage}ダメージ！`);
      if (isCritical) triggerCriticalEffect();
      if (eHP <= 0) break;
      turn = 'enemy';
    } else {
      damage = isCritical ? ePower * 10 : ePower;
      pHP -= damage;
      updateHpBar('player', pHP, playerChar.viewCounter);
      addCommentary(`ターン${turnNumber}：敵の攻撃！主人公に${damage}ダメージ！`);
      if (isCritical) triggerCriticalEffect();
      if (pHP <= 0) break;
      turn = 'player';
    }
    turnNumber++;
    updateStatus();
  }

  await delay(500);
  if (pHP > 0) {
    explode('enemy');
    explosionSound.play();
    await delay(1000);
    battleNumber++;
    battleNext();
  } else {
    explode('player');
    explosionSound.play();
    await delay(1000);
    showMessage("ゲームオーバー😢");
  }
}

// ユーティリティ系

function triggerCriticalEffect() {
  document.body.classList.add('critical-flash');
  criticalSound.play();
  setTimeout(() => document.body.classList.remove('critical-flash'), 300);
}

function updateStatus() {
  const statusArea = document.getElementById("status-area");
  statusArea.innerText = `回戦: ${battleNumber} / ターン: ${turnNumber}`;
}

function pickRandom(array, count) {
  const copy = [...array];
  const selected = [];
  for (let i = 0; i < count && copy.length > 0; i++) {
    const idx = Math.floor(Math.random() * copy.length);
    selected.push(copy.splice(idx, 1)[0]);
  }
  return selected;
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function updateHpBar(who, hp, maxHp) {
  hp = Math.max(0, hp);
  const bar = document.getElementById(`${who}-hp`);
  const text = document.getElementById(`${who}-hp-text`);
  const percent = (hp / maxHp) * 100;
  bar.style.width = `${percent}%`;

  if (percent > 50) bar.style.background = "green";
  else if (percent > 20) bar.style.background = "yellow";
  else bar.style.background = "red";

  text.innerText = `HP: ${hp}`;
}

function explode(who) {
  const char = document.getElementById(who);
  const explosion = document.createElement('div');
  explosion.className = 'explosion';
  char.appendChild(explosion);
  setTimeout(() => explosion.remove(), 1000);
}

function showMessage(msg) {
  const battleArea = document.getElementById("battle-area");
  battleArea.innerHTML = `<h2>${msg}</h2>`;
}

function addCommentary(message) {
  commentaryLog.push(message);
  if (commentaryLog.length > 3) {
    commentaryLog.shift(); // 3行まで
  }
  document.getElementById("commentary-area").innerHTML = commentaryLog.map(m => `<div>${m}</div>`).join('');
}

// ボタンイベントリスナー
document.getElementById("fetch-button").addEventListener("click", async () => {
  const mylistId = document.getElementById("mylist-id-input").value;
  if (!mylistId) {
    alert("マイリストIDを入力してください！");
    return;
  }
  allVideos = await fetchMylistVideos(mylistId);
  if (allVideos.length < 8) {
    alert("マイリストには8本以上の動画が必要です！");
    return;
  }
  setupChoice();
});
document.getElementById("start-button").addEventListener("click", startBattle);
