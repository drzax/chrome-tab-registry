/**
 * A helper for TabRegsitry which gets injected into the page content and returns a semi-unique 
 * fingerprint for the content of the tab.
 */

(function(){
	
	function getFingerprint() {
		return JSON.stringify([location.href, document.referrer, history.length]);
	}
	
	function sendFingerprint() {
		chrome.extension.sendMessage(getFingerprint(), function(response) {});
	}
	
	chrome.extension.onMessage.addListener(function(request, sender, sendResponse) {
		if (request === 'fingerprint') return sendResponse(getFingerprint());
		if (request === 'ping') return sendFingerprint();
	});

	sendFingerprint();
})()

