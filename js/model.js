// DATA
const batches = 1;
const inputBufferLength = 19 * 19;
const inputBufferChannels = 22;
const inputGlobalBufferChannels = 19;
const global_inputs = new Float32Array(batches * inputGlobalBufferChannels);

// PARSE PARAMS
try {
  const urlParams = new URLSearchParams(window.location.search);
  const computer_side = urlParams.get('side');
  komi = parseFloat(urlParams.get('komi'));
  global_inputs[5] = komi / 20.0
  if (computer_side == 'black') play();
} catch (e) { komi = 6.5; }

// QUERY MODEL
function boardTensor() { /* Convert GUI board to katago model input tensor */
  const bin_inputs = new Float32Array(batches * inputBufferLength * inputBufferChannels);
  for (let y = 0; y < 19; y++) {
    for (let x = 0; x < 19; x++) {
      sq_19x19 = (19 * y + x);
      sq_21x21 = (21 * (y+1) + (x+1))
      bin_inputs[inputBufferChannels * sq_19x19 + 0] = 1.0;
      if (board[sq_21x21] == BLACK) bin_inputs[inputBufferChannels * sq_19x19 + 1] = 1.0;
      if (board[sq_21x21] == WHITE) bin_inputs[inputBufferChannels * sq_19x19 + 2] = 1.0;
      if (board[sq_21x21] == BLACK || board[sq_21x21] == WHITE) {
        let libs_black = 0;
        let libs_white = 0;
        count(sq_21x21, BLACK);
        libs_black = liberties.length;
        restoreBoard();
        count(sq_21x21, WHITE);
        libs_white = liberties.length;
        restoreBoard();
        if (libs_black == 1 || libs_white == 1) bin_inputs[inputBufferChannels * sq_19x19 + 3] = 1.0;
        if (libs_black == 2 || libs_white == 2) bin_inputs[inputBufferChannels * sq_19x19 + 4] = 1.0;
        if (libs_black == 3 || libs_white == 3) bin_inputs[inputBufferChannels * sq_19x19 + 5] = 1.0;
        if (sq_19x19 == ko) bin_inputs[inputBufferChannels * sq_19x19 + 6] = 1.0;
      }
    }
  } return bin_inputs;
}

async function play() { /* Query KataGo network */
  const bin_inputs = boardTensor();
  try {
    tf.setBackend("cpu");
    const model = await tf.loadGraphModel("./models/b10c128-s1141046784-d204142634/model.json");
    const results = await model.executeAsync({
        "swa_model/bin_inputs": tf.tensor(bin_inputs, [batches, inputBufferLength, inputBufferChannels], 'float32'),
        "swa_model/global_inputs": tf.tensor(global_inputs, [batches, inputGlobalBufferChannels], 'float32')
    });
    let policyTensor = results[1].reshape([-1]);
    let flatPolicyArray = await policyTensor.array();
    let scores = results[2];
    let flatScores = scores.dataSync(2);
    let best_19 = flatPolicyArray.indexOf(Math.max.apply(Math, flatPolicyArray));
    let row_19 = Math.floor(best_19 / 19);
    let col_19 = best_19 % 19;
    let scoreLead = (flatScores[2]*20 + komi).toFixed(2);
    document.getElementById('stats').innerHTML = (scoreLead > 0 ? 'Black leads by ': 'White leads by ') + Math.abs(scoreLead) + ' points';
    let bestMove = 21 * (row_19+1) + (col_19+1);
    if (!setStone(bestMove, side, false)) {
      alert('Pass');
      side = 3 - side;
      ko = 0;
    }
    drawBoard();
  } catch (e) {
    console.log(e);
  }
}
