// DATA
const batches = 1;
const inputBufferLength = 19 * 19;
const inputBufferChannels = 22;
const inputGlobalBufferChannels = 19;
const global_inputs = new Float32Array(batches * inputGlobalBufferChannels);
global_inputs[5] = -0.5; // コミ 15目=1.0
global_inputs[6] = 1; // positional ko
global_inputs[7] = 0.5; // positional ko
global_inputs[8] = 1; // multiStoneSuicideLegal
global_inputs[13] = -0.5; // ?

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
        let libs = 0;
        count(sq_21x21, side);
        libs = liberties.length;
        restoreBoard();
        if (libs == 1) bin_inputs[inputBufferChannels * sq_19x19 + 3] = 1.0;
        if (libs == 2) bin_inputs[inputBufferChannels * sq_19x19 + 4] = 1.0;
        if (libs == 3) bin_inputs[inputBufferChannels * sq_19x19 + 5] = 1.0;
        if (sq_19x19 == ko) bin_inputs[inputBufferChannels * sq_19x19 + 6] = 1.0;
      }
    }
  } return bin_inputs;
}

async function play() { /* Query KataGo network */
  const bin_inputs = boardTensor();
  try {
    tf.setBackend("cpu");
    const model = await tf.loadGraphModel("./models/kata1-b6c96-s175395328-d26788732/model.json");
    const results = await model.executeAsync({
        "swa_model/bin_inputs": tf.tensor(bin_inputs, [batches, inputBufferLength, inputBufferChannels], 'float32'),
        "swa_model/global_inputs": tf.tensor(global_inputs, [batches, inputGlobalBufferChannels], 'float32')
    });

    const policyTensor = results[3];
    const policyArray = await policyTensor.slice([0, 0, 0], [1, 1, 361]).array();
    const flatPolicyArray = policyArray[0][0]; // Flatten to 1D array

    console.log('Policy probabilities in 19x19 board format:');
    for (let y = 0; y < 19; y++) {
      let row = flatPolicyArray.slice(19 * y, 19 * (y + 1)).map(p => p.toFixed(2)).join(' ');
      console.log(row);
    }

    let best_19 = flatPolicyArray.indexOf(Math.max.apply(Math, flatPolicyArray));
    let row_19 = Math.floor(best_19 / 19);
    let col_19 = best_19 % 19;
    console.log('best move: ' + col_19 + ' ' + row_19)
    let bestMove = 21 * (row_19+1) + (col_19+1);
    setStone(bestMove, side, true);
    drawBoard();
  } catch (e) {
      console.log(e);
  }
}
