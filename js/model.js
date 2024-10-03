// DATA
const batches = 1;
const inputBufferLength = 19 * 19;
const inputBufferChannels = 22;
const inputGlobalBufferChannels = 19;
const global_inputs = new Float32Array(batches * inputGlobalBufferChannels);
var computerSide = 2;
var level = 'dan';

// PARSE PARAMS
const urlParams = new URLSearchParams(window.location.search);
try {
  setTimeout(function() {
    if (urlParams.get('komi')) goban.setKomi(parseFloat(urlParams.get('komi')));
    goban.handicap(parseInt(urlParams.get('handicap')));
    level = urlParams.get('level');
  }, 100);
} catch (e) { console.log(e); }

// QUERY MODEL
function inputTensor() { /* Convert GUI goban.position() to katago model input tensor */
  let katago = computerSide;
  let player = (3-computerSide);
  if (level == 'kyu') {
    player = computerSide;
    katago = (3-computerSide);
  }
  const bin_inputs = new Float32Array(batches * inputBufferLength * inputBufferChannels);
  for (let y = 0; y < 19; y++) {
    for (let x = 0; x < 19; x++) {
      sq_19x19 = (19 * y + x);
      sq_21x21 = (21 * (y+1) + (x+1))
      bin_inputs[inputBufferChannels * sq_19x19 + 0] = 1.0;
      if (goban.position()[sq_21x21] == katago) bin_inputs[inputBufferChannels * sq_19x19 + 1] = 1.0;
      if (goban.position()[sq_21x21] == player) bin_inputs[inputBufferChannels * sq_19x19 + 2] = 1.0;
      if (goban.position()[sq_21x21] == katago || goban.position()[sq_21x21] == player) {
        let libs_black = 0;
        let libs_white = 0;
        goban.count(sq_21x21, goban.BLACK);
        libs_black = goban.liberties().length;
        goban.restore();
        goban.count(sq_21x21, goban.WHITE);
        libs_white = goban.liberties().length;
        goban.restore();
        if (libs_black == 1 || libs_white == 1) bin_inputs[inputBufferChannels * sq_19x19 + 3] = 1.0;
        if (libs_black == 2 || libs_white == 2) bin_inputs[inputBufferChannels * sq_19x19 + 4] = 1.0;
        if (libs_black == 3 || libs_white == 3) bin_inputs[inputBufferChannels * sq_19x19 + 5] = 1.0;
      }
    }
  }
  if (sq_19x19 == goban.ko()) bin_inputs[inputBufferChannels * sq_19x19 + 6] = 1.0;
  let moveIndex = goban.history().length-1;
  if (moveIndex >= 1 && goban.history()[moveIndex-1].side == player) {
    let prevLoc1 = goban.history()[moveIndex-1].move;
    let x = prevLoc1 % 21;
    let y = Math.floor(prevLoc1 / 21);
    if (prevLoc1) bin_inputs[inputBufferChannels * (19 * y + x) + 9] = 1.0;
    else global_inputs[0] = 1.0;
    if (moveIndex >= 2 && goban.history()[moveIndex-2].side == katago) {
      let prevLoc2 = goban.history()[moveIndex-2].move;
      let x = prevLoc2 % 21;
      let y = Math.floor(prevLoc2 / 21);
      if (prevLoc2) bin_inputs[inputBufferChannels * (19 * y + x) + 10] = 1.0;
      else global_inputs[1] = 1.0;
      if (moveIndex >= 3 && goban.history()[moveIndex-3].side == player) {
        let prevLoc3 = goban.history()[moveIndex-3].move;
        let x = prevLoc3 % 21;
        let y = Math.floor(prevLoc3 / 21);
        if (prevLoc3) bin_inputs[inputBufferChannels * (19 * y + x) + 11] = 1.0;
        else global_inputs[2] = 1.0;
        if (moveIndex >= 4 && goban.history()[moveIndex-4].side == katago) {
          let prevLoc4 = goban.history()[moveIndex-4].move;
          let x = prevLoc4 % 21;
          let y = Math.floor(prevLoc4 / 21);
          if (prevLoc4) bin_inputs[inputBufferChannels * (19 * y + x) + 12] = 1.0;
          else global_inputs[3] = 1.0;
          if (moveIndex >= 5 && goban.history()[moveIndex-5].side == player) {
            let prevLoc5 = goban.history()[moveIndex-5].move;
            let x = prevLoc5 % 21;
            let y = Math.floor(prevLoc5 / 21);
            if (prevLoc5) bin_inputs[inputBufferChannels * (19 * y + x) + 13] = 1.0;
            else global_inputs[4] = 1.0;
          }
        }
      }
    }
  }
  let selfKomi = (computerSide == goban.WHITE ? goban.komi()+1 : -goban.komi());
  global_inputs[5] = selfKomi / 20.0
  return bin_inputs;
}

async function play() { /* Play best move */
  if (editMode) return;
  document.getElementById('stats').innerHTML = 'KataNet is thinking...';
  computerSide = goban.side();
  const bin_inputs = inputTensor();
  try {
    tf.setBackend("cpu");
    const model = await tf.loadGraphModel("./model/b10c128-s1141046784-d204142634/model.json");
    const results = await model.executeAsync({
        "swa_model/bin_inputs": tf.tensor(bin_inputs, [batches, inputBufferLength, inputBufferChannels], 'float32'),
        "swa_model/global_inputs": tf.tensor(global_inputs, [batches, inputGlobalBufferChannels], 'float32')
    });
    let policyTensor = results[1].reshape([-1]);
    let flatPolicyArray = await policyTensor.array();
    let scores = results[2];
    let flatScores = scores.dataSync();
    console.log(flatScores)
    console.log(flatPolicyArray);
    console.log(results[1].shape)
    let copyPolicy = JSON.parse(JSON.stringify(flatPolicyArray));
    let topPolicies = copyPolicy.sort((a, b) => b - a).slice(0, 5);
    let topMoves = [];
    for (let move of topPolicies) topMoves.push(flatPolicyArray.indexOf(move));
    for (let move = 0; move < topMoves.length; move++) {
      if (goban.history().length < 10) move = Math.floor(Math.random() * 3);
      let best_19 = topMoves[move];
      let row_19 = Math.floor(best_19 / 19);
      let col_19 = best_19 % 19;
      let scoreLead = (flatScores[2]*20).toFixed(2);
      let katagoColor = computerSide == goban.BLACK ? 'Black' : 'White';
      let playerColor = (3-computerSide) == goban.BLACK ? 'Black' : 'White';
      if (level == 'kyu') {
        scoreLead -= (20+goban.komi());
        scoreLead = scoreLead.toFixed(2);
        katagoColor = (3-computerSide) == goban.BLACK ? 'Black' : 'White';
        playerColor = computerSide == goban.BLACK ? 'Black' : 'White';
      }
      document.getElementById('stats').innerHTML = (scoreLead > 0 ? (katagoColor + ' leads by ') : (playerColor + ' leads by ')) + Math.abs(scoreLead) + ' points';
      let bestMove = 21 * (row_19+1) + (col_19+1);
      if (!goban.play(bestMove, computerSide, false)) {
        if (move != topMoves.length-1) continue;
        alert('Pass');
        goban.pass();
      } goban.refresh(); break;
    }
  } catch (e) {
    console.log(e);
  }
}

async function eval() { /* Estimate score */
  document.getElementById('stats').innerHTML = 'KataNet is estimating score...';
  computerSide = goban.side();
  const bin_inputs = inputTensor();
  try {
    tf.setBackend("cpu");
    const model = await tf.loadGraphModel("./models/b10c128-s1141046784-d204142634/model.json");
    const results = await model.executeAsync({
        "swa_model/bin_inputs": tf.tensor(bin_inputs, [batches, inputBufferLength, inputBufferChannels], 'float32'),
        "swa_model/global_inputs": tf.tensor(global_inputs, [batches, inputGlobalBufferChannels], 'float32')
    });
    let scores = results[2];
    let flatScores = scores.dataSync(2);
    let scoreLead = (flatScores[2]*20).toFixed(2);
    let katagoColor = computerSide == goban.BLACK ? 'Black' : 'White';
    let playerColor = (3-computerSide) == goban.BLACK ? 'Black' : 'White';
    document.getElementById('stats').innerHTML = (scoreLead > 0 ? (katagoColor + ' leads by ') : (playerColor + ' leads by ')) + Math.abs(scoreLead) + ' points';
  } catch (e) {
    console.log(e);
  }
}
