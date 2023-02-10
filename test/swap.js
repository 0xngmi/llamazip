const { expect } = require("chai");
const { BigNumber } = require("ethers");
const { ethers } = require("hardhat");
const { encode } = require('../scripts/utils');
const { deploy } = require('../scripts/deploy');

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

        // swap with <3 bits
    })
})