const { expect } = require("chai");
const { BigNumber } = require("ethers");
const { ethers, network } = require("hardhat");
const { sign, deployAll } = require('../scripts/utils');

async function deploy() {
    const plf = await ethers.getContractFactory("PairList");
    const pl = await plf.deploy();
    await pl.deployed();

    const lzf = await ethers.getContractFactory("LlamaZip");
    const lz = await lzf.deploy("0x1f98431c8ad98523631ae4a59f267346ea31f984", "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2", pl.address);
    await lz.deployed();

    return { pl, lz }
}

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

describe("LlamaZip", function () {
    it("can do a swap", async function () {
        const [owner] = await ethers.getSigners();
        const USDC = new ethers.Contract("0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", 
        ["function balanceOf(address account) external view returns (uint256)", "function approve(address spender, uint256 amount) external returns (bool)"], owner)
        const { pl, lz } = await deploy()
        await pl.setPool(BigNumber.from("1").shl(256-4), "0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640") // usdc/eth 0.05%
        const firstCalldata = encode("1", false, // ETH->USDC
            "1000000000", // 1k USDC
            true,
            false,
            ""
        )

        const prevEth = await ethers.provider.getBalance(owner.address);
        await owner.sendTransaction({
            to: lz.address,
            data: firstCalldata,
            value: ethers.utils.parseUnits("1", "ether")
        })
        const postEth = await ethers.provider.getBalance(owner.address);

        expect(Number(prevEth.sub(postEth).toString())).to.be.approximately(1e18, 1e16)
        expect(await USDC.balanceOf(lz.address)).to.equal(0)
        expect(await USDC.balanceOf(owner.address)).to.be.above(1000e6)

        await USDC.approve(lz.address, "999999999999999999999999999999")

        await owner.sendTransaction({
            to: lz.address,
            data: encode("1", true, // USDC -> ETH
                ethers.utils.parseUnits("0.5", "ether"),
                false,
                false,
                "1000000000" // 1k USDC
            ),
        })
    })
})