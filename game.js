// 最新版 game.js

let selectedVideo = null;
let enemies = [];
let currentEnemyIndex = 0;
let isBattleInProgress = false;
let logs = [];
let isCritical = false;

async function fetchMylistVideos(mylistId) {
  const response = await fetch(`/api/mylist?mylistId=${mylistId}`);
  const text = await response.text();
  const parser = new DOMParser();
  const xml = parser.parseFromString(text, 'application/xml');
  const items = Array.from(xml.querySelectorAll('item'));
  return items.map(item => {
    const link = item.querySelector('link').textContent;
    const videoId = link.match(/watch\/(sm\d+)/)[1];
    return videoId;
  });
}

async function fetchVideoStats(videoId) {
  const response = await fetch(`/api/getthumbinfo?videoId=${videoId}`);
  const text = await response.text();
  const parser = new DOMParser();
  const xml = parser.parseFromString(text, 'application/xml');
  const thumb = xml.querySelector('thumb');
  if (!thumb) throw new Error('No thumb data');

  return {
    id: videoId,
    title: thumb.querySelector('title')?.textContent || 'No Title',
    thumbnail: thumb.querySelector('thumbnail_url')?.textContent || '',
    viewCount: parseInt(thumb.querySelector('view_counter')?.textContent || '0'),
    commentCount: parseInt(thumb.querySelector('comment_num')?.textContent || '0'),
    mylistCount: parseInt(thumb.querySelector('mylist_counter')?.textContent || '0'),
  };
}

async function setupChoice(videos) {
  const choiceArea = document.getElementById('choice-area');
  choiceArea.innerHTML = '<h2>この3つから主人公を選んでください！</h2>';
  const choices = await Promise.all(videos.slice(0, 3).map(id => fetchVideoStats(id)));

  choices.forEach(video => {
    const div = document.createElement('div');
    div.className = 'choice';
    div.innerHTML = `
      <img src="${video.thumbnail}" alt="Thumbnail">
      <p>${video.title}</p>
      <p>HP: ${video.viewCount} / 攻撃力: ${video.commentCount} / スピード: ${video.mylistCount}</p>
    `;
    div.onclick = () => selectHero(video, videos);
    choiceArea.appendChild(div);
  });
}

async function selectHero(video, videos) {
  selectedVideo = video;
  enemies = await Promise.all(videos.slice(3, 8).map(id => fetchVideoStats(id)));
  document.getElementById('choice-area').style.display = 'none';
  setupBattle();
}

function setupBattle() {
  const battleArea = document.getElementById('battle-area');
  battleArea.innerHTML = `
    <h2 id="battle-title">バトル開始！</h2>
    <div id="hero">
      <img src="${selectedVideo.thumbnail}" alt="Hero">
      <h3>${selectedVideo.title}</h3>
      <div class="status">
        <div class="hp-bar" id="hero-hp"></div>
        <div class="stat-text">HP: ${selectedVideo.viewCount}</div>
        <div class="stat-text">攻撃力: ${selectedVideo.commentCount}</div>
        <div class="stat-text">スピード: ${selectedVideo.mylistCount}</div>
      </div>
    </div>
    <div id="commentary"></div>
    <div id="enemy"></div>
  `;
  startBattle();
}

function startBattle() {
  currentEnemyIndex = 0;
  nextBattle();
}

function nextBattle() {
  if (currentEnemyIndex >= enemies.length) {
    showVictory();
    return;
  }
  renderEnemy(enemies[currentEnemyIndex]);
  battleTurn(selectedVideo, enemies[currentEnemyIndex]);
}

function renderEnemy(enemy) {
  const enemyArea = document.getElementById('enemy');
  enemyArea.innerHTML = `
    <img src="${enemy.thumbnail}" alt="Enemy">
    <h3>${enemy.title}</h3>
    <div class="status">
      <div class="hp-bar" id="enemy-hp"></div>
      <div class="stat-text">HP: ${enemy.viewCount}</div>
      <div class="stat-text">攻撃力: ${enemy.commentCount}</div>
      <div class="stat-text">スピード: ${enemy.mylistCount}</div>
    </div>
  `;
}

function battleTurn(hero, enemy) {
  if (isBattleInProgress) return;
  isBattleInProgress = true;

  let heroSpeed = hero.mylistCount;
  let enemySpeed = enemy.mylistCount;

  const first = heroSpeed >= enemySpeed ? hero : enemy;
  const second = heroSpeed >= enemySpeed ? enemy : hero;

  executeTurn(first, second, () => {
    if (hero.viewCount <= 0) {
      showGameOver();
    } else if (enemy.viewCount <= 0) {
      currentEnemyIndex++;
      nextBattle();
    } else {
      executeTurn(second, first, () => {
        isBattleInProgress = false;
        if (hero.viewCount <= 0) {
          showGameOver();
        }
      });
    }
  });
}

function executeTurn(attacker, defender, callback) {
  setTimeout(() => {
    let damage = attacker.commentCount;
    isCritical = Math.random() < 0.1;
    if (isCritical) damage *= 10;

    defender.viewCount -= damage;
    if (defender.viewCount < 0) defender.viewCount = 0;

    updateHpBar(defender);
    addComment(`${attacker.title}の攻撃！${damage}ダメージ${isCritical ? '（クリティカル！）' : ''}`);

    if (defender.viewCount <= 0) {
      explosionAnimation(defender);
    }

    callback();
  }, 1000);
}

function updateHpBar(character) {
  const barId = character === selectedVideo ? 'hero-hp' : 'enemy-hp';
  const bar = document.getElementById(barId);
  if (bar) {
    bar.style.width = `${(character.viewCount / 100000) * 100}%`;
    if (character.viewCount > 70000) {
      bar.style.backgroundColor = 'green';
    } else if (character.viewCount > 30000) {
      bar.style.backgroundColor = 'yellow';
    } else {
      bar.style.backgroundColor = 'red';
    }
  }
}

function explosionAnimation(target) {
  const element = target === selectedVideo ? document.getElementById('hero') : document.getElementById('enemy');
  if (element) {
    element.classList.add('explode');
    setTimeout(() => element.classList.remove('explode'), 1000);
  }
}

function addComment(text) {
  logs.push(text);
  if (logs.length > 3) logs.shift();
  const commentary = document.getElementById('commentary');
  commentary.innerHTML = logs.map(line => `<p>${line}</p>`).join('');
}

function showVictory() {
  document.getElementById('battle-area').innerHTML = '<h2>勝利！全員倒しました！</h2>';
}

function showGameOver() {
  document.getElementById('battle-area').innerHTML = '<h2>ゲームオーバー</h2>';
}

async function startGame() {
  const mylistId = document.getElementById('mylist-id').value.trim();
  if (!mylistId) return alert('マイリストIDを入力してください');

  try {
    const videos = await fetchMylistVideos(mylistId);
    if (videos.length < 8) {
      alert('マイリストには8本以上の動画が必要です！');
      return;
    }
    setupChoice(videos);
  } catch (error) {
    console.error('動画の取得に失敗しました', error);
    alert('マイリスト取得に失敗しました');
  }
}

document.getElementById('start-button').onclick = startGame;
