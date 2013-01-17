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
2. Make sure your manifest file requests the `tabs` and `storage` permissions.
3. Add `ContentScript.js` as a [content script](http://developer.chrome.com/stable/extensions/content_scripts.html) with permission to run on all URLs.
4. Add `TabRegistry.js` as a (persistent) [background script](http://developer.chrome.com/stable/extensions/background_pages.html).

### API
There are only two methods to the`TabRegistry` API you can use in your code. 

1. `TabRegistry.reset()` - Calling this will remove all pages from the registry. Any new or refreshed pages will then be re-added.
2. `TabRegistry.guid(Int tabId)` - Calling this will return a GUID which uniquely and consistently identifies the given tab.

Known Limitations
-----------------
- Page load must get the the point where `ContentScript.js` is executed for tab to be recorded in the registry.
- Pages that can't have content scripts can't be registered (things like `chrome://` and `https://secure.google.com/` pages).
- There are also some [bugs](https://github.com/drzax/chrome-tab-registry/issues) which are due to limitations of the Extensions API. (If you have a solution to any of these bugs, please do contribute.)

License
-------
[The MIT License (MIT)](http://drzax.mit-license.org/)
Copyright © 2013 Simon Elvery <simon@elvery.net>