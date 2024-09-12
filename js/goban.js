/*****************************************\
  =======================================
 
              Minimal Gobang

                    by

             Code Monkey King

  =======================================
\*****************************************/

// DATA
const canvas = document.getElementById('gobang');
const ctx = canvas.getContext('2d');
const EMPTY = 0
const BLACK = 1
const WHITE = 2
const MARKER = 4
const OFFBOARD = 7
const LIBERTY = 8

var board = [];
var size = 21;
var side = BLACK;
var liberties = [];
var block = [];
var points_side = [];
var points_count = [];
var ko = EMPTY;
var bestMove = EMPTY;
var userMove = 0;
var cell = canvas.width / size;
var selectSize = document.getElementById("size");

// GUI
function drawBoard() { /* Render board to screen */
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.beginPath();
  for (let i = 1; i < size-1; i++) {
    const x = i * cell + cell / 2;
    const y = i * cell + cell / 2;
    let offset = cell * 2 - cell / 2;
    ctx.moveTo(offset, y);
    ctx.lineTo(canvas.width - offset, y);
    ctx.moveTo(x, offset);
    ctx.lineTo(x, canvas.height - offset);
  };ctx.stroke();
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      let sq = row * size + col;
      if ([88, 94, 100, 214, 220, 226, 340, 346, 352].includes(sq)) {
        ctx.beginPath();
        ctx.arc(col * cell+(cell/4)*2, row * cell +(cell/4)*2, cell / 6 - 2, 0, 2 * Math.PI);
        ctx.fillStyle = 'black';
        ctx.fill();
        ctx.stroke();
      }
      if (board[sq] == 7) continue;
      let color = board[sq] == 1 ? "black" : "white";
      if (board[sq]) {
        ctx.beginPath();
        ctx.arc(col * cell + cell / 2, row * cell + cell / 2, cell / 2 - 2, 0, 2 * Math.PI);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.stroke();
      }
      if (sq == userMove) {
        let color = board[sq] == 1 ? "white" : "black";
        ctx.beginPath();
        ctx.arc(col * cell+(cell/4)*2, row * cell +(cell/4)*2, cell / 5 - 2, 0, 2 * Math.PI);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.stroke();
      }
    }
  }
}

function userInput(event) { /* Handle user input */
  let rect = canvas.getBoundingClientRect();
  let mouseX = event.clientX - rect.left;
  let mouseY = event.clientY - rect.top;
  let col = Math.floor(mouseX / cell);
  let row = Math.floor(mouseY / cell);
  let sq = row * size + col;
  if (board[sq]) return;
  if (!setStone(sq, side, true)) return;
  drawBoard();
  setTimeout(function() { play(); }, 10);
}

function initBoard() { /* Empty board, set offboard squares */
  for (let sq = 0; sq < size ** 2; sq++) {
    switch (true) {
      case (sq < size):
      case (sq >= (size ** 2 - size)):
      case (!(sq % size)):
        board[sq] = OFFBOARD;
        board[sq-1] = OFFBOARD;
        break;
      default: board[sq] = 0;
    }
  }
}

function setStone(sq, color, user) { /* Place stone on board */
  if (board[sq] != EMPTY) {
    if (user) alert("Illegal move!");
    return false;
  } else if (sq == ko) {
    if (user) alert("Ko!");
    return false;
  } let old_ko = ko;
  ko = EMPTY;
  board[sq] = color;
  captures(3 - color, sq);
  count(sq, color);
  let suicide = liberties.length ? false : true; 
  restoreBoard();
  if (suicide) {
    board[sq] = EMPTY;
    ko = old_ko;
    if (user) alert("Suicide move!");
    return false;
  } side = 3 - side;
  userMove = sq;
  return true;
}

function count(sq, color) { /* Count group liberties */
  stone = board[sq];
  if (stone == OFFBOARD) return;
  if (stone && (stone & color) && (stone & MARKER) == 0) {
    block.push(sq);
    board[sq] |= MARKER;
    for (let offset of [1, size, -1, -size]) count(sq+offset, color);
  } else if (stone == EMPTY) {
    board[sq] |= LIBERTY;
    liberties.push(sq);
  }
}

function restoreBoard() { /* Remove group markers */
  block = []; liberties = []; points_side = [];
  for (let sq = 0; sq < size ** 2; sq++) {
    if (board[sq] != OFFBOARD) board[sq] &= 3;
  }
}

function captures(color, move) { /* Handle captured stones */
  for (let sq = 0; sq < size ** 2; sq++) {
    let stone = board[sq];
    if (stone == OFFBOARD) continue;
    if (stone & color) {
      count(sq, color);
      if (liberties.length == 0) clearBlock(move);
      restoreBoard()
    }
  }
}

function clearBlock(move) { /* Erase stones when captured */
  if (block.length == 1 && inEye(move, 0) == 3-side) ko = block[0];
  for (let i = 0; i < block.length; i++)
    board[block[i]] = EMPTY;
}

function inEye(sq) { /* Check if sqaure is in diamond shape */
  let eyeColor = -1;
  let otherColor = -1;
  for (let offset of [1, size, -1, -size]) {
    if (board[sq+offset] == OFFBOARD) continue;
    if (board[sq+offset] == EMPTY) return 0;
    if (eyeColor == -1) {
      eyeColor = board[sq+offset];
      otherColor = 3-eyeColor;
    } else if (board[sq+offset] == otherColor)
      return 0;
  }
  if (eyeColor > 2) eyeColor -= MARKER;
  return eyeColor;
}

// MAIN
canvas.addEventListener('click', userInput);
initBoard();
drawBoard();
