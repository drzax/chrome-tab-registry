/**
 * TabRegistry provides a unique identifier GUID for tabs which is consistent and persistent 
 * even through browser restarts and tab close/reopen and is unique when a tab is duplicated.
 * 
 * Registry objects structure:
 *	{
 *		<guid>: {
 *			tab: <chrome.tabs.Tab>,
 *			fingerprint: <string>
 *		}
 *	}
 * 
 */
var TabRegistry = (function(undefined){
	
	// Private properties
	var registry = {
			current: {},		// A look up table of current registered tabs
			removed: {},		// A look up table of tabs closed in the current session.
			prev: null			// A look up table of tab from the previous session not yet registered this session.
		},		
		toRegister = [];		// Temporary store of tab which are created before registry has been retrieved.
	
	// Write the tab registry to persistent storage.
	function write() {
		chrome.storage.local.set({TabRegistry: registry.current});
//		console.log('write', registry.current);
	}
	
	// Add a tab to the registry.
	function add(tab) {
		chrome.tabs.sendMessage(tab.id, "fingerprint", function(fingerprint){
			var match;
			
			// Check if tab is from previous session
			match = query({tab:{index:tab.index},fingerprint: fingerprint}, 'prev');
			if (match !== false) { 
				console.log('old tab');
				registry.current[match] = {tab: tab, fingerprint: fingerprint};
				delete registry.prev[match];
				write();
				return;
			}
			
			// Check if tab is reopened
			match = query({tab:{index:tab.index},fingerprint: fingerprint}, 'removed');
			if (match !== false) { 
				console.log('reopened tab');
				registry.current[match] = {tab: tab, fingerprint: fingerprint};
				delete registry.removed[match];
				write();
				return;
			}
			
			console.log('new tab');
			registry.current[GUID()] = {tab: tab, fingerprint: fingerprint};
			write();
		});
	}
	
	// Query the registry to see if a tab matching the criteria exists.
	function query(query, r) {
		r = r || 'current';
		
		var keys =  Object.keys(registry[r]).filter(function(key){
			var k, kk;
			for (k in query) {
				if (typeof query[k] === 'object') {
					for (kk in query[k]) {
						if (registry[r][key][k][kk] !== query[k][kk]) return false;
					}
				} else {
					if (registry[r][key][k] !== query[k]) return false;
				}
			}
			return true;
		});
		return (keys.length) ? keys[0] : false;
	}
	
	function isRegistered(tabId) {
		var k;
		for (k in registry.current) {
			if (registry.current[k].tab.id === tabId) return true;
		}
		return false;
	}
	
	// From: http://stackoverflow.com/questions/105034/how-to-create-a-guid-uuid-in-javascript
	function GUID() {
		function S4() {
			return Math.floor(Math.random() * 0x10000).toString(16);
		}
		return (S4() + S4() + "-" +	S4() + "-" + S4() + "-" + S4() + "-" + S4() + S4() + S4());
	}
	
	
	// Move to the removed registry when tab is closed
	chrome.tabs.onRemoved.addListener(function(tabId, info) {
		var found = query({tab:{id:tabId}});
		if (found !== false) {
			registry.removed[found] = registry.current[found];
			delete registry.current[found];
		}
	});
	
	// Add tabs to the registry as they request it.
	chrome.extension.onMessage.addListener(function(request, sender, sendResponse) {
		if (request === 'register') {
			// Only register if this tab hasn't already registered in this session.
			if ( isRegistered(sender.tab.id) ) {
				chrome.tabs.sendMessage(sender.tab.id, "fingerprint", function(fingerprint) {
					var k;
					for (k in registry.current) {
						if (registry.current[k].tab.id == sender.tab.id) {
							registry.current[k].fingerprint = fingerprint;
							registry.current[k].tab = sender.tab;
							break;
						}
					}
					write();
				});
			} else {
				if (registry.prev === null) { 
					// In case a tab requests registration before registry is retrieved from storage.
					toRegister.push(sender.tab);
				} else {
					add(sender.tab);
				}
			}
		}
	});
	
	// Initialise
	chrome.storage.local.get({TabRegistry: {}}, function(items){
		var i;
		registry.prev = items.TabRegistry;
		for (i=toRegister.length-1;i>=0;i--) {
			add(toRegister[i]);
		}
	});
	
	// Public members
	return {
		
	}
})();

