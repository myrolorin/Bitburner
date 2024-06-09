var homeServer = "home";

export function getNetworkNodes(ns) {
    // Depth first search traversal
    ns.print("Retrieving all nodes in the network");
    var visited = {};
    var stack = [];
    var origin = ns.getHostname();
    stack.push(origin);

    while (stack.length > 0) {
        var node = stack.pop();
        if (!visited[node]) {
            var neighbours = ns.scan(node);
            for (var i = 0; i < neighbours.length; ++i) {
                var child = neighbours[i];
                if (visited[child]) {
                    continue;
                }
                stack.push(child)
            }
        }
    }
    return Object.keys(visited);
}

export function penetrate(server) {
    ns.print("Penetrating " + server);
    for (var file of Object.keys(cracks)) {
        if (ns.fileExists(file, homeServer)) {
            var runScript = cracks[file];
            runScript(server);
        }
    }
}

function getNumCracks() {
    return Object.keys(cracks).filter(function (file) {
        return ns.fileExists(file, homeServer);
    }).length;
}

export function canPenetrate(ns, server, cracks) {
    var numCracks = getNumCracks(ns, cracks);
    var reqPorts = ns.getServerNumPortsRequired(server);
    return numCracks >= reqPorts;
}

export function canHack(ns, server) {
    var pHackLvl = ns.getHackingLevel(); //player
    var sHackLvl = ns.getServerRequiredHackingLevel(server);
    return pHackLvl >=sHackLvl;
}

export function hasRam(ns, server) {
    var ramAvail = ns.getServerMaxRam(server);
    return ramAvail > virusRam;
}

export function getTotalScriptRam(ns, scripts) {
    return scripts.reduce((sum, script) => {
        sum += ns.getScriptRam(script);
        return sum;
    }, 0)
}