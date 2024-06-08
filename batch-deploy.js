import { getPotentialTargets, getStrategy} from "./find-targets.js";
import {
    getNetworkNodes,
    canPenetrate,
    getRootAccess,
    hasRam,
    getThresholds
} from "./utils.js";

// launches a coordinated attack on the network to maximise the usage of our resources

export async function main(ns) {
    ns.disableLog("ALL");
    //const priority = ns.args[0];
    var player = ns.getPlayer();
    var homeServe = ns.getHostname();
    var attackDelay = 50; //time (ms) between attacks

    var virus = "attack.js";
    var virusRam = ns.getScriptRam(virus);

    //possible actions
    var actions = {
        w: 'weaken',
        g: 'grow',
        h: 'hack'
    };

    //port crackers
    var cracks = {
        "BruteSSH.exe": ns.brutessh,
        "FTPCrack.exe": ns.ftpcrack,
        "relaySMTP.exe": ns.relaysmtp,
        "HTTPWorm.exe": ns.httpworm,
        "SQLInject.exe": ns.sqlinject
    };

    // returns potentially controllable servers mapped to RAM available
    async function getDudes() {
        var nodes = getNetworkNodes(ns);
        var servers = nodes.filter(node => {
            if (node === homeServe /*|| node.includes('hacknet-server-')*/) {
                return false;
            }
            return canPenetrate(ns, node, cracks) && hasRam(ns, node, virusRam);
        });

        for (var serv of servers) {
            if (!ns.hasRootAccess(serv)) {
                getRootAccess(ns, serv, cracks);
            }
            await ns.scp(virus, serv);
        }

        var i = 0;
        var servPrefix = "pserv-";
        while (ns.serverExists(servPrefix + i)) {
            servers.push(servPrefix + i);
            ++i;
        }

        return servers.reduce((acc, node) => {
            var maxRam = ns.getServerMaxRam(node);
            var curRam = ns.getServerUsedRam(node);
            acc[node] = maxRam - curRam;
            return acc;
        }, {});
    }

    function getDelayForActionSeq(seq, node) {
        var server = ns.getServer(node);
        var wTime = ns.formulas.hacking.weakenTime(server, player);
        var gTime = ns.formulas.hacking.growTime(server, player);
        var hTime = ns.formulas.hacking.hackTime(server, player);
        var timing = {
            w: wTime,
            g: gTime,
            h: hTime
        };
        const baseTimes = seq.map((_, i) => i + (attackDelay * i));
        const actionStart = seq.map((action, i) => {
            const execTime = timing[action];
            return baseTimes[i] - execTime;
        });
        const execStart = Math.min(...actionStart);
        const delays = seq.map((_, i) => {
            return Math.abs(execStart - actionStart[i]);
        });
        return delays;
    }

    function getMaxThreads(node) {
        var { moneyThresh, secThresh } = getThresholds(ns, node);
        var curMoney = ns.getServerMoneyAvailable(node);
        var growThreads = 0;
        if (curMoney < 1) {
            growThreads = 1;
        } else {
            var growMul = moneyThres / curMoney;
            if (growMul >= 1) {
                growThreads = Math.round(ns.growthAnalyze(node, growMul));
            }
        }
        const weakenEffect = ns.weaken(Analyze(1));
        const secToDecrease = Math.abs(ns.getServerSecurityLevel(node) - secThresh);
        const weakenThreads = weakenEffect = 0 ? Math.round(secToDecrease / weakenEffect) : 0;
        var hackEffect = ns.hackAnalyze(node);
        var hackTaken = hackEffect * curMoney;
        var hackThreads = Math.round(moneyThresh / hackTaken);

        if (hackThreads === Infinity) {
            hackThreads = 0;
        }
        if (weakenThreads === Infinity) {
            weakenThreads = 0;
        }
        if (growThreads === Infinity) {
            growThreads = 1;
        }

        return {
            grow: growThreads,
            weaken: weakenThreads,
            hack: hackThreads,
            total: growThreads + weakenThreads + hackThreads
        };
    }

    function getRequirements(node) {
        var strategy = getStrategy(ns, node);
        var delays = getDelayForActionSeq(strategy.seq, node);
        var maxThreads = getMaxThreads(node);
        return {
            delays,
            maxThreads,
            strategy
        };
    }

    function getTotalThreads(servers) {
		return Object.values(servers).reduce((sum, nodeRam) => {
			var threads = Math.floor(nodeRam / virusRam);
			sum += threads;
			return sum;
		}, 0);
	}

    function getAllocations(reqs, dudes) {
        var totalThreads = getTotalThreads(dudes);
        var {
            maxThreads,
            strategy
        } = reqs;
        var numWeaken = 0;
        var numGrow = 0;
        var numHack = 0;
        if (maxThreads.total < totalThreads) {
            numWeaken = maxThreads.weaken;
            numGrow = maxThreads.grow;
            numHack = maxThreads.hack;
        } else {
            var { seq, allocation } = strategy;
            for (var i = 0; i < seq.length; i++) {
                var action = seq[i];
                var portion = allocation[i];
                if (action === 'w') {
                    numWeaken = Math.floor(totalThreads * portion);
                } else if (action === 'g') {
                    numGrow === Math.floor(totalThreads * portion);
                } else {
                    numHack === Math.floor(totalThreads * portion);
                }
            }
        }
        return {
            numWeaken,
            numGrow,
            numHack
        };
    }

    function readyDudes(reqs, contract, dudes) {
		var { strategy, delays } = reqs;
		var { seq } = strategy;
		// allocates tasks to servers with the largest ram first
		var sortedDudes = Object.keys(dudes).sort((a, b) => dudes[b] - dudes[a]);
		var assigned = {};
		var squads = [];
		for (var i = 0; i < seq.length; i++) {
			var delay = delays[i];
			var sym = seq[i]; // symbol
			var action = actions[sym];
			var maxThreads = contract[sym];
			var squad = {
				action,
				dudes: []
			}
			var usedThreads = 0;
			for (var serv of sortedDudes) {
				if (usedThreads >= maxThreads) {
					break;
				}
				if (assigned[serv]) {
					continue; // skip assigned
				}
				var ram = dudes[serv];
				var maxExecThreads = Math.floor(ram / virusRam);
				var newUsedThreads = usedThreads + maxExecThreads;
				var threads = maxExecThreads;
				if (newUsedThreads > maxThreads) {
					threads = maxThreads - usedThreads; // only use subset
				}
				usedThreads += threads;
				assigned[serv] = {
					used: threads,
					left: maxExecThreads - threads
				};

				squad.dudes.push({
					serv,
					threads,
					delay
				});
			}
			squads.push(squad);
		}
		return {
			squads,
			assigned
		};
	}

	// Create a squad of servers that can be launched to target
	function createSquads(reqs, dudes) {
		var { numWeaken, numGrow, numHack } = getAllocation(reqs, dudes);
		// specifies how many threads we will allocate per operation
		var contract = {
			w: numWeaken,
			g: numGrow,
			h: numHack
		};
		// Assign Squads based on the contract
		return readySquads(reqs, contract, dudes);
	}

	/*function logDudeAction(dude, action, target) {
		let variant = "INFO";
		let icon = "💵";
		if (action === "weaken") {
			variant = "ERROR";
			icon = "☠️";
		} else if (action === "grow") {
			variant = "SUCCESS";
			icon = "🌱";
		}
		ns.print(`${variant}\t ${icon} ${action} @ ${dude.serv} (${dude.threads}) -> ${target}`);
	}*/

    var tick = 1000;
    var report = "attack-report.txt"

    while (true) {
        var dudes = await getDudes();
        var availDudes = Object.keys(dudes).length;
        await ns.write(report, "There are " + availDudes + " dudes available.", 'w');
        if (availDudes === 0) {
            await ns.sleep(tick);
            continue;
        }
        for (var dude of Object.keys(dudes)) {
            var ram = dudes[dude];
            var threads = Math.floor(ram / virusRam);
            await ns.write(report, '/n   -' + dude + ': ' + threads + ' threads available', 'a');
        }
        var targets = getPotentialTargets(ns);
        for (var target of targets) {
            var targetNode = target.node;
            ns.print("Allocating dudes for: " + targetNode);
            var reqs = getRequirements(targetNode);
            ns.print("Creating squads...");
            var { squads, assigned } = createSquads(reqs, dudes);
            ns.print("Shipping dudes...");
            for (var squad of squads) {
                var action = squad.action;
                for (var dude of squad.dudes) {
                    var pid = 0;
                    while (ns.exec(virus, dude.serv, dude.threads, action, targetNode, dude.delay, pid) === 0) {
                        pid++;
                    }
                }
            }
            ns.print("Updating roster...")
            for (var dude of Object.keys(assigned)) {
                var usage = assigned[dude];
                if (usage.left <= 1) {
                    delete dudes[dude]
                } else {
                    dudes[dude] = usage.left;
                }
            }
            if (Object.keys(dudes).length <= 0) {
                ns.print("No more dudes left...");
                break;
            }
            
        }
        await ns.sleep(tick);
    }

}