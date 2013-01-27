/**
 * TabRegistry provides a unique identifier GUID for tabs which is consistent and persistent 
 * even through browser restarts and tab close/reopen and is unique when a tab is duplicated.
 * 
 * Registry objects structure:
 * {
 *   <guid>: {
 *     tabId: <int>,
 *     tabIndex: <int>,
 *     fingerprint: <string>,
 *     attrs: {
 *       <string>: <object>
 *     }
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
	
	// From: http://stackoverflow.com/questions/7616461/generate-a-hash-from-string-in-javascript-jquery
	String.prototype.hashCode = function(){
		var hash = 0, i, ch;
		if (this.length == 0) return hash;
		for (i = 0; i < this.length; i++) {
			ch = this.charCodeAt(i);
			hash = ((hash<<5)-hash)+ch;
			hash = hash & hash; // Convert to 32bit integer
		}
		return hash.toString(16);
	};
	
	// Private properties
	var log = false,
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
	function add(tabId, tabIndex, fingerprint) {

		var guids, count, matches, k, r;
		
		// Sometimes tabs are weird (I think this is instant search or omnibox funny business).
		if (tabIndex === -1) {
			if (log) console.info('Tab with negative index: ', JSON.parse(JSON.stringify(data)));
			return;
		}
		for (r in registry) {
			
			if (r === 'current') continue;
			
			guids = query({tabIndex: tabIndex, fingerprint: fingerprint}, r);
			count = guids.length;
			
			// Warn if there are more than one matching tab in registry
			if (count > 1) {
				matches = [];
				for (k in guids) {
					matches.push(registry[r][k]);
				}
				console.warn("More than one tab is a match for the tab being added. The first will be used.", JSON.parse(JSON.stringify({tabId: tabId, tabIndex: tabIndex, fingerprint: fingerprint, matches: matches, registry: r})));
			}

			// Restore tab in registry.
			if (count) { 
				if (log) console.info("Matching tab found in registry '" + r + "'.", tabId, tabIndex, fingerprint, JSON.parse(JSON.stringify(registry[r][guids[0]])));
				registry.current[guids[0]] = {tabId: tabId, tabIndex: tabIndex, fingerprint: fingerprint, attrs: registry[r][guids[0]].attrs||{}};
				delete registry[r][guids[0]];
				write();
				return;
			}	
		}
		
		// If we got to this this point it's brand new as far as we can tell.
		if (log) console.info('New tab opened.', tabId, tabIndex, fingerprint);
		registry.current[GUID()] = {tabId: tabId, tabIndex: tabIndex, fingerprint: fingerprint, attrs: {}};
		write();
		updateTabIndexesAbove(tabIndex);
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
		return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
			var r = Math.random()*16|0,
				v = c == 'x' ? r : r&0x3|0x8;
			return v.toString(16);
		});
	}
	
	// Update the tabId for tab matching <guid>
	function updateTabId(guid, newTabId) {
		registry.current[guid].tabId = newTabId;
		write();
	}
	
	// Update tab index in registry for tab matching <guid>
	function updateTabIndex(guid) {
		chrome.tabs.get(registry.current[guid].tabId, function(tab){
			if (log) console.info("Tab index updated.", JSON.parse(JSON.stringify(tab)));
			registry.current[guid].tabIndex = tab.index;
			write();
		});
	}
	
	// Update tab indexes above a given index
	function updateTabIndexesAbove(index) {
		var k;
		if (log) console.info('Updating tabs with index above ' + index);
		for (k in registry.current) {
			if (registry.current[k].tabIndex > index) {
				updateTabIndex(k);
			}
		}
	}
	
	// Update all tab indexes in registry.
	function updateTabIndexes() {
		var guid;
		if (log) console.info('Updating all tab indexes.');
		for (guid in registry.current) {
			updateTabIndex(guid)
		}
	}
	
	// Either update fingerprint or register.
	function addOrUpdateFingerprint(tabId, tabIndex, fingerprint) {
		
		var guids, count;
		
		guids = query({tabId: tabId});
		count = guids.length;

		if (count > 1) throw {
			name: "TabRegistry Message Error",
			message: "There are " + count + " tabs in the registry with tab ID " + tabId + ". There should only be one."
		}

		if ( count ) { 
			registry.current[guids[0]].fingerprint = fingerprint;
			if (log) console.info('Tab fingerprint updated.', JSON.parse(JSON.stringify(registry.current[guids[0]])));
			write();

		} else {
			// In case a tab requests registration before registry is retrieved from storage.
			if (registry.prev === null) { 
				toRegister.push({tabId: tabId, tabIndex: tabIndex, fingerprint: fingerprint});
				if (log) console.info('Early registration.');
			} else {
				add(tabId, tabIndex, fingerprint);
			}
		}
	}
	
	function onUpdatedOrLoad(tabId, info, tab){
		
		if (log) console.info('Tab updated', JSON.parse(JSON.stringify(tab)));
		
		// Internal Chrome business
		if (/^chrome/.test(tab.url)) {
			addOrUpdateFingerprint(tabId, tab.index, tab.url.hashCode());
			return;
		}
		
		// Get real fingerprint and add or update
		chrome.tabs.executeScript(tabId, {
			code: "(function(){return JSON.stringify([location.href, document.referrer, history.length]);})()"
		}, function(data){
			addOrUpdateFingerprint(tabId, tab.index, data[0].hashCode());
		});	
	}
	
	function onReplaced(addedId, removedId){
		var guids = query({tabId: removedId}),
			count = guids.length;

		if (count > 1) throw {
			name: "TabRegistry Replacement Error",
			message: "There are " + count + " tabs in the registry with tab ID " + removedId + ". There should only be one."
		}

		if (log) console.info('Tab replacement', removedId, addedId, guids);

		if (count) updateTabId(guids[0], addedId);
	}
	
	function onRemoved(tabId, info) {
		
		// Timeout before removing from registry prevents registry being cleared
		// on browser quit.
		setTimeout(function(){
			var guids, count;

			guids = query({tabId:tabId});
			count = guids.length;

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
				return registry.removed[guids[0]].tabIndex;
			}
		}, 100);
		
	}
	
	function onCreated(tab) {
		onUpdatedOrLoad(tab.id, {}, tab);
	}
	
	// Add the listeners
	
	chrome.tabs.onCreated.addListener(onCreated);
	chrome.tabs.onUpdated.addListener(onUpdatedOrLoad);
	chrome.tabs.onMoved.addListener(updateTabIndexes);
	chrome.tabs.onDetached.addListener(updateTabIndexes);
	chrome.tabs.onAttached.addListener(updateTabIndexes);
	chrome.tabs.onRemoved.addListener(onRemoved);
	if (chrome.tabs.onReplaced) chrome.tabs.onReplaced.addListener(onReplaced); // Not in stable yet
	
	
	
	// Initialise
	chrome.storage.local.get("TabRegistry", function(items){
		var i;
		registry.prev = items.TabRegistry || {};
		if (log) console.info('Previous sessions\'s registry retrieved from storage. ', JSON.parse(JSON.stringify(registry.prev)));
		for (i=toRegister.length-1;i>=0;i--) {
			add(toRegister[i].tabId, toRegister[i].tabIndex, toRegister[i].fingerprint);
		}
	});
	
	// Run once to register on first load.
	chrome.tabs.query({}, function(tabs){
		var k;
		for (k in tabs) {
			onUpdatedOrLoad(tabs[k].id, {}, tabs[k]);
		}
	});
	
	// Public members
	return {
		reset: function() {
			registry = {
				current: [],
				prev: [],
				removed: []
			}
			write();
		},
		guid: function(tabId) {
			var guids = query({tabId: tabId}),
			count = guids.length;

			if (count > 1) throw {
				name: "TabRegistry Error",
				message: "There are " + count + " tabs in the registry with tab ID " + tabId + ". There should only be one, so something went wrong."
			}
			
			if (count < 1) throw {
				name: "TabRegistry Error",
				message: "There is no tab with ID " + tabId + " in the registry."
			}

			return guids[0];
		},
		id: function(guid) {
			
			if ( !(guid in registry.current) ) {
				throw {
					name: "TabRegistry Error",
					message: "There is no tab with the GUID " + guid + " in the registry."
				}
			}
			
			return registry.current[guid].tabId;
		},
		registry: function () {
			return registry;
		},
		attrs : {
			set: function(guid, name, value) {

				if ( !(guid in registry.current) ) {
					throw {
						name: "TabRegistry Error",
						message: "Cannot set attribute " + name + " for non-existant tab with GUID " + guid + ".",
						data: value
					}
				}

				registry.current[guid].attrs = registry.current[guid].attrs || {};
				registry.current[guid].attrs[name] = value;
				write();
			},
			get: function(guid, name) {

				if ( !(guid in registry.current) ) {
					throw {
						name: "TabRegistry Error",
						message: "Cannot get attribute " + name + " for non-existant tab with GUID " + guid + "."
					}
				}

				return registry.current[guid].attrs[name];
			},
			clear: function(guid, name) {

				if ( !(guid in registry.current) ) {
					throw {
						name: "TabRegistry Error",
						message: "Cannot clear attribute " + name + " for non-existant tab with GUID " + guid + "."
					}
				}

				delete registry.current[guid].attrs[name];
			}	
		}
	}
})();

