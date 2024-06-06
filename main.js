/** @param {NS} ns */
//return array of servers
function dpList(ns, current = "home", set = new Set()) {
    let connections = ns.scan(current)
    let next = connections.filter(c => !set.has(c))
    next.forEach(n => {
      set.add(n);
      return dpList(ns, n, set)
    })
    return Array.from(set.keys())
  }
  
  
  //calculate max thread count for script
  function threadCount(ns, hostname, scriptRam) {
    let threads = 0;
    let free_ram = ns.getServerMaxRam(hostname) - ns.getServerUsedRam(hostname)
  
    threads = free_ram / scriptRam
    return Math.floor(threads)
  }
  
  
  export async function main(ns) {
    let servers = dpList(ns)
    let target = "phantasy"
  
    for (let server of servers) {
      await ns.scp(["bin.wk.js", "bin.gr.js", "bin.hk.js"], server)
    }
  
    while (true) {
      //for each server on list
      for (let server of servers) {
        //if have root access to the server, do -
        if (ns.hasRootAccess(server) && ns.hasRootAccess(target)) {
          //if current sec > min, weaken
          if (ns.getServerSecurityLevel(target) > ns.getServerMinSecurityLevel(target)+5) {
            let available_threads = threadCount(ns, server, 1.75)
            if (available_threads >= 1) {
              ns.exec("bin.wk.js", server, available_threads, target)
            }
            //if current money < max money, grow
          } else if (ns.getServerMoneyAvailable(target) < ns.getServerMaxMoney(target)*0.80) {
            let available_threads = threadCount(ns, server, 1.75)
            if (available_threads >= 1) {
              ns.exec("bin.gr.js", server, available_threads, target)
            }
            //if ready, hack
          } else {
            let available_threads = threadCount(ns, server, 1.7)
            if (available_threads >= 1) {
              ns.exec("bin.hk.js", server, available_threads, target)
            }
          }
        }
        else {
          //open all ports on every server and nuke
          try {
            ns.brutessh(server)
            ns.ftpcrack(server)
            ns.relaysmtp(server)
            ns.httpworm(server)
            ns.sqlinject(server)
          } catch { }
  
          try {
            ns.nuke(server)
          } catch { }
        }
  
        await ns.sleep(10)
      }
    }
  
  
  }