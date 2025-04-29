// 完全修正版 game.js

let player = null;
let enemies = [];
let allVideos = [];
let turnNumber = 1;
let battleNumber = 1;
let commentaryLog = []; // 実況ログ用

const explosionSound = new Audio('assets/sounds/explosion.mp3');
const criticalSound = new Audio('assets/sounds/critical.mp3');
const fanfareSound = new Audio('assets/sounds/fanfare.mp3');
const gameoverSound = new Audio('assets/sounds/gameover.wav');
const battleStartSound = new Audio('assets/sounds/battle_start.mp3');

// マイリストIDから動画基本情報取得
async function fetchMylistVideos(mylistId) {
  const response = await fetch(`/api/mylist/${mylistId}`);
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
  const response = await fetch(`/api/getthumbinfo/${videoId}`);
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

// 選択肢画面セットアップ
async function setupChoice() {
  const choiceMessage = document.getElementById("choice-message");
  choiceMessage.innerHTML = `<h3>この3つの中から使いたい動画を選んでください</h3>`;

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

  enemies.sort((a, b) => a.viewCounter - b.viewCounter);

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

  const heroStatus = document.getElementById("hero-status-area");
  heroStatus.innerHTML = "";

  const choiceCards = document.querySelectorAll(".choice-card");
  choiceCards.forEach(card => {
    card.classList.remove("selected");
    card.classList.add("dimmed");
  });

  const clickedCard = Array.from(choiceCards).find(card => card.innerText.includes(video.title));
  if (clickedCard) {
    clickedCard.classList.add("selected");
    clickedCard.classList.remove("dimmed");
  }

  showEnemyList();
}

function addCommentary(message) {
  commentaryLog.push(message);
  if (commentaryLog.length > 1) {
    commentaryLog = commentaryLog.slice(-1); // 最新の1行だけ保持
  }
  document.getElementById("commentary-area").innerHTML = commentaryLog.map(m => `<div>${m}</div>`).join('');
} // ← これが1行表示バージョン

// 敵リストを表示（回戦番号付き）
function showEnemyList() {
  const area = document.getElementById("enemy-list-area");
  area.innerHTML = "<h3>控えの敵たち</h3>";
  enemies.forEach((enemy, idx) => {
    const div = document.createElement("div");
    div.className = "enemy-list-item";
	div.innerHTML = `
	  第${idx + 1}回戦：<br>
	  <div class="enemy-thumb-wrapper">
	    <img src="${enemy.thumbnailUrl}" width="100">
	  </div>
	  <div class="enemy-title">${enemy.title}</div>
	  <div class="enemy-stats">
	    HP: ${enemy.viewCounter}<br>
	    攻撃力: ${enemy.commentCounter}<br>
	    スピード: ${enemy.mylistCounter}
	  </div>
	`;
    div.id = `enemy-list-${idx}`;  // IDも忘れずに！
    area.appendChild(div);
  });
}

// バトル開始
function startBattle() {
  // バトル開始時に入力フォーム＆選択肢を非表示
  document.querySelector(".start-form").style.display = "none";
  document.getElementById("choice-message").style.display = "none";
  document.getElementById("choice-area").style.display = "none";
  document.getElementById("start-button").style.display = "none";

  battleNumber = 1;
  battleNext();
}

// バトル次のターンへ
function battleNext() {

  if (enemies.length === 0) {
    showMessage("ゲームクリア！🎉", true);
    showGameClear();
    document.getElementById("retry-button").style.display = "block";
    return;
  }

  const enemy = enemies.shift();
  battleScene(player, enemy);
}

function triggerAttackAnimation(attackerId, isCritical = false) {
  const attacker = document.getElementById(attackerId);
  if (!attacker) return;

  const isPlayer = attackerId === "player";
  const moveDistance = isCritical ? 2000 : 200;
  const direction = isPlayer ? 1 : -1; // 主人公は右(+)、敵は左(-)

  attacker.style.transition = "transform 0.3s";
  attacker.style.transform = `translateX(${moveDistance * direction}px)`;

  setTimeout(() => {
    attacker.style.transform = "translateX(0)";
  }, 300);
}

// バトルシーン
async function battleScene(playerChar, enemyChar) {
  const battleArea = document.getElementById("battle-area");
	battleArea.innerHTML = `
	  <h2>第${battleNumber}回戦 バトル開始！</h2>
	  <div class="battle-field">
	    <div class="character" id="player">
	      <div class="character-title">${playerChar.title}</div>
	      <img src="${playerChar.thumbnailUrl}" width="150">
	      <div class="hp-bar" id="player-hp"></div>
	      <div id="player-hp-text"></div>
	      <div class="character-stats">
	        攻撃力: ${playerChar.commentCounter}<br>
	        スピード: ${playerChar.mylistCounter}
	      </div>
	    </div>

	    <div id="commentary-area" class="commentary-area"></div>

	    <div class="character" id="enemy">
	      <div class="character-title">${enemyChar.title}</div>
	      <img src="${enemyChar.thumbnailUrl}" width="150">
	      <div class="hp-bar" id="enemy-hp"></div>
	      <div id="enemy-hp-text"></div>
	      <div class="character-stats">
	        攻撃力: ${enemyChar.commentCounter}<br>
	        スピード: ${enemyChar.mylistCounter}
	      </div>
	    </div>
	  </div>
	`;


  battleStartSound.play();

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

    const isCritical = Math.random() < 0.1; // 10%の確率でクリティカル
    let damage;

	if (turn === 'player') {
	  triggerAttackAnimation('player', isCritical);
	  damage = isCritical ? pPower * 10 : pPower;
	  eHP -= damage;
	  updateHpBar('enemy', eHP, enemyChar.viewCounter);
	  addCommentary(`敵に${damage}ダメージ！`);
      if (isCritical) {
        triggerCriticalEffect();
      }
      triggerHitAnimation('enemy');
	  if (eHP <= 0) break;
	  turn = 'enemy';
	} else {
	  triggerAttackAnimation('enemy', isCritical);
	  damage = isCritical ? ePower * 10 : ePower;
	  pHP -= damage;
	  updateHpBar('player', pHP, playerChar.viewCounter);
	  addCommentary(`主人公に${damage}ダメージ！`);
      if (isCritical) {
        triggerCriticalEffect();
      }
      triggerHitAnimation('player');
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
    
    const killedEnemy = document.getElementById(`enemy-list-${battleNumber - 1}`);
    if (killedEnemy) {
      const thumbWrapper = killedEnemy.querySelector(".enemy-thumb-wrapper");
      if (thumbWrapper) {
        const killedMark = document.createElement("div");
        killedMark.className = "killed-mark";
        killedMark.textContent = "×";
        thumbWrapper.appendChild(killedMark);
      }
    }
    
    fanfareSound.play();
    battleNumber++;
    battleNext();
  } else {
    explode('player');
    explosionSound.play();
    await delay(1000);
    gameoverSound.play();
    showMessage("ゲームオーバー😢", true);
    showGameOver();
    document.getElementById("retry-button").style.display = "block";
  }
}

function showGameClear() {
  document.body.classList.remove("rainbow-background", "gameover-effect");
  document.body.classList.add("clear-effect");

  const battleArea = document.getElementById("battle-area");
  battleArea.style.background = "none"; // ←ここはそのままでも大丈夫

  const message = document.createElement("div");
  message.className = "game-result-message";
  message.textContent = "🎉 ゲームクリア！！ 🎉";
  battleArea.appendChild(message);

  document.getElementById("fanfare-sound").play();
}

function showGameOver() {
  document.body.classList.add("gameover-effect");
  const message = document.createElement("div");
  message.className = "game-result-message";
  message.textContent = "😵 GAME OVER...";
  document.getElementById("battle-area").appendChild(message);
  document.getElementById("gameover-sound").play();
}



// ユーティリティ系

function triggerCriticalEffect() {
  document.body.classList.add('critical-flash');
  criticalSound.play();
  setTimeout(() => document.body.classList.remove('critical-flash'), 300);
}

function updateStatus() {
  const statusArea = document.getElementById("status-area");
  statusArea.innerText = "";
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
  const img = char.querySelector("img");
  if (!img) return;

  const rect = img.getBoundingClientRect();
  const pieceSize = 30; // 破片1個あたりのサイズ（px）

  // 元画像を隠す
  img.style.visibility = 'hidden';

  const container = document.createElement('div');
  container.className = 'fragment-container';
  container.style.width = img.width + 'px';
  container.style.height = img.height + 'px';
  container.style.position = 'absolute';
  container.style.top = img.offsetTop + 'px';
  container.style.left = img.offsetLeft + 'px';
  container.style.pointerEvents = 'none';
  container.style.overflow = 'visible';
  char.appendChild(container);

  const imgSrc = img.src;

  for (let y = 0; y < img.height; y += pieceSize) {
    for (let x = 0; x < img.width; x += pieceSize) {
      const piece = document.createElement('div');
      piece.className = 'fragment';
      piece.style.width = pieceSize + 'px';
      piece.style.height = pieceSize + 'px';
      piece.style.backgroundImage = `url(${imgSrc})`;
      piece.style.backgroundPosition = `-${x}px -${y}px`;
      piece.style.position = 'absolute';
      piece.style.left = x + 'px';
      piece.style.top = y + 'px';
      container.appendChild(piece);

      // ランダムな飛び方
      const angle = Math.random() * 2 * Math.PI;
      const distance = 100 + Math.random() * 100;
      const dx = Math.cos(angle) * distance;
      const dy = Math.sin(angle) * distance;

      // アニメーションスタート
      setTimeout(() => {
        piece.style.transform = `translate(${dx}px, ${dy}px) rotate(${Math.random() * 720 - 360}deg)`;
        piece.style.opacity = 0;
      }, 10);
    }
  }

  // 少し時間が経ったら破片を削除
  setTimeout(() => {
    container.remove();
  }, 1500);
}


function showMessage(msg) {
  const battleArea = document.getElementById("battle-area");
  battleArea.innerHTML = `
    <div style="text-align: center;">
      <h2>${msg}</h2>
      <button id="retry-button" class="retry-button">もう一回やる！</button>
    </div>
  `;

  document.getElementById("retry-button").addEventListener("click", () => {
    location.reload();
  });
}

function triggerHitAnimation(who) {
  const char = document.getElementById(who);
  if (!char) return;
  char.classList.add('hit-animation');
  setTimeout(() => char.classList.remove('hit-animation'), 300);
}

// ボタンイベントリスナー（DOMContentLoadedで確実に）
document.addEventListener("DOMContentLoaded", () => {
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

  document.getElementById("retry-button").addEventListener("click", () => {
    location.reload();
  });
});