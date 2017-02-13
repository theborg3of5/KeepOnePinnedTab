var NoFocusPinnedTab        = false;
var PinnedTabURL            = "";
var NextCreateTriggersKeep  = false;
var JustFixedLegacySettings = false;


function startup() {
	chrome.storage.sync.get(
		[
			KOPT_NoFocusTab,
			KOPT_Page,
			KOPT_CustomURL,
			KOPT_LegacyKey // Old
		],
		function(items) {
			// Deal with legacy settings // Old
			if(!JustFixedLegacySettings)
				if(haveLegacySettings(items)) {
					fixLegacySettings(items);
					return;
				}
			
			updateSettings(items);
			updateAllWindows();
		}
	);
}

function haveLegacySettings(items) {
	if(items[KOPT_LegacyKey])
		return true;
	
	return false;
}
function fixLegacySettings(items) {
	chrome.storage.sync.set(
		{
			[KOPT_Page]:       PinnedTabPage_Custom,
			[KOPT_CustomURL]:  items[KOPT_LegacyKey],
			[KOPT_LegacyKey]:  "" // Old style, clear it out when we save. Should have fixed it to new style in actual elements via loadOptions().
		},
		function() {
			JustFixedLegacySettings = true; // Shouldn't be needed, but just in case.
			startup(); // Start over with updated settings.
		}
	);
}

function updateSettings(items) {
	PinnedTabURL = getPinnedURL(items);
	NoFocusPinnedTab = items[KOPT_NoFocusTab];
}
function getPinnedURL(items) {
	var pageToPin = items[KOPT_Page];
	
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
				keepSpecialTabs(windows[i].id);
		}
	);
}

function keepSpecialTabs(targetWindowId) {
	if(!targetWindowId)
		return;
	
	chrome.windows.get(
		targetWindowId,
		{
			"populate":    true,
			"windowTypes": ["normal"]
		},
		function(targetWindow) {
			keepPinnedTab(targetWindow);
			keepAdditionalTab(targetWindow);
		}
	);
}

function keepPinnedTab(targetWindow) {
	if(PinnedTabURL == "")
		return;
	if(targetWindow.type != "normal")
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
function isOurTab(tab, urlToCheck = PinnedTabURL) {
	if(!tab)
		return false;
	if(!tab.pinned)
		return false;
	if(tab.url.indexOf(urlToCheck) == -1)
		return false;
	
	return true;
}
function createPinnedTab(targetWindow) {
	// Spawn our special tab. Stick it at the beginning and pin it, but don't focus it.
	chrome.tabs.create(
		{
			"windowId": targetWindow.id,
			"url":      PinnedTabURL,
			"index":    0,
			"pinned":   true,
			"active":   false
		},
		catchTabCreateError
	);
}
function catchTabCreateError(tab) {
	if(!tab) // Most likely, the window doesn't exist anymore (because last tab was closed).
		var lastError = chrome.runtime.lastError; // check lastError so Chrome doesn't output anything to the console.
}

function keepAdditionalTab(targetWindow) {
	if(targetWindow.type != "normal")
		return;
	
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
			"windowId": targetWindow.id,
			"active":   true
		},
		catchTabCreateError
	);
}


function windowCreated(newWindow) {
	NextCreateTriggersKeep = true;
}

function tabActivated(activeInfo) {
	if(NoFocusPinnedTab)
		chrome.windows.get(
			activeInfo.windowId,
			{
				"populate":    true,
				"windowTypes": ["normal"]
			},
			function(targetWindow) {
				if(ourTabIsFocused(targetWindow))
					unfocusPinnedTab(targetWindow);
			}
		);
}
function ourTabIsFocused(targetWindow) {
	var firstTab = targetWindow.tabs[0];
	
	if(!targetWindow)
		return false;
	if(!isOurTab(firstTab))
		return false;
	if(!firstTab.active)
		return false;
	
	return true;
}
function unfocusPinnedTab(targetWindow) {
	if(targetWindow.tabs.length < 2)
		return;
	
	chrome.tabs.update(
		targetWindow.tabs[1].id,
		{
			active: true
		}
	);
}

function tabCreated(tab) {
	if(NextCreateTriggersKeep) {
		NextCreateTriggersKeep = false;
		keepSpecialTabs(tab.windowId);
	}
}

function tabDetached(tabId, detachInfo) {
	chrome.windows.get(
		detachInfo.oldWindowId,
		{
			"populate": true
		},
		closeWindowOnDetachLastRealTab
	);
}
function closeWindowOnDetachLastRealTab(detachedWindow) {
	if(!detachedWindow)
		return;
	if(detachedWindow.tabs.length != 1)
		return;
	if(!isOurTab(detachedWindow.tabs[0]))
		return;
	
	chrome.windows.remove(detachedWindow.id);
}

function tabRemoved(tabId, removeInfo) {
	if(removeInfo.isWindowClosing)
		return;
	
	keepSpecialTabs(removeInfo.windowId);
}

function storageChanged() {
	chrome.storage.sync.get(
		[
			KOPT_NoFocusTab,
			KOPT_Page,
			KOPT_CustomURL,
			KOPT_LegacyKey // Old
		],
		function(items) {
			var oldPinnedURL = PinnedTabURL;
			
			updateSettings(items);
			
			if(oldPinnedURL == PinnedTabURL)
				return;
			
			convertAllWindows(oldPinnedURL, PinnedTabURL);
		}
	);
}
function convertAllWindows(oldPinnedURL, newPinnedURL) {
	chrome.windows.getAll(
		{
			"populate":    true, 
			"windowTypes": ["normal"]
		},
		function(windows){
			for(var i = 0; i < windows.length; i++) {
				convertWindow(windows[i], oldPinnedURL, newPinnedURL);
			}
		}
	);
}
function convertWindow(targetWindow, oldPinnedURL, newPinnedURL) {
	var firstTab = targetWindow.tabs[0];
	if(!isOurTab(firstTab, oldPinnedURL))
		return;
	
	chrome.tabs.update(
		firstTab.id,
		{
			"url": newPinnedURL
		}
	);
}


startup();


chrome.windows.onCreated.addListener(windowCreated);
chrome.tabs.onActivated.addListener(tabActivated);
chrome.tabs.onCreated.addListener(tabCreated);
chrome.tabs.onDetached.addListener(tabDetached);
chrome.tabs.onRemoved.addListener(tabRemoved);
chrome.storage.onChanged.addListener(storageChanged);
