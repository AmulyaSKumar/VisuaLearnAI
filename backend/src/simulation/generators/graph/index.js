/**
 * Graph Algorithm Generators
 * Auto-registers all graph algorithm generators
 */

// Import all generators (side effect: registers them)
import './bfs.js';
import './dfs.js';
import './dijkstra.js';
import './bellman-ford.js';
import './floyd-warshall.js';
import './prims.js';
import './kruskals.js';

console.log('[Generators] Graph generators loaded');

export default {};
