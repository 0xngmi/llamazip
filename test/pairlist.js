const { expect } = require("chai");
const { BigNumber } = require("ethers");
const { ethers } = require("hardhat");
const { deploy } = require('../scripts/deploy');

describe("PairList", function () {
    it("token order is correct", async function () {
        const { pl } = await deploy();
        for(let i=0; i<16; i++){
            const pair = await pl.getPool(BigNumber.from(i).shl(256-4))
            if(BigNumber.from(pair.token0).gt(pair.token1)){
                throw new Error(`Pool ${i} has the wrong order of tokens`)
            }
        }
    })
})