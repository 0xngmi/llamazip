const func = async function (hre) {
    const {deployments, getNamedAccounts} = hre;
    const {deploy} = deployments;
    
    if(process.env.DEPLOY !== "true"){
      throw new Error("DEPLOY env var must be true")
    }
  
    const {deployer} = await getNamedAccounts();
    const PairListDeployment = await deployments.get('PairList');
  
    await deploy('LlamaZip', {
      from: deployer,
      args: ["0x5c69bee701ef814a2b6a3edd4b1652cb9cc5aa6f", "0x4200000000000000000000000000000000000006", PairListDeployment.address],
      log: true,
      autoMine: true, // speed up deployment on local network (ganache, hardhat), no effect on live networks
      //deterministicDeployment: true,
    });
  };
  module.exports = func;
  func.tags = ['LlamaZip'];
  func.dependencies = ['PairList'];