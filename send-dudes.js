import { getPotentialTargets, getStrategy } from "./find-targets.js";
import {
	getNetworkNodes,
	canPenetrate,
	getRootAccess,
	hasRam,
	getThresholds
} from "./utils.js";

/** 
 * Launches a coordinated attack on the network to
 * maximise the usage of our resources
 * 
 * @param {NS} ns
 **/
export async function main(ns) {
	ns.disableLog("ALL");
	const priority = ns.args[0];
	var player = ns.getPlayer();
	var homeServ = ns.getHostname();
	var attackDelay = 50; // time (ms) between attacks

	var virus = "atk-batch.js";
	var virusRam = ns.getScriptRam(virus);

	var actions = {
		w: 'weaken',
		h: 'hack',
		g: 'grow'
	};

	var cracks = {
		"BruteSSH.exe": ns.brutessh,
		"FTPCrack.exe": ns.ftpcrack,
		"relaySMTP.exe": ns.relaysmtp,
		"HTTPWorm.exe": ns.httpworm,
		"SQLInject.exe": ns.sqlinject
	};

	// Returns potentially controllable servers mapped to RAM available
	async function getDudes() {
		var nodes = getNetworkNodes(ns);
		var servers = nodes.filter(node => {
			if (node === homeServ) {
				return false;
			}
			return canPenetrate(ns, node, cracks) && hasRam(ns, node, virusRam);
		});

		// Prepare the servers to have root access and scripts
		for (var serv of servers) {
			if (!ns.hasRootAccess(serv)) {
				getRootAccess(ns, serv, cracks);
			}
			ns.scp(virus, serv);
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
		// Grow calculation
		var growThreads = 0;
		if (curMoney < 1) {
			// no money, assign a single thread to put some cash into it
			growThreads = 1;
		} else {
			var growMul = moneyThresh / curMoney;
			if (growMul >= 1) {
				growThreads = Math.round(ns.growthAnalyze(node, growMul));
			}
		}
		// Weaken calculation
		var weakenEffect = ns.weakenAnalyze(1);
		var weakenThreads = weakenEffect > 0 ? Math.round(secThresh / weakenEffect) : 0;
		// Hack calculation
		var hackEffect = ns.hackAnalyze(node);
		var hackTaken = hackEffect * curMoney;
		var hackThreads = Math.round(moneyThresh / hackTaken);

		// Guards (there's a bug with hackAnalyze I think)
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

	// SQUAD HELPER FUNCTIONS

	function getTotalThreads(servers) {
		return Object.values(servers).reduce((sum, nodeRam) => {
			var threads = Math.floor(nodeRam / virusRam);
			sum += threads;
			return sum;
		}, 0);
	}

	function getAllocation(reqs, dudes) {
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
					numGrow = Math.floor(totalThreads * portion);
				} else {
					numHack = Math.floor(totalThreads * portion);
				}
			}
		}
		return {
						numWeaken,
						numGrow,
						numHack
		};
	}

	function readySquads(reqs, contract, dudes) {
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
		// Assign squads based on the contract
		return readySquads(reqs, contract, dudes);
	}

	function logDudeAction(dude, action, target) {
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
	}

	var tick = 1000;

	while (true) {
		var dudes = await getDudes();
		var availDudes = Object.keys(dudes).length;
		if (availDudes === 0) {
			await ns.sleep(tick);
			continue;
		}
		var targets = getPotentialTargets(ns, priority);
		for (var target of targets) {
			var targetNode = target.node;
			var reqs = getRequirements(targetNode);
			var { squads, assigned } = createSquads(reqs, dudes);

			for (var squad of squads) {
				var action = squad.action;
				for (var dude of squad.dudes) {
					var pid = 0;
					while (ns.exec(virus, dude.serv, dude.threads, action, targetNode, dude.delay, pid) === 0) {
						pid++;
					}
					logDudeAction(dude, action, targetNode);
				}
			}
			// Delete assigned from list of squads
			for (var dude of Object.keys(assigned)) {
				var usage = assigned[dude];
				if (usage.left <= 1) { // useless if only 1 thread left
					delete dudes[dude];
				} else {
					dudes[dude] = usage.left;
				}
			}
			// Early exit if no more dudes to assign
			if (Object.keys(dudes).length <= 0) {
				break;
			}
		}
		await ns.sleep(tick);
	}
}