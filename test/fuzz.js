const { expect } = require("chai");
const { BigNumber } = require("ethers");
const { ethers } = require("hardhat");
const { encode } = require('../scripts/utils');

describe("LlamaZip", function () {
    it("fuzzing", async function () {
        const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min; // [min, max] inclusive

        const [owner] = await ethers.getSigners();
        const lzf = await ethers.getContractFactory("TestZip");
        const lz = await lzf.deploy("0x1F98431c8aD98523631AE4a59f267346ea31F984", "0x4200000000000000000000000000000000000006", "0x4200000000000000000000000000000000000006");
        await lz.deployed();

        for(let i=0; i<1000; i++){
            const pair = randomInt(0, 15);
            const direction = randomInt(0, 1) === 0
            const expectedReturnAmount = randomInt(0, 9007199254740991)
            const amountIn = randomInt(0, 9007199254740991)
            const slippage = ["0.5", "0.1", "1", "5"][randomInt(0,3)]
            const inputIsETH = [0,1,3,5,6].includes(pair) && direction === true;
            const pool = await lz.getPool(BigNumber.from(pair).shl(256-4))
            const [token0, token1] = direction?[pool.token0, pool.token1]: [pool.token1, pool.token0]

            let extraBits = 0;
            let newExpected = expectedReturnAmount
            while(newExpected > 131071){
                newExpected = Math.floor(newExpected/2);
                extraBits++;
            }
            newExpected++;
            newExpected *= 2**extraBits;
            
            const minOutputAmount = BigNumber.from(newExpected).mul(1000-(slippage*10)).div(1000)
            /*
            console.log(newExpected/expectedReturnAmount)
            console.log(String(pair), direction,
            expectedReturnAmount,
            newExpected,
            slippage,
            inputIsETH,
            false,
            amountIn, minOutputAmount.toString())
            */

            expect(newExpected/expectedReturnAmount).to.be.gt(1)
            expect(newExpected/expectedReturnAmount).to.be.lt(1.0001) // max 0.1% deviation

            await expect(owner.sendTransaction({
                to: lz.address,
                data: encode(String(pair), direction,
                    expectedReturnAmount,
                    slippage,
                    inputIsETH,
                    false,
                    amountIn
                ),
                ...(inputIsETH?{value:amountIn}:null)
            })).to.emit(lz, "Numbers")
            .withArgs(token0, token1, pool.fee, amountIn, newExpected, minOutputAmount);
        }
    })
})