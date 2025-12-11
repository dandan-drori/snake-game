const canvas = document.getElementById('gameCanvas'); // Main game canvas
const ctx = canvas.getContext('2d'); // Canvas rendering context
const gameOverModal = document.getElementById('gameOverModal'); // Game over modal
const restartButton = document.getElementById('restartButton'); // Restart button
const finalScoreDisplay = document.getElementById('finalScore'); // Current score display
const finalHighScoreDisplay = document.getElementById('finalHighScore'); // New high score display
const resumeButton = document.getElementById('resumeButton'); // New resume button
const mobilePauseModal = document.getElementById('mobilePauseModal'); // New pause modal

const BASE_CANVAS_WIDTH = 1400; // Maintains 1.75:1 aspect ratio
const BASE_CANVAS_HEIGHT = 800; // Maintains 1.75:1 aspect ratio
const GRID_SIZE = 25; // Size of each grid cell in pixels

// --- NEW Speed Constants ---
const SPEED_INCREASE_INTERVAL = 5; // Increase speed every 5 points
const SPEED_REDUCTION_AMOUNT = 5; // Reduce delay by 5ms each time
const MIN_GAME_SPEED = 40; // Minimum delay (maximum speed)
const HIGH_SCORE_KEY = 'snakeHighScore'; // Key for localStorage
const SCORE_INCREMENT = 1; // Points per food

const SWIPE_THRESHOLD = 30; // Minimum pixels to count as a swipe

const MOVEMENT_KEYS = [
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'w',
  'a',
  's',
  'd',
]; // Allowed movement keys
const SPRITES = {
  head: {},
  body: {},
  tail: {},
}; // To hold loaded sprite images
const APPLE_SPRITE = new Image(); // Apple sprite image
const HEAD_TAIL_DIRECTIONS = ['left', 'up', 'right', 'down']; // Directions for head and tail sprites
const BODY_SEGMENTS = [
  'vertical',
  'horizontal',
  'bottomleft',
  'bottomright',
  'topleft',
  'topright',
]; // Specialized body segments
const PARTS = ['head', 'tail']; // For loading head and tail sprites
const DARK_GREEN = '#1aa61aff'; // Darker shade of green for tiles
const LIGHT_GREEN = '#00AA00'; // Lighter shade of green for tiles

canvas.width = BASE_CANVAS_WIDTH; // Set initial width
canvas.height = BASE_CANVAS_HEIGHT; // Set initial height

// --- Game State Variables ---
let snake; // Array of snake segments
let dx; // Current direction deltas
let dy; // Current direction deltas
let nextDx; // Next direction deltas
let nextDy; // Next direction deltas
let inputQueue; // Queue for buffered input
let food; // Food object with x, y, width, height, color, content
let animationFrame; // For requestAnimationFrame
let lastTime = 0; // For tracking time between frames
let isGameOver = false; // Game over state variable
let isPaused = false; // New pause state variable
let score = 0; // Current score
let highScore = 0; // Loaded from localStorage
let touchStartX = 0; // For touch input
let touchStartY = 0; // For touch input
let GAME_SPEED = 100; // Initial delay in ms between steps (Will be modified)
let allImagesLoaded = false; // Flag to track if all images are loaded
let imagesToLoad = HEAD_TAIL_DIRECTIONS.length * 2 + BODY_SEGMENTS.length; // 4*2 + 6 = 14 total images
let imagesLoadedCount = 0; // Counter for loaded images

/** Registers the service worker for offline capabilities and caching. */
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('service-worker.js')
        .then((registration) => {
          console.log(
            'ServiceWorker registration successful with scope: ',
            registration.scope
          );
        })
        .catch((err) => {
          console.log('ServiceWorker registration failed: ', err);
        });
    });
  }
}

/** Checks if all images have been loaded and sets the flag accordingly. */
function checkLoadComplete() {
  imagesLoadedCount++;
  if (imagesLoadedCount === imagesToLoad) {
    allImagesLoaded = true;
    // Ensure the game starts drawing once assets are ready
    draw();
  }
}

/**
 * Loads all sprite assets into the SPRITES object.
 * @param {string} basePath - The folder where your images are stored (e.g., 'assets/snake/').
 */
function loadSprites(basePath = 'assets/snake/') {
  // load apple sprite
  APPLE_SPRITE.src = 'assets/apple/apple.png';
  APPLE_SPRITE.onload = () => console.log('Apple sprite loaded!');
  APPLE_SPRITE.onerror = () =>
    console.error('Failed to load apple sprite: assets/apple/apple.png');

  // A. Load Directional Head/Tail Sprites
  PARTS.forEach((part) => {
    HEAD_TAIL_DIRECTIONS.forEach((direction) => {
      const img = new Image();
      // Assuming file names are structured like: head_up.png, tail_right.png, etc.
      img.src = `${basePath}${part}_${direction}.png`;

      img.onload = checkLoadComplete;
      img.onerror = () => console.error(`Failed to load sprite: ${img.src}`);

      SPRITES[part][direction] = img;
    });
  });

  // B. Load Specialized Body Sprites
  BODY_SEGMENTS.forEach((segmentType) => {
    const img = new Image();
    // File names like: body_vertical.png, body_bottomleft.png, etc.
    img.src = `${basePath}body_${segmentType}.png`;

    img.onload = checkLoadComplete;
    img.onerror = () => console.error(`Failed to load sprite: ${img.src}`);

    SPRITES.body[segmentType] = img;
  });
}

/** Initializes or resets the game state and starts the game loop. */
function initializeGame() {
  // Load Sprites
  loadSprites();

  // Reset State
  isGameOver = false;
  gameOverModal.style.display = 'none';
  score = 0;

  // Reset GAME_SPEED to initial value
  GAME_SPEED = 100;

  // Load High Score
  const storedHighScore = localStorage.getItem(HIGH_SCORE_KEY);
  highScore = storedHighScore ? parseInt(storedHighScore) : 0;

  // Initial Snake position
  const startX = Math.floor(canvas.width / 4 / GRID_SIZE) * GRID_SIZE;
  const startY = Math.floor(canvas.height / 2 / GRID_SIZE) * GRID_SIZE;

  snake = [
    { x: startX, y: startY }, // Head
    { x: startX - GRID_SIZE, y: startY },
    { x: startX - GRID_SIZE * 2, y: startY },
  ];

  // Initial Direction: Right
  dx = GRID_SIZE;
  dy = 0;
  nextDx = dx;
  nextDy = dy;
  inputQueue = [];
  keys = {};

  placeFood();

  if (animationFrame) {
    cancelAnimationFrame(animationFrame);
  }
  animationFrame = requestAnimationFrame(gameLoop);
}

/** Handles the game over state, including stopping the game loop and updating scores. */
function gameOver() {
  isGameOver = true;
  cancelAnimationFrame(animationFrame);

  // Check for New High Score and Save (Logic remains the same)
  if (score > highScore) {
    highScore = score;
    localStorage.setItem(HIGH_SCORE_KEY, highScore);
  }

  // Display the current score
  finalScoreDisplay.textContent = score;

  // NEW: Display the High Score in the modal
  finalHighScoreDisplay.textContent = highScore;

  gameOverModal.style.display = 'block';
}

/** Places food on the canvas ensuring it does not overlap with the snake. */
function placeFood() {
  let newFoodX, newFoodY;
  let collision;
  // ... (Your placeFood function code) ...
  do {
    const maxCols = canvas.width / GRID_SIZE;
    const maxRows = canvas.height / GRID_SIZE;

    const randCol = Math.floor(Math.random() * maxCols);
    const randRow = Math.floor(Math.random() * maxRows);

    newFoodX = randCol * GRID_SIZE;
    newFoodY = randRow * GRID_SIZE;

    collision = false;
    for (const segment of snake) {
      if (segment.x === newFoodX && segment.y === newFoodY) {
        collision = true;
        break;
      }
    }
  } while (collision);

  food = {
    x: newFoodX,
    y: newFoodY,
    width: GRID_SIZE,
    height: GRID_SIZE,
  };
}

/**
 * Determines which body sprite to use based on the neighboring segments.
 * @param {object} prev - The segment before the current one (the "neck").
 * @param {object} current - The segment being drawn.
 * @param {object} next - The segment after the current one (the "tail end").
 * @returns {string} The sprite key ('vertical', 'bottomleft', etc.).
 */
function getBodySpriteKey(prev, current, next) {
  // Determine the direction the segment is ENTERING from (relative to current)
  const enterDirX = prev.x - current.x;
  const enterDirY = prev.y - current.y;

  // Determine the direction the segment is EXITING to (relative to current)
  const exitDirX = next.x - current.x;
  const exitDirY = next.y - current.y;

  // 1. Straight Segments
  if (enterDirX === 0 && exitDirX === 0) return 'vertical';
  if (enterDirY === 0 && exitDirY === 0) return 'horizontal';

  // 2. Corner Segments (Requires mixing the direction vectors)

  // Check Top-Left Corner (Moving UP to LEFT or LEFT to UP)
  // Enter from Down (Y>0) and Exit Left (X<0)
  if ((enterDirY > 0 && exitDirX < 0) || (enterDirX < 0 && exitDirY > 0)) {
    return 'bottomleft'; // The turn faces BOTTOM and LEFT relative to the grid
  }

  // Check Top-Right Corner (Moving UP to RIGHT or RIGHT to UP)
  // Enter from Down (Y>0) and Exit Right (X>0)
  if ((enterDirY > 0 && exitDirX > 0) || (enterDirX > 0 && exitDirY > 0)) {
    return 'bottomright';
  }

  // Check Bottom-Left Corner (Moving DOWN to LEFT or LEFT to DOWN)
  // Enter from Up (Y<0) and Exit Left (X<0)
  if ((enterDirY < 0 && exitDirX < 0) || (enterDirX < 0 && exitDirY < 0)) {
    return 'topleft';
  }

  // Check Bottom-Right Corner (Moving DOWN to RIGHT or RIGHT to DOWN)
  // Enter from Up (Y<0) and Exit Right (X>0)
  if ((enterDirY < 0 && exitDirX > 0) || (enterDirX > 0 && exitDirY < 0)) {
    return 'topright';
  }

  // Fallback (Shouldn't happen in a valid game state)
  return 'horizontal';
}

/** Handles keydown events for game controls including pause and movement. */
function handleKeyDown(e) {
  // 1. Pause Logic
  if (e.key === ' ') {
    e.preventDefault(); // Prevent scrolling
    isGameOver ? initializeGame() : togglePause();
    return;
  }

  if (isGameOver) return;

  // 2. Movement Logic
  if (MOVEMENT_KEYS.includes(e.key)) {
    e.preventDefault(); // Prevent scrolling
    if (isPaused) return; // Block movement input if paused

    queueDirection(e.key);
  }
}

/** Updates the game state including snake movement, collision detection, and scoring. */
function update() {
  if (isGameOver) return;

  // 1. Process Input Queue for Direction Change
  if (inputQueue.length > 0) {
    // ... (Direction change logic) ...
    const nextKey = inputQueue.shift();
    let newDx = nextDx;
    let newDy = nextDy;

    if (nextKey === 'ArrowLeft' || nextKey === 'a') {
      newDx = -GRID_SIZE;
      newDy = 0;
    } else if (nextKey === 'ArrowRight' || nextKey === 'd') {
      newDx = GRID_SIZE;
      newDy = 0;
    } else if (nextKey === 'ArrowUp' || nextKey === 'w') {
      newDy = -GRID_SIZE;
      newDx = 0;
    } else if (nextKey === 'ArrowDown' || nextKey === 's') {
      newDy = GRID_SIZE;
      newDx = 0;
    }

    if (newDx !== -dx || newDy !== -dy) {
      nextDx = newDx;
      nextDy = newDy;
    }
  }

  // 2. Apply New Direction
  dx = nextDx;
  dy = nextDy;

  // 3. Calculate New Head Position and Wrap-Around
  const head = snake[0];
  let newHeadX = head.x + dx;
  let newHeadY = head.y + dy;

  // Wrap-Around Logic
  if (newHeadX < 0) {
    newHeadX = canvas.width - GRID_SIZE;
  } else if (newHeadX >= canvas.width) {
    newHeadX = 0;
  }
  if (newHeadY < 0) {
    newHeadY = canvas.height - GRID_SIZE;
  } else if (newHeadY >= canvas.height) {
    newHeadY = 0;
  }

  const newHead = { x: newHeadX, y: newHeadY };

  // 4. Self-Collision Check
  for (let i = 1; i < snake.length; i++) {
    if (newHead.x === snake[i].x && newHead.y === snake[i].y) {
      gameOver();
      return;
    }
  }

  // 5. Food Collision and Growth Logic
  const hasEaten = newHead.x === food.x && newHead.y === food.y;

  snake.unshift(newHead);

  if (hasEaten) {
    score += SCORE_INCREMENT;

    // --- SPEED SCALING LOGIC ---
    // Check if the score is a multiple of the speed interval and speed is not maxed out
    if (
      score > 0 &&
      score % SPEED_INCREASE_INTERVAL === 0 &&
      GAME_SPEED > MIN_GAME_SPEED
    ) {
      GAME_SPEED = Math.max(
        MIN_GAME_SPEED,
        GAME_SPEED - SPEED_REDUCTION_AMOUNT
      );
    }

    placeFood();
  } else {
    snake.pop();
  }
}

/** Converts a movement vector (dx, dy) into a string direction key. */
function getDirectionKey(dx, dy) {
  if (dx === GRID_SIZE) return 'right';
  if (dx === -GRID_SIZE) return 'left';
  if (dy === GRID_SIZE) return 'down';
  if (dy === -GRID_SIZE) return 'up';
  return 'right'; // Default/initial direction
}

/** Draws the snake on the canvas, including the head, body, and tail segments. */
function drawSnake() {
  // Head Segment (snake[0]) - Direction remains based on current dx/dy
  const head = snake[0];
  const headDirection = getDirectionKey(dx, dy);
  ctx.drawImage(
    SPRITES.head[headDirection],
    head.x,
    head.y,
    GRID_SIZE,
    GRID_SIZE
  );

  // Body Segments (snake[1] to snake[length - 2])
  for (let i = 1; i < snake.length - 1; i++) {
    const segment = snake[i];
    const prev = snake[i - 1]; // Segment closer to the head
    const next = snake[i + 1]; // Segment closer to the tail

    const bodyKey = getBodySpriteKey(prev, segment, next);
    ctx.drawImage(
      SPRITES.body[bodyKey],
      segment.x,
      segment.y,
      GRID_SIZE,
      GRID_SIZE
    );
  }

  // Tail Segment (snake[length - 1]) - Direction based on segment before it
  if (snake.length > 1) {
    const tail = snake[snake.length - 1];
    const secondToLast = snake[snake.length - 2];

    // Tail direction is the direction the tail is moving AWAY from the second-to-last segment.
    const tailDx = tail.x - secondToLast.x;
    const tailDy = tail.y - secondToLast.y;

    // The tail sprite must face the direction of the tail segment itself.
    const tailDirection = getDirectionKey(tailDx, tailDy); // Use negative delta for direction

    ctx.drawImage(
      SPRITES.tail[tailDirection],
      tail.x,
      tail.y,
      GRID_SIZE,
      GRID_SIZE
    );
  }
}

function drawScore() {
  ctx.fillStyle = 'black';
  ctx.font = '24px "Pixelify Sans", monospace';
  ctx.textAlign = 'left';
  ctx.drawImage(APPLE_SPRITE, 10, 14.5, 25, 25);
  ctx.fillText(`${score}`, 40, 35);
}

function drawFood() {
  ctx.drawImage(APPLE_SPRITE, food.x, food.y, food.width, food.height);
}

function drawLoadingScreen() {
  ctx.fillStyle = 'white';
  ctx.font = '24px "PressStart2P", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('Loading Assets...', canvas.width / 2, canvas.height / 2);
}

/** Draws the entire game frame including the grid, food, and UI elements. */
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // Ensure all assets are loaded before drawing sprites
  if (!allImagesLoaded) {
    drawLoadingScreen();
    return;
  }

  drawFood();
  drawSnake();
  drawScore();
}

/** Draws a checkerboard grid pattern on the canvas. */
function drawGrid() {
  // 1. Determine the number of columns and rows
  const numCols = canvas.width / GRID_SIZE;
  const numRows = canvas.height / GRID_SIZE;

  // 2. Loop through every cell position
  for (let col = 0; col < numCols; col++) {
    for (let row = 0; row < numRows; row++) {
      // 3. Calculate the sum of the column and row index
      const indexSum = col + row;

      let color;

      // 4. Determine color based on even/odd sum
      // If the sum of the indices is even (0, 2, 4, ...), use the darker color.
      // If the sum is odd (1, 3, 5, ...), use the lighter color.
      color = indexSum % 2 === 0 ? DARK_GREEN : LIGHT_GREEN;

      // 5. Set the fill color and draw the cell rectangle
      ctx.fillStyle = color;

      // Calculate the actual pixel coordinates
      const x = col * GRID_SIZE;
      const y = row * GRID_SIZE;

      ctx.fillRect(x, y, GRID_SIZE, GRID_SIZE);
    }
  }
}

/** Adjusts the canvas size dynamically based on the viewport while maintaining aspect ratio and grid alignment. */
function resizeCanvas() {
  // 1. Determine available space
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  // 2. Calculate ideal size maintaining aspect ratio (1.75:1 or 1400/800)
  let newWidth, newHeight;
  const aspectRatio = BASE_CANVAS_WIDTH / BASE_CANVAS_HEIGHT;

  if (viewportWidth / viewportHeight > aspectRatio) {
    // Limited by height
    newHeight = Math.floor(viewportHeight * 0.95);
    newWidth = Math.floor(newHeight * aspectRatio);
  } else {
    // Limited by width
    newWidth = Math.floor(viewportWidth * 0.95);
    newHeight = Math.floor(newWidth / aspectRatio);
  }

  // 3. Ensure new dimensions are multiples of GRID_SIZE
  // This maintains perfect grid alignment, crucial for snake.
  newWidth = Math.floor(newWidth / GRID_SIZE) * GRID_SIZE;
  newHeight = Math.floor(newHeight / GRID_SIZE) * GRID_SIZE;

  // Check if dimensions actually changed
  const dimensionsChanged =
    canvas.width !== newWidth || canvas.height !== newHeight;

  // 4. Set the actual canvas dimensions
  canvas.width = newWidth;
  canvas.height = newHeight;

  // 5. Adjust game state based on why resize was called
  if (dimensionsChanged) {
    if (typeof snake === 'undefined' || isGameOver) {
      // Initial load or restart: Full initialization is required
      // Note: You must call initializeGame() *after* this function completes its first run
      // or ensure it handles the resize call. For now, we rely on the end of the script.
    } else {
      // Game is running: Adjust positions safely
      resetPositionsOnResize();
    }
  }
}

/** Queues a new direction input if it's not a duplicate of the last queued input. */
function queueDirection(directionKey) {
  // The same logic used for keyboard input: prevent double queuing
  if (
    inputQueue.length === 0 ||
    inputQueue[inputQueue.length - 1] !== directionKey
  ) {
    inputQueue.push(directionKey);
  }
}

/** Handles the start of a touch event for swipe detection. */
function handleTouchStart(evt) {
  if (isGameOver) return;

  // Get the initial touch position (only use the first touch point)
  const firstTouch = evt.touches[0];
  touchStartX = firstTouch.clientX;
  touchStartY = firstTouch.clientY;
}

/** Handles the movement during a touch event for swipe detection. */
function handleTouchMove(evt) {
  // Prevent the default scrolling behavior if the user is swiping
  // We only need this if touch-action: none is not fully supported or is insufficient.
  // However, it's safer to prevent default for touchmove if a game is running.
  if (!isGameOver) {
    evt.preventDefault();
  }
}

/** Handles the end of a touch event to determine swipe direction and queue movement. */
function handleTouchEnd(evt) {
  if (isGameOver) return;

  // Check if a valid swipe occurred
  const touchEnd = evt.changedTouches[0];
  const deltaX = touchEnd.clientX - touchStartX;
  const deltaY = touchEnd.clientY - touchStartY;

  // Determine if the swipe was primarily horizontal or vertical
  if (Math.abs(deltaX) > Math.abs(deltaY)) {
    // Horizontal swipe
    if (Math.abs(deltaX) > SWIPE_THRESHOLD) {
      if (deltaX > 0) {
        // Swipe Right
        queueDirection('ArrowRight');
      } else {
        // Swipe Left
        queueDirection('ArrowLeft');
      }
    }
  } else {
    // Vertical swipe
    if (Math.abs(deltaY) > SWIPE_THRESHOLD) {
      if (deltaY > 0) {
        // Swipe Down
        queueDirection('ArrowDown');
      } else {
        // Swipe Up
        queueDirection('ArrowUp');
      }
    }
  }
}

/** Main game loop, called on each animation frame. */
function gameLoop(timestamp) {
  // If the game is over OR paused, we exit the function immediately
  if (isGameOver || isPaused) {
    animationFrame = requestAnimationFrame(gameLoop); // Keep requesting frame to check status
    return;
  }

  if (timestamp - lastTime >= GAME_SPEED) {
    update();
    lastTime = timestamp;
  }

  draw();
  animationFrame = requestAnimationFrame(gameLoop);
}

/** Toggles the paused state of the game and updates the UI accordingly. */
function togglePause() {
  if (isGameOver) return; // Cannot pause a game that's over

  isPaused = !isPaused;

  // Toggle the display of the mobile pause modal
  if (mobilePauseModal) {
    mobilePauseModal.style.display = isPaused ? 'block' : 'none';
  }
}

/** Repositions the snake and food when the canvas is resized to maintain relative positions. */
function resetPositionsOnResize() {
  if (isGameOver) return; // Don't reposition if game is over

  // Calculate new center for the snake based on new canvas.width/height
  const newCenterX = Math.floor(canvas.width / 2 / GRID_SIZE) * GRID_SIZE;
  const newCenterY = Math.floor(canvas.height / 2 / GRID_SIZE) * GRID_SIZE;

  // Calculate the old snake's center (assuming it started at 1/4 width)
  const oldStartX = Math.floor(BASE_CANVAS_WIDTH / 4 / GRID_SIZE) * GRID_SIZE;
  const oldStartY = Math.floor(BASE_CANVAS_HEIGHT / 2 / GRID_SIZE) * GRID_SIZE;

  // Calculate the difference in starting position
  const offsetX = newCenterX - oldStartX;
  const offsetY = newCenterY - oldStartY;

  // Reposition every snake segment
  snake.forEach((segment) => {
    segment.x += offsetX;
    segment.y += offsetY;
  });

  // Also reposition food to a valid new spot
  placeFood();
}

// Attach keyboard listener
window.addEventListener('keydown', handleKeyDown);

// Attach restart and resume listeners
restartButton.addEventListener('click', initializeGame);
resumeButton.addEventListener('click', togglePause);

// Event listeners to trigger the resize
window.addEventListener('resize', resizeCanvas);
window.addEventListener('orientationchange', resizeCanvas);

// Touch event listeners for swipe detection
window.addEventListener('touchstart', handleTouchStart, false);
window.addEventListener('touchmove', handleTouchMove, false);
window.addEventListener('touchend', handleTouchEnd, false);

// Load service worker for PWA functionality
registerServiceWorker();
// Initial resize to fit the screen
resizeCanvas();
// Start the game
initializeGame();
