/**
 * A helper for TabRegsitry which gets injected into the page content and returns a semi-unique 
 * fingerprint for the content of the tab.
 */

(function(){
	chrome.extension.sendMessage({event: 'register', data: {fingerprint: JSON.stringify([location.href, document.referrer, history.length])}});
})()

