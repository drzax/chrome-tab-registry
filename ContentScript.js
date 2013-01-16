/**
 * A helper for TabRegsitry which gets injected into the page content and returns a semi-unique 
 * fingerprint for the content of the tab.
 */

(function(){
	
	chrome.extension.onMessage.addListener(function(request, sender, sendResponse) {
		if (request === 'fingerprint') sendResponse(JSON.stringify([location.href, document.referrer, history.length]));
	});

	chrome.extension.sendMessage('register', function(response) {});
})()

