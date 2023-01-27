const { BigNumber } = require("ethers");

function countBits(num) {
  let bitlength = 0;
  let inputNum = BigNumber.from(num)
  while (!inputNum.isZero()) {
      inputNum = inputNum.div(2)
      bitlength++;
  }
  return bitlength
}

function removeFirstBit(word){
  // To work this requires that word has a number of bits that is multiple of 8 + the starting bit
  return word.toHexString().replace("0x01", "0x") // toHexString() normalizes to byte length, so we need to remove 2 nibbles
}

function encode(pair, token0IsTokenIn, minReturnAmount, inputIsETH, maxBalance, inputAmount) {
  let word = BigNumber.from(1).shl(4).add(pair).shl(1)
  if (token0IsTokenIn) {
      word = word.add(1)
  }
  word = word.shl(14)
  let slippageZeroes = 0;
  let slippageNum = BigNumber.from(minReturnAmount)
  while (slippageNum > 16383) { // 0b11111111111111
      slippageZeroes++;
      slippageNum = slippageNum.div(2)
  }
  word = word.add(slippageNum).shl(8).add(slippageZeroes)
  if (inputIsETH || maxBalance) {
      return removeFirstBit(word.shl(5)) // pad it so total number of bits is a multiple of 8
  }

  let inputZeroes = 0;
  let inputNum = BigNumber.from(inputAmount)
  while (inputNum % 10 == 0 && inputNum !== 0) {
      inputZeroes++;
      inputNum = inputNum.div(10);
  }
  word = word.shl(5).add(inputZeroes)
  let inputBitlength = countBits(inputNum)
  word = word.shl(inputBitlength + (8 - inputBitlength % 8))
  return removeFirstBit(word.add(inputNum))
}

module.exports = {
  encode
}