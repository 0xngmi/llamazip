const { ethers } = require("hardhat");

async function deploy() {
    const owf = await ethers.getContractFactory("Owner");
    const ow = await owf.deploy();
    await ow.deployed();

    const lzf = await ethers.getContractFactory("LlamaZip");
    const lz = await lzf.deploy("0x1F98431c8aD98523631AE4a59f267346ea31F984", "0x4200000000000000000000000000000000000006", ow.address);
    await lz.deployed();

    return { ow, lz }
}

module.exports={deploy}