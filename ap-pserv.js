/** @param {NS} ns */
export async function main(ns) {
    var target = ns.args[0]; //changing target
    var homeServ = "home"; //home server as a var
    var pRam = 8; //purchased ram
    var servPrefix = "pserv-"
  
    var maxRam = ns.getPurchasedServerMaxRam();
    var maxServers = ns.getPurchasedServerLimit();
  
    function canPurchaseServer() {
      return ns.getServerMoneyAvailable(homeServ) > ns.getPurchasedServerCost(pRam);
    }
  
    /*function killVirus(server) {
      if (ns.scriptRunning(virus, server)) {
        ns.scriptKill(virus, server);
      }
    }*/
  
    async function shutdownServer(server) {
      //killVirus(server);
      ns.deleteServer(server);
    }
  
    /*async function copyAndRunVirus(server) {
      await ns.scp(virus, server);
      killVirus(server);
      var maxThreads = Math.floor(pRam / virusRam);
      ns.exec(virus, server, maxThreads, target)
    }*/
  
    async function upgradeServer(server) {
      var sRam = ns.getServerMaxRam(server)
      if (sRam < pRam) {
        while(!canPurchaseServer()) {
          await ns.sleep(10000);
        }
        shutdownServer(server);
        ns.purchaseServer(server, pRam);
      }
      //await copyAndRunVirus(server);
    }
  
  
    async function autoUpgradeServers() {
      var i = 0
      while(i < maxServers) {
        var server = servPrefix + i;
        if (ns.serverExists(server)) {
          ns.print("Upgrading server " + server + " to " + pRam + "GB");
          await upgradeServer(server);
          ++i;
        } else if (canPurchaseServer()) {
          ns.print("Purchasing server " + server + " at " + pRam + "GB");
          ns.purchaseServer(server, pRam);
          //await copyAndRunVirus(server);
          ++i;
        }
      }
    }
  
    while(true) {
      await autoUpgradeServers();
      if (pRam === maxRam) {
        break;
      }
      var newRam = pRam * 2;
      if (newRam > maxRam) {
        pRam = maxRam;
      } else {
        pRam = newRam;
      }
      /*if (!canPurchaseServer() && (newRam = 1048576)) {
        await ns.tprint("Max upgrades reached!");
        return false
      }*/
    }
  
  
  }