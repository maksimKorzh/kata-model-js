/*****************************************\
  =======================================
 
                 Gobang JS

                    by

             Code Monkey King

  =======================================
\*****************************************/

const Goban = function(params) {
  // CANVAS
  var canvas, ctx, cell;

  // DATA
  const EMPTY = 0
  const BLACK = 1
  const WHITE = 2
  const MARKER = 4
  const OFFBOARD = 7
  const LIBERTY = 8

  var board = [];
  var history = [];
  var komi = 6.5;
  var size;
  var side = BLACK;
  var liberties = [];
  var block = [];
  var ko = EMPTY;
  var bestMove = EMPTY;
  var userMove = 0;
  var moveCount = 0;

  // PRIVATE METHODS
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
        let starPoints = {
           9: [36, 38, 40, 58, 60, 62, 80, 82, 84],
          13: [64, 67, 70, 109, 112, 115, 154, 157, 160],
          19: [88, 94, 100, 214, 220, 226, 340, 346, 352]
        }
        if ([9, 13, 19].includes(size-2) && starPoints[size-2].includes(sq)) {
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
    if (params.sgf) return;
    let rect = canvas.getBoundingClientRect();
    let mouseX = event.clientX - rect.left;
    let mouseY = event.clientY - rect.top;
    let col = Math.floor(mouseX / cell);
    let row = Math.floor(mouseY / cell);
    let sq = row * size + col;
    if (board[sq]) return;
    if (!setStone(sq, side, true)) return;
    drawBoard();
    setTimeout(function() { try { params.response(); } catch (e) { /* Specify custom response function */ } }, 100)
  }

  function clearBoard() { /* Empty board, set offboard squares */
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
    history.push({
      'ply': moveCount+1,
      'side': (3-color),
      'move': sq,
      'board': JSON.stringify(board),
      'ko': ko
    });
    moveCount = history.length-1;
    captures(3 - color, sq);
    count(sq, color);
    let suicide = liberties.length ? false : true; 
    restoreBoard();
    if (suicide) {
      board[sq] = EMPTY;
      ko = old_ko;
      history.pop();
      moveCount--;
      if (user) alert("Suicide move!");
      return false;
    } 
    side = 3 - side;
    userMove = sq;
    return true;
  }

  function setHandicap(stones) {
    if (stones < 0 || stones > 9) return;
    let handicap = stones;
    let handicapStones = [88, 100, 340, 352, 214, 226, 94, 346, 220].slice(0, handicap);
    for (let sq of handicapStones) {
      goban.play(sq, goban.BLACK);
      if (sq != handicapStones[handicap-1]) goban.pass();
      goban.refresh();
    }
  }

  function pass() {
    history.push({
      'ply': moveCount+1,
      'side': (3-side),
      'move': EMPTY,
      'board': JSON.stringify(board),
      'ko': ko
    });
    moveCount = history.length-1;
    ko = EMPTY;
    side = 3 - side;
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

  function loadHistoryMove() {
    let move = history[moveCount];
    board = JSON.parse(move.board);
    side = move.side;
    ko = move.ko;
    userMove = move.move;
    drawBoard();
  }

  function undoMove() {
    if (moveCount == 0) return;
    moveCount--;
    history.pop();
    loadHistoryMove();
  }

  function firstMove() {
    moveCount = 0;
    loadHistoryMove();
  }

  function prevMove() {
    if (moveCount == 0) return;
    moveCount--;
    loadHistoryMove();
  }

  function prevFewMoves(few) {
    if (moveCount == 0) return;
    if ((moveCount - few) >= 0) moveCount -= few;
    else firstMove();
    loadHistoryMove();
  }

  function nextMove() {
    if (moveCount == history.length-1) return;
    moveCount++;
    loadHistoryMove();
  }

  function nextFewMoves(few) {
    if (moveCount == history.length-1) return;
    if ((moveCount + few) <= history.length-1) moveCount += few;
    else lastMove();
    loadHistoryMove();
  }

  function lastMove() {
    moveCount = history.length-1
    loadHistoryMove();
  }

  function loadSgf(sgf) {
    for (let move of sgf.split(';')) {
      if (move.length) {
        if (move.charCodeAt(2) < 97 || move.charCodeAt(2) > 115) { continue; }
        //if (move.charCodeAt(2) == ']') { pass(); continue; }
        let player = move[0] == 'B' ? BLACK : WHITE;
        let col = move.charCodeAt(2)-97;
        let row = move.charCodeAt(3)-97;
        let sq = (row+1) * 21 + (col+1);
        setStone(sq, player, false);
      }
    } firstMove();
  }

  function saveSgf() {
    let sgf = '(;GM[1]FF[4]CA[UTF-8]AP[Kata Model JS]\n';
    sgf += 'RU[AGA]SZ[19]KM[]TM[600]OT[25/60 Canadian]\n';
    sgf += 'PW[White]PB[Black]DT[]RE[]\n';
    for (let item of history.slice(1, history.length)) {
      let col = item.move % 21;
      let row = Math.floor(item.move / 21);
      let color = item.side == BLACK ? 'W' : 'B';
      let coords = ' abcdefghijklmnopqrs';
      let move = coords[col] + coords[row];
      if (move == '  ') sgf += ';' + color + '[]'
      else sgf += ';' + color + '[' + move + ']';
    } sgf += ')'
    return sgf;
  }

  function init() { /* Init goban module */
    let container = document.getElementById('goban');
    canvas = document.createElement('canvas');
    canvas.style="margin-bottom: -3%;";
    container.appendChild(canvas);
    canvas.width = params.width;
    canvas.height = params.width;
    size = params.size+2;
    canvas.addEventListener('click', userInput);
    ctx = canvas.getContext('2d');
    cell = canvas.width / size;
    clearBoard();
    drawBoard();
    history.push({
      'ply': 0,
      'side': BLACK,
      'move': EMPTY,
      'board': JSON.stringify(board),
      'ko': ko
    });
    moveCount = history.length-1;
  }
  
  // PUBLIC API
  return {
    init: init(),
    BLACK: BLACK,
    WHITE: WHITE,
    importSgf: function(sgf) { return loadSgf(sgf); },
    exportSgf: function() { return saveSgf(); },
    position: function() { return board; },
    setKomi: function(komiVal) { komi = komiVal; },
    komi: function() { return komi; },
    history: function() { return history; },
    side: function() { return side; },
    ko: function() { return ko; },
    count: function(sq, color) { return count(sq, color); },
    liberties: function() { return liberties; },
    restore: function() { return restoreBoard(); },
    play: function(sq, color, user) { return setStone(sq, color, user); },
    handicap: function(stones) { return setHandicap(stones); },
    pass: function() { return pass(); },
    refresh: function() { return drawBoard(); },
    undoMove: function() { return undoMove(); },
    firstMove: function() { return firstMove(); },
    prevFewMoves: function(few) { return prevFewMoves(few); },
    prevMove: function() { return prevMove(); },
    nextMove: function() { return nextMove(); },
    nextFewMoves: function(few) { return nextFewMoves(few); },
    lastMove: function() { return lastMove(); }
  }
}
