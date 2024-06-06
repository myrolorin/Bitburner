Currently, Main does the following
1. scans for all servers connected to current server
2. adds each unique one to a set
3. moves to the next server
4. repeats
5. calculates the max threads of a script can run on target server
6. attempts to gain root to any servers where hasRootAccess is false
7. copies bin scripts to each server
8. chooses which script is most valuable to run
9. executes that script on the target server at max threads

Bin scripts each perfrom a different function 
bin.wk.js - weaken the target server's security level if it is above min 
bin.gr.js - grow the target server's money if it is below max  
bin.hk.js - hack the target server
