/**
 * TabRegistry provides a unique identifier GUID for tabs which is consistent and persistent 
 * even through browser restarts and tab close/reopen and is unique when a tab is duplicated.
 * 
 * Registry objects structure:
 * {
 *   <guid>: {
 *     tabId: <int>,
 *     tabIndex: <int>,
 *     fingerprint: <string>
 *   }
 * }
 *	
 * There are three registrys:
 * - current	// Records tabs which are currently open and is continually written to storage.
 * - prev		// Records tabs from the previous browser session.
 * - removed	// Records tabs which have been closed in the current session.
 * 
 */
var TabRegistry = (function(undefined){
	
	// Private properties
	var log = true,
		registry = {
			current: {},		// A look up table of current registered tabs
			removed: {},		// A look up table of tabs closed in the current session.
			prev: null			// A look up table of tab from the previous session not yet registered this session.
		},		
		toRegister = [];		// Temporary store of tab which are created before registry has been retrieved.
	
	// Write the tab registry to persistent storage.
	function write() {
		chrome.storage.local.set({TabRegistry: registry.current});
		if (log) console.info('Registry written to storage.', JSON.parse(JSON.stringify(registry.current)));
	}
	
	// Add a tab to the registry.
	function add(data) {

		var guids, count, matches, k, r;
		
		// Sometimes tabs are weird (I think this is instant search or omnibox funny business).
		if (data.tabIndex === -1) {
			if (log) console.info('Tab with negative index: ', JSON.parse(JSON.stringify(data)));
			return;
		}

		for (r in {removed:'', prev:''}) {
			guids = query({tabIndex: data.tabIndex, fingerprint: data.fingerprint}, r);
			count = guids.length;

			// Warn if there are more than one matching tab in removed registry
			if (count > 1) {
				matches = [];
				for (k in guids) {
					matches.push(registry[r][k]);
				}
				console.warn("More than one tab is a match for the tab being added. The first will be used.", JSON.parse(JSON.stringify({criteria: data, matches: matches, registry: r})));
			}

			// Restore tab in registry.
			if (count) { 
				if (log) console.info("Matching tab found in registry '" + r + "'.", JSON.parse(JSON.stringify(data)));
				registry.current[guids[0]] = {tabId: data.tabId, tabIndex: data.tabIndex, fingerprint: data.fingerprint};
				for (k in guids) {
					delete registry[r][k];
				}			
				write();
				return;
			}	
		}
		
		// If we got to this this point it's brand new as far as we can tell.
		if (log) console.info('New tab opened.', JSON.parse(JSON.stringify(data)));
		registry.current[GUID()] = {tabId: data.tabId, tabIndex: data.tabIndex, fingerprint: data.fingerprint};
		write();
	}
	
	// Query the registry and return an array of guids matching criteria.
	function query(q, r) {
		
		// Set default registry
		r = r || 'current';
		
		if (Object.keys(registry).indexOf(r) < 0) {
			throw {
				name: "TabRegistry Query Error",
				message: "The registry '" + r + "' does not exist."
			}
		}
		
		return Object.keys(registry[r]).filter(function(key){
			var k;
			for (k in q) {
				if (registry[r][key][k] !== q[k]) return false;
			}
			return true;
		});
	}
	
	// From: http://stackoverflow.com/questions/105034/how-to-create-a-guid-uuid-in-javascript
	function GUID() {
		function S4() {
			return Math.floor(Math.random() * 0x10000).toString(16);
		}
		return (S4() + S4() + "-" +	S4() + "-" + S4() + "-" + S4() + "-" + S4() + S4() + S4());
	}
	
	// Update the tabId for tab matching <guid>
	function updateTabId(guid, newTabId) {
		registry.current[guid].tabId = newTabId;
		write();
	}
	
	function updateFingerprint(guid) {
		chrome.tabs.sendMessage(registry.current[guid].tabId, function(fingerprint){
			registry.current[guid].fingerprint = fingerprint;
			write();
		});
	}
	
	// Update tab index in registry for tab matching <guid>
	function updateTabIndex(guid) {
		chrome.tabs.get(registry.current[guid].tabId, function(tab){
			registry.current[guid].tabIndex = tab.index;
			write();
		});
	}
	
	// Update all tab indexes in registry.
	function updateTabIndexes() {
		var guid;
		for (guid in registry.current) {
			updateTabIndex(guid)
		}
	}
	
	chrome.tabs.onMoved.addListener(updateTabIndexes);
	chrome.tabs.onDetached.addListener(updateTabIndexes);
	chrome.tabs.onAttached.addListener(updateTabIndexes);
	
	
	chrome.tabs.onReplaced.addListener(function(addedId, removedId){
		var guids = query({tabId: removedId}),
			count = guids.length;
			
		if (count > 1) throw {
			name: "TabRegistry Replacement Error",
			message: "There are " + count + " tabs in the registry with tab ID " + removedId + ". There should only be one."
		}
		
		if (count) updateTabId(guids[0], addedId);
	});
	
	chrome.tabs.onRemoved.addListener(function(tabId, info) {
		var guids = query({tabId:tabId}),
			count = guids.length,
			k;
			
		if (count > 1) throw {
			name: "TabRegistry Removal Error",
			message: "There are " + count + " tabs in the registry with tab ID " + tabId + ". There should only be one."
		}
		
		if (count) {
			
			// Move to registry of closed tabs.
			registry.removed[guids[0]] = registry.current[guids[0]];
			delete registry.current[guids[0]];
			if (log) console.info('Tab removed from registry.', JSON.parse(JSON.stringify(registry.removed)));
			write();
			
			// Update tab indexes.
			for (k in registry.current) {
				if (registry.current[k].index > registry.removed[guids[0]].index) {
					updateTabIndex(k);
				}
			}
		}
	});
	
	chrome.extension.onMessage.addListener(function(fingerprint, sender) {
		
		var guids, count, data;
		
		// Sometimes tabs are weird (I think this is instant search).
		if (sender.tab.id === -1) {
			if (log) console.info('Tab with negative ID: ', JSON.parse(JSON.stringify(sender.tab)));
			return;
		}

		// Either update fingerprint or register.
		guids = query({tabId: sender.tab.id});
		count = guids.length;
		
		if (count > 1) throw {
			name: "TabRegistry Message Error",
			message: "There are " + count + " tabs in the registry with tab ID " + sender.tab.id + ". There should only be one."
		}
		
		if ( count ) { 
			
			registry.current[guids[0]].fingerprint = fingerprint;
			if (log) console.info('Tab fingerprint updated.', JSON.parse(JSON.stringify(registry.current[guids[0]])));
			write();
			
		} else {
			
			data = {tabId: sender.tab.id, tabIndex: sender.tab.index, fingerprint: fingerprint};
			
			// In case a tab requests registration before registry is retrieved from storage.
			if (registry.prev === null) { 
				toRegister.push(data);
				if (log) console.info('Early registration.');
			} else {
				add(data);
			}
			
		}
	});
	
	// Initialise
	chrome.storage.local.get({TabRegistry: {}}, function(items){
		var i;
		registry.prev = items.TabRegistry;
		if (log) console.info('Previous sessions\'s registry retrieved from storage. ', JSON.parse(JSON.stringify(registry.prev)));
		for (i=toRegister.length-1;i>=0;i--) {
			add(toRegister[i]);
		}
	});
	
	// Public members
	return {
		
	}
})();

