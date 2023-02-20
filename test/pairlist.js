const { BigNumber } = require("ethers");
const { ethers } = require("hardhat");

describe("PairList", function () {
    it("token order is correct", async function () {
        const lzf = await ethers.getContractFactory("TestZip"); // using testzip since getPool is internal in llamazip
        const lz = await lzf.deploy("0x1F98431c8aD98523631AE4a59f267346ea31F984", "0x4200000000000000000000000000000000000006", "0x4200000000000000000000000000000000000006");
        await lz.deployed();

        for(let i=0; i<16; i++){
            const pair = await pl.getPool(BigNumber.from(i).shl(256-4))
            if(BigNumber.from(pair.token0).gt(pair.token1)){
                throw new Error(`Pool ${i} has the wrong order of tokens`)
            }
        }
    })
})