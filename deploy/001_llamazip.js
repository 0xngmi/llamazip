const func = async function (hre) {
    const {deployments, getNamedAccounts} = hre;
    const {deploy} = deployments;
    
    if(process.env.DEPLOY !== "true"){
      throw new Error("DEPLOY env var must be true")
    }
  
    const {deployer} = await getNamedAccounts();
    const OwnerDeployment = await deployments.get('Owner');
  
    await deploy('LlamaZip', {
      from: deployer,
      args: ["0x1F98431c8aD98523631AE4a59f267346ea31F984", "0x4200000000000000000000000000000000000006", OwnerDeployment.address],
      log: true,
      autoMine: true, // speed up deployment on local network (ganache, hardhat), no effect on live networks
      //deterministicDeployment: true,
    });
  };
  module.exports = func;
  func.tags = ['LlamaZip'];
  func.dependencies = ['Owner'];