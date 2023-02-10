const { ethers } = require("hardhat");

async function deploy() {
    const plf = await ethers.getContractFactory("PairList");
    const pl = await plf.deploy();
    await pl.deployed();

    const lzf = await ethers.getContractFactory("LlamaZip");
    const lz = await lzf.deploy("0x1F98431c8aD98523631AE4a59f267346ea31F984", "0x4200000000000000000000000000000000000006", pl.address);
    await lz.deployed();

    return { pl, lz }
}

module.exports={deploy}