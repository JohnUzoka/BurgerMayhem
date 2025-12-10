$(function () {
  const $game = $('#game');
  const $player = $('#player');
  const $score = $('#score');
  const $status = $('#status');

  const gameW = $game.width();
  const gameH = $game.height();

  const state = {
    running: true,
    score: 0,
    playerY: parseInt($player.css('top'), 10),
    speed: 4, // player speed per frame
    bulletSpeed: 8,
    enemyMinSpeed: 4.5,
    enemyMaxSpeed: 8,
    nextEnemyInMs: 1100,
    keys: { up: false, down: false, space: false },
    bullets: [],
    enemies: [],
    lastSpawn: performance.now(),
    assetsLoaded: false,
    shotsPerSecond: 2,
  };

  // Preload images to ensure they exist
  function preloadImages(paths, done, fail) {
    let remaining = paths.length;
    let failed = false;
    paths.forEach(p => {
      const img = new Image();
      img.onload = () => { if (--remaining === 0 && !failed) done(); };
      img.onerror = () => { failed = true; fail && fail(p); };
      img.src = p;
    });
  }

  function clamp(val, min, max) { return Math.max(min, Math.min(max, val)); }

  function setScore(v) { state.score = v; $score.text(v); }

  // kb input
  $(document).on('keydown', (e) => {
    if (!state.running) return;
    const k = e.key.toLowerCase();
    if (k === 'w') state.keys.up = true;
    if (k === 's') state.keys.down = true;
    if (e.key === 'Enter') state.keys.space = true;
  });

  $(document).on('keyup', (e) => {
    const k = e.key.toLowerCase();
    if (k === 'w') state.keys.up = false;
    if (k === 's') state.keys.down = false;
    if (e.key === 'Enter') state.keys.space = false;
  });

  // Bullet creation
  function shoot() {
    const bulletY = parseInt($player.css('top'), 10) + $player.outerHeight() / 2 - 12; // center 24px sprite
    const bulletX = parseInt($player.css('left'), 10) + $player.outerWidth();
    const $b = $('<div class="bullet"/>').css({ left: bulletX, top: bulletY });
    $game.append($b);
    state.bullets.push({ $el: $b, x: bulletX, y: bulletY });
  }

  // Simple rate limit for shooting
  let lastShot = 0;
  function maybeShoot(now) {
    if (!state.keys.space) return;
    const minInterval = 1000 / state.shotsPerSecond;
    if (now - lastShot > minInterval) {
      shoot();
      lastShot = now;
    }
  }

  // Enemy creation
  function spawnEnemy() {
    const enemySize = 100;
    const y = Math.floor(Math.random() * (gameH - enemySize));
    const speed = state.enemyMinSpeed + Math.random() * (state.enemyMaxSpeed - state.enemyMinSpeed);
    const $e = $('<div class="enemy"/>').css({ left: gameW - (enemySize + 4), top: y });
    $game.append($e);
    state.enemies.push({ $el: $e, x: gameW - (enemySize + 4), y, speed, w: enemySize, h: enemySize });
  }

  function maybeSpawnEnemy(now) {
    if (now - state.lastSpawn >= state.nextEnemyInMs) {
      spawnEnemy();
      // slightly increase difficulty with a bit more spawn rate
      state.nextEnemyInMs = Math.max(600, state.nextEnemyInMs - 25);
      state.enemyMaxSpeed = Math.min(11, state.enemyMaxSpeed + 0.06);
      state.lastSpawn = now;
    }
  }

  // Physics update
  function update(now) {
    if (!state.running) return;

    // Player movement
    if (state.keys.up) state.playerY -= state.speed;
    if (state.keys.down) state.playerY += state.speed;
    state.playerY = clamp(state.playerY, 0, gameH - $player.outerHeight());
    $player.css('top', state.playerY);

    // Shooting
    maybeShoot(now);

    // Bullets movement
    for (let i = state.bullets.length - 1; i >= 0; i--) {
      const b = state.bullets[i];
      b.x += state.bulletSpeed;
      b.$el.css('left', b.x);
      // remove if out of bounds
      if (b.x > gameW) { b.$el.remove(); state.bullets.splice(i, 1); }
    }

    // Enemy spawn and movement
    maybeSpawnEnemy(now);
    for (let i = state.enemies.length - 1; i >= 0; i--) {
      const e = state.enemies[i];
      e.x -= e.speed;
      e.$el.css('left', e.x);
      // remove if out of bounds (missed)
      if (e.x < -30) { e.$el.remove(); state.enemies.splice(i, 1); }
    }

    // Collisions: bullets vs enemies (slightly smaller enemy hitbox)
    for (let bi = state.bullets.length - 1; bi >= 0; bi--) {
      const b = state.bullets[bi];
      const bx = b.x, by = b.y;
      for (let ei = state.enemies.length - 1; ei >= 0; ei--) {
        const e = state.enemies[ei];
        const ex = e.x, ey = e.y;
        const ew = (e.w || 100) * 0.6;
        const eh = (e.h || 100) * 0.6;
          const exAdj = ex + ((e.w || 100) - ew) / 2;
          const eyAdj = ey + ((e.h || 100) - eh) / 2;
          if (rectsIntersect(bx, by, 24, 24, exAdj, eyAdj, ew, eh)) {
          // hit
          e.$el.remove(); state.enemies.splice(ei, 1);
          b.$el.remove(); state.bullets.splice(bi, 1);
          setScore(state.score + 1);
          break;
        }
      }
    }

    // Collisions: enemies vs player (slightly smaller player/enemy hitboxes)
    const px = parseInt($player.css('left'), 10);
    const py = state.playerY;
    for (let ei = state.enemies.length - 1; ei >= 0; ei--) {
      const e = state.enemies[ei];
      const pw = $player.outerWidth() * 0.8;
      const ph = $player.outerHeight() * 0.8;
        const pxAdj = px + ($player.outerWidth() - pw) / 2;
        const pyAdj = py + ($player.outerHeight() - ph) / 2;
      const ew = (e.w || 100) * 0.65;
      const eh = (e.h || 100) * 0.65;
        const exAdj = e.x + ((e.w || 100) - ew) / 2;
        const eyAdj = e.y + ((e.h || 100) - eh) / 2;
        if (rectsIntersect(pxAdj, pyAdj, pw, ph, exAdj, eyAdj, ew, eh)) {
        gameOver();
        break;
      }
    }
  }

  function rectsIntersect(x1, y1, w1, h1, x2, y2, w2, h2) {
    return (
      x1 < x2 + w2 &&
      x1 + w1 > x2 &&
      y1 < y2 + h2 &&
      y1 + h1 > y2
    );
  }

  let rafId = null;
  function loop(now) {
    update(now);
    rafId = requestAnimationFrame(loop);
  }

  function gameOver() {
    state.running = false;
    $status.text('Game Over — press R to restart');
    const $overlay = $('<div class="game-over-overlay">Game Over</div>');
    $game.append($overlay);
  }

  function resetGame() {
    // clear entities
    state.bullets.forEach(b => b.$el.remove());
    state.enemies.forEach(e => e.$el.remove());
    state.bullets = [];
    state.enemies = [];
    setScore(0);
    state.playerY = gameH/2 - $player.outerHeight()/2;
    $player.css('top', state.playerY);
    state.running = true;
    $status.text('');
    $game.find('.game-over-overlay').remove();
  }

  $(document).on('keydown', (e) => {
    if (e.key.toLowerCase() === 'r' && !state.running) {
      resetGame();
    }
  });

  // Start centered
  state.playerY = gameH/2 - $player.outerHeight()/2;
  $player.css('top', state.playerY);

  // Load assets first so CSS backgrounds resolve
  preloadImages(['assets/pepe.png', 'assets/hamburger.svg', 'assets/kid.png'], () => {
    state.assetsLoaded = true;
    $status.text('');
    rafId = requestAnimationFrame(loop);
  }, (missing) => {
    state.running = false;
    $status.text(`Missing image: ${missing}. Ensure files exist under /assets.`);
  });
});
