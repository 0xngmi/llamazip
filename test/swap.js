const { expect } = require("chai");
const { BigNumber } = require("ethers");
const { ethers } = require("hardhat");
const { encode } = require('../scripts/utils');

async function deploy() {
    const plf = await ethers.getContractFactory("PairList");
    const pl = await plf.deploy();
    await pl.deployed();

    const lzf = await ethers.getContractFactory("LlamaZip");
    const lz = await lzf.deploy("0x1f98431c8ad98523631ae4a59f267346ea31f984", "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2", pl.address);
    await lz.deployed();

    return { pl, lz }
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
            "0.5",
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
        expect(Number(await USDC.balanceOf(lz.address))).to.be.approximately(500e6, 100e6)
        expect(await USDC.balanceOf(owner.address)).to.be.above(1000e6)

        await USDC.approve(lz.address, "999999999999999999999999999999")

        await owner.sendTransaction({
            to: lz.address,
            data: encode("1", true, // USDC -> ETH
                ethers.utils.parseUnits("0.5", "ether"),
                "1",
                false,
                false,
                "1000000000" // 1k USDC
            ),
        })
    })
})