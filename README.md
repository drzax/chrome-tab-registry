Chrome Tab Registry
===================

A tab registry library for use in Google Chrome extensions.

A problem when working with tabs in Google Chrome extensions is that there are situations in which 
don't retain a consistent ID. This library attempts to assign tabs a consistent and unique GUID
so they can be accurately identified and tracked.

The problem and a proposed solution are well explained on Stack Overflow: [Persistent unique ID for Chrome tabs that lasts between browser sessions](http://stackoverflow.com/questions/11005258/persistent-unique-id-for-chrome-tabs-that-lasts-between-browser-sessions).

Usage
-----

### Setup
1. Add all library files to your extension's code base.
2. Request the `tabs` and `storage` permissions in your manifest file.
3. Make sure your extension has [cross-origin permissions](http://developer.chrome.com/extensions/content_scripts.html#pi) for all sites sites. The registry will attempt to track all tabs, but is less accurate without permission to access the DOM of tab content.
4. Add `TabRegistry.js` as a (persistent) [background script](http://developer.chrome.com/stable/extensions/background_pages.html) (before any of your own scripts that will use it).

### API

#### `TabRegistry.guid(Int tabId)`
Return a GUID which uniquely and consistently identifies the tab with the specified `tabId`.

#### `TabRegistry.id(String guid)`
Return the internal Chrome tab ID for the tab identified by the specified `guid`.

#### `TabRegistry.attr.set(String guid, String name, Any value)`
Store an arbitrary value against this tab in the registry. 

#### `TabRegistry.attr.get(String guid, String name)`
Retrieve a value stored in the registry for this tab.

#### `TabRegistry.attr.clear(String guid, String name)`
Unset the specified attribute.

### Events
It's currently possible to register callback functions against two events.

#### `TabRegistry.onAdded.addListener(Function fn)`
Called after a tab has been added to the current registry

#### `TabRegistry.onRemoved.addListener(Function fn)`
Listeners are called after a tab has been removed from the current registry.

### Examples
This library was written for the [This Tab Will Self Destruct™ extension for Chrome](https://github.com/drzax/chrome-temporary-tabs), so you can see an example of usage there.


Known Limitations
-----------------
- Chrome internal tabs and some other special cases (things like `https://secure.google.com/`) won't be in the registry (except `chrome://newtab/` - that guy will self destruct).
- There are also some [bugs](https://github.com/drzax/chrome-tab-registry/issues) which are due to limitations of the Extensions API. (If you have a solution to any of these bugs, please do contribute.)

License
-------
[The MIT License (MIT)](http://drzax.mit-license.org/)
Copyright © 2013 [Simon Elvery](http://elvery.net) <simon@elvery.net>
