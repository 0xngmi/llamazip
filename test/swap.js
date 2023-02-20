const { expect } = require("chai");
const { BigNumber } = require("ethers");
const { ethers } = require("hardhat");
const { encode } = require('../scripts/utils');
const { deploy } = require('../scripts/deploy');

describe("LlamaZip", function () {
    it("can do a swap", async function () {
        const [owner] = await ethers.getSigners();
        const USDC = new ethers.Contract("0x7F5c764cBc14f9669B88837ca1490cCa17c31607",
        ["function balanceOf(address account) external view returns (uint256)", "function approve(address spender, uint256 amount) external returns (bool)"], owner)
        const { ow, lz } = await deploy()
        const firstCalldata = encode("0", true, // ETH->USDC
            "1000000000", // 1k USDC
            "0.5",
            true,
            false,
            ""
        )

        const prevEth = await ethers.provider.getBalance(owner.address);
        const firstSwapTx = await owner.sendTransaction({
            to: lz.address,
            data: firstCalldata,
            value: ethers.utils.parseUnits("1", "ether")
        })
        console.log(Number((await firstSwapTx.wait()).gasUsed))
        const postEth = await ethers.provider.getBalance(owner.address);

        expect(Number(prevEth.sub(postEth).toString())).to.be.approximately(1e18, 1e16)
        expect(Number(await USDC.balanceOf(lz.address))).to.be.approximately(700e6, 100e6)
        expect(await USDC.balanceOf(owner.address)).to.be.above(1000e6)

        await USDC.approve(lz.address, "999999999999999999999999999999")

        await owner.sendTransaction({
            to: lz.address,
            data: encode("0", false, // USDC -> ETH
                ethers.utils.parseUnits("0.5", "ether"),
                "1",
                false,
                false,
                "1000000000" // 1k USDC
            ),
        })

        const receiver = "0xd1a7a573716d3834ad9ad2dc4b366061d636de52"
        expect(Number(await USDC.balanceOf(receiver))).to.be.eq(0)
        await ow.sweepTokenFromRouter(lz.address, USDC.address, 300e6, receiver)
        await ow.sweepTokenFromRouter(lz.address, "0x4200000000000000000000000000000000000006", 13334479, receiver);
        expect(Number(await USDC.balanceOf(receiver))).to.be.eq(300e6)
    })

    it("add pool and swap", async function () {
        const [owner] = await ethers.getSigners();
        const lyra = new ethers.Contract("0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb",
        ["function balanceOf(address account) external view returns (uint256)", "function approve(address spender, uint256 amount) external returns (bool)"], owner)
        const { ow, lz } = await deploy()

        const tx = {
            to: lz.address,
            data: encode("12", true, // ETH->USDC
                "1000000", // 1e6 lyra
                "0.5",
                true,
                false,
                ""
            ),
            value: ethers.utils.parseUnits("1", "ether")
        }

        await expect(
            owner.sendTransaction(tx)
        ).to.be.revertedWith("function call to a non-contract account");

        await ow.setPool(lz.address, BigNumber.from("12").shl(256-4), "0xf334f6104a179207ddacfb41fa3567feea8595c2") // eth/lyra https://info.uniswap.org/#/optimism/pools/0xf334f6104a179207ddacfb41fa3567feea8595c2

        expect(Number(await lyra.balanceOf(owner.address))).to.be.eq(0)
        await owner.sendTransaction(tx)
        expect(Number(await lyra.balanceOf(owner.address))).to.be.approximately(1e6, 10)
    })
})