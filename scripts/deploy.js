const { ethers } = require("hardhat");

async function deploy() {
    const plf = await ethers.getContractFactory("PairList");
    const pl = await plf.deploy();
    await pl.deployed();

    const lzf = await ethers.getContractFactory("LlamaZip");
    const lz = await lzf.deploy("0x1f98431c8ad98523631ae4a59f267346ea31f984", "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2", pl.address);
    await lz.deployed();

    return { pl, lz }
}

module.exports={deploy}