
var pinnedTabURL = "";


// Get our settings for what URL to use, and kick everything off.
function startup() {
	chrome.storage.sync.get(
		[
			KOPT_Page,
			KOPT_CustomURL,
			KOPT_LegacyKey // Old
		],
		function(items) {
			pinnedTabURL = getPinnedURL(items);
			updateAllWindows();
		}
	);	
}


// Figures out the URL that should be kept always pinned, based on Chrome sync storage.
function getPinnedURL(items) {
	var pageToPin = items[KOPT_Page];
	
	// Old style of storage (remove eventually)
	var oldStyleURL = items[KOPT_LegacyKey];
	if( (oldStyleURL != undefined) && (oldStyleURL != "") )
		return oldStyleURL;
	
	return getURLFromPage(pageToPin);
}

function getURLFromPage(pageToPin) {
	if(pageToPin == PinnedTabPage_Default)
		return PinnedTabURL_Default;
	if(pageToPin == PinnedTabPage_BlankLight)
		return PinnedTabURL_BlankLight;
	if(pageToPin == PinnedTabPage_BlankDark)
		return PinnedTabURL_BlankDark;
	if(pageToPin == PinnedTabPage_Custom)
		return items[KOPT_CustomURL];
	
	return PinnedTabURL_Default;
}


function updateAllWindows() {
	chrome.windows.getAll(
		{
			"populate":    true, 
			"windowTypes": ["normal"]
		},
		function(windows){
			for(var i = 0; i < windows.length; i++)
				keepSpecialTabs(windows[i]);
		}
	);
}


function keepSpecialTabs(targetWindow) {
	keepPinnedTab(targetWindow);
	keepAdditionalTab(targetWindow);
}


function keepPinnedTab(targetWindow) {
	if(pinnedTabURL == "")
		return;
	
	if(needPinnedTab(targetWindow))
		createPinnedTab(targetWindow);
}

function needPinnedTab(targetWindow) {
	if(targetWindow == undefined)
		return false;
	
	if(isOurTab(targetWindow.tabs[0])) // Our desired tab already exists.
		return false; 
	
	return true;
}

function isOurTab(tab) {
	if(!tab.pinned)
		return false;
	
	if(tab.url.indexOf(pinnedTabURL) == -1)
		return false;
	
	return true;
}

function createPinnedTab(targetWindow) { // GDB TODO - take specific window into account.
	// Spawn our special tab. Stick it at the beginning and pin it, but don't focus it.
	chrome.tabs.create(
		{
			"index":  0, 
			"pinned": true, 
			"active": false, 
			"url":    pinnedTabURL
		}
	);
}


function keepAdditionalTab(targetWindow) {
	if(needAdditionalTab(targetWindow))
		createAdditionalTab(targetWindow);
}

function needAdditionalTab(targetWindow) {
	if(targetWindow.tabs.length > 1)
		return false;
	
	return true;
}

function createAdditionalTab(targetWindow) {
	chrome.tabs.create(
		{
			"active": true
		}
	);
}




// function updateOptions() {
	// chrome.storage.sync.get(
		// [
			// KOPT_Page,
			// KOPT_CustomURL,
			// KOPT_LegacyKey // Old
		// ],
		// function(items) {
			// // oldPinnedURL = ? // GDB TODO
			// if(pinnedTabURL == newURLToPin)
				// return
			
			// newURLToPin = getPinnedURL(items);
			// convertAllWindows(pinnedTabURL, newURLToPin);
		// }
	// );
// }

// function convertAllWindows() {
	// chrome.windows.getAll(
		// {
			// "populate":    true, 
			// "windowTypes": ["normal"]
		// },
		// function(windows){
			// for(var i = 0; i < windows.length; i++)
				// keepPinnedTab(windows[i]);
		// }
	// );
// }

// function convertWindow(targetWindow, oldPinnedURL, newURLToPin) {
	// var firstTab = targetWindow.tabs[0];
	// if(!isOurTab(firstTab)) // GDB TODO - pass oldPinnedURL and modularize better?
		// return;
	
	// chrome.tabs.update(
		// firstTab.id,
		// {
			// "url": newURLToPin // GDB TODO - should we make it explicitly not focused/active here?
		// }
	// );
// }






// function tabActivated(activeInfo)
	// {
	// if(typeof activeInfo.windowId != 'undefined') chrome.windows.get(activeInfo.windowId, { "populate": true },
		// function (window)
			// {
			// if(window.tabs[0].active == true)
				// {
				// if(newTab == true) chrome.tabs.create({"windowId": window.id, "url": "chrome://newtab", "active": true});
				// else chrome.tabs.update(window.tabs[1].id, {active: true});
				// }
			// });
	// }


function windowCreated(newWindow) {
	chrome.windows.get(newWindow.id, {"populate": true}, keepSpecialTabs);
}
	
// GDB TODO - get the window from the tab that was removed
function tabRemoved(tabId, removeInfo) {
	if(removeInfo.isWindowClosing)
		return;
	
	chrome.windows.getLastFocused(
		{
			"populate":    true,
			"windowTypes": ["normal"]
		},
		function(focusedWindow){
			keepSpecialTabs(focusedWindow);
		}
	);
}
	
	



startup();

// chrome.storage.onChanged.addListener(updateOptions);

chrome.windows.onCreated.addListener(windowCreated);
chrome.tabs.onRemoved.addListener(tabRemoved);

// chrome.tabs.onActivated.addListener(tabActivated); // GDB TODO - implement to have setting, so that the tab in question shoves focus away from itself.
