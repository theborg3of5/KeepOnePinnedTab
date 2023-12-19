// #region Constants
// Options for which sort of pinned tab we keep.
const PinnedTabPage_Default    = "Default";
const PinnedTabPage_BlankLight = "BlankLight";
const PinnedTabPage_BlankDark  = "BlankDark";
const PinnedTabPage_Custom     = "Custom";

// Keys that we use to index into the sync storage.
const KOPT_NoFocusTab = "KeepOnePinnedTab_NoFocusPinnedTab";
const KOPT_Page       = "KeepOnePinnedTab_PinnedTabPage";
const KOPT_CustomURL  = "KeepOnePinnedTab_CustomPinnedTabURL";
// #endregion Constants

// GDB TODO will need to get rid of these global variables, probably using chrome.storage.local instead (see https://developer.chrome.com/docs/extensions/develop/migrate/to-service-workers#persist-states)
var NextCreateTriggersKeep  = false;


// #region Event Listeners
chrome.windows.onCreated.addListener(windowCreated);
chrome.tabs.onActivated.addListener(tabActivated);
chrome.tabs.onCreated.addListener(tabCreated);
chrome.tabs.onDetached.addListener(tabDetached);
chrome.tabs.onRemoved.addListener(tabRemoved);
// chrome.tabs.onMoved.addListener(tempMoved); // GDB TEMP
chrome.storage.onChanged.addListener(storageChanged);
// #endregion Event Listeners

// Kick-off logic // gdb todo can I do this anymore, or do I need some other event to key off of?
updateAllWindows();

/* GDB TODO overall strategy:
	Current:
		Store settings in global variables
			For the pinned URL in particular, we actually need the value delayed from what we grab out of local storage
		On tab activation, try to unfocus the pinned tab if that setting is turned on.
		On tab creation, trigger our "keep special tabs" for that tab's window (but only if a window was also just created?)
		On tab detach, if the detached tab was the last "real" (not one of our special pinned/additional) tab in the window, close that window.
		On tab close (remove), trigger our "keep special tabs" for that tab's window (unless the window is also closing, in which case do nothing).
		On settings change, check all windows to see if they have the old pinned URL
			If they do, update that tab to use the new pinned URL
		"keep special tabs" - check if we have both the pinned tab and 1 "additional" (anything else) tab, and add what's missing if not.
			There's some weird logic/assumptions going on in here, too.
*/

// async function tempMoved(tabId, moveInfo) // GDB REMOVE
// { 
// 	chrome.tabs.create(
// 		{
// 			"windowId": moveInfo.windowId,
// 			"url":      await getPinnedURL(),
// 			"active":   false,
// 		},
// 		catchTabCreateError
// 	);
// }

/**
 * Determine whether we should prevent our special pinned tab from getting focus (based on the user's settings).
 * @returns true/false - should we block the pinned tab getting focus?
 */
async function shouldBlockPinnedTabFocus()
{
	return new Promise(
		(resolve) =>
		{
			chrome.storage.sync.get(KOPT_NoFocusTab,
				(settings) =>
				{
					resolve(settings[KOPT_NoFocusTab] ?? false);
				}
			)
		}
	);
}

/**
 * Get the URL we should use for our special pinned tab.
 * @returns Promise that resolves into the URL we should use for our pinned tab.
 */
async function getPinnedURL() {
	return new Promise((resolve, reject) =>	{
		chrome.storage.sync.get([KOPT_Page, KOPT_CustomURL],
			(settings) => {
				if (settings[KOPT_Page] == undefined) {
					reject();
					return;
				}
				resolve(calculatePinnedURL(settings));
			}
		)
	});
}

/**
 * Figure out what the pinned tab URL should be based on the give sync settings.
 * @param {object} settings Sync storage object with the KOPT_Page and KOPT_CustomURL items on it.
 * @returns The URL to use for our pinned tab.
 */
function calculatePinnedURL(settings) {
	switch (settings[KOPT_Page])
	{
		case PinnedTabPage_BlankLight:
			return chrome.runtime.getURL("Resources/blankLight.html");
		case PinnedTabPage_BlankDark:
			return chrome.runtime.getURL("Resources/blankDark.html");
		case PinnedTabPage_Custom:
			return settings[KOPT_CustomURL];
		case PinnedTabPage_Default:
		default:
			return "chrome://newtab/";
	}
}

function updateAllWindows() {
	chrome.windows.getAll(
		{
			"populate":    true,
			"windowTypes": ["normal"]
		},
		function(windows){
			for(var i = 0; i < windows.length; i++) // GDB TODO seems like this would be better as a for each/for in (whichever it is) or even an array.foreach
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
		async (targetWindow) => {
			if(!await tryKeepPinnedTab(targetWindow)) // Only check for the additional tab if we didn't just create a pinned one. // GDB TODO but why?
				keepAdditionalTab(targetWindow);
		}
	);
}

async function tryKeepPinnedTab(targetWindow) { // GDB TODO return value doesn't really make sense, clean up
	if(await getPinnedURL() == "")
		return false;
	if(targetWindow.type != "normal")
		return false;
	
	if(await needPinnedTab(targetWindow)) {
		await createPinnedTab(targetWindow);
		return true; // Created a new pinned tab
	}
	
	return false;
}
async function needPinnedTab(targetWindow) {
	if(targetWindow == undefined)
		return false;
	if(await isOurTab(targetWindow.tabs[0])) // Our desired tab already exists.
		return false; 
	
	return true;
}
async function isOurTab(tab, urlToCheck = "") { // GDB TODO rename (honestly most of these functions)
	if(!tab)
		return false;
	if(!tab.pinned)
		return false;
	
	if (urlToCheck == "")
		urlToCheck = await getPinnedURL();
	if ((tab.url.indexOf(urlToCheck) === -1) && (tab.pendingUrl.indexOf(urlToCheck) === -1))
		return false;
	
	return true;
}
async function createPinnedTab(targetWindow) {
	chrome.tabs.create(
		{
			"windowId": targetWindow.id,
			"url":      await getPinnedURL(),
			"index":    0,
			"pinned":   true,
			"active":   false
		},
		catchTabCreateError
	);
}
function catchTabCreateError(tab) { // GDB todo is there a better way to do this now, or is this needed anymore?
	if(!tab) // Most likely, the window doesn't exist anymore (because last tab was closed).
		var lastError = chrome.runtime.lastError; // check lastError so Chrome doesn't output anything to the console.
}

function keepAdditionalTab(targetWindow)
{
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

/**
 * GDBTODO
 * https://developer.chrome.com/docs/extensions/reference/api/windows#event-onCreated
 * @param {gdbtodo} newWindow gdbtodo
 */
function windowCreated(newWindow) {
	NextCreateTriggersKeep = true;
}

/**
 * gdbtodo
 * https://developer.chrome.com/docs/extensions/reference/api/tabs#event-onActivated
 * @param gdbtodo activeInfo gdbtodo
 */
async function tabActivated(activeInfo) {
	if (await shouldBlockPinnedTabFocus())
	{
		chrome.windows.get(
			activeInfo.windowId,
			{
				"populate": true,
				"windowTypes": ["normal"]
			},
			async function (targetWindow)
			{
				if (await ourTabIsFocused(targetWindow))
					unfocusPinnedTab(targetWindow);
			}
		);
	}
}
async function ourTabIsFocused(targetWindow) {
	var firstTab = targetWindow.tabs[0];
	
	if(!targetWindow)
		return false;
	if(!await isOurTab(firstTab))
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

/**
 * gdbtodo
 * https://developer.chrome.com/docs/extensions/reference/api/tabs#event-onCreated
 * @param gdbtodo tab 
 */
function tabCreated(tab) {
	if(NextCreateTriggersKeep) {
		NextCreateTriggersKeep = false;
		keepSpecialTabs(tab.windowId);
	}
}

/**
 * gdbtodo
 * https://developer.chrome.com/docs/extensions/reference/api/tabs#event-onDetached
 * @param gdbtodo tabId gdbtodo
 * @param gdbtodo detachInfo gdbtodo
 */
function tabDetached(tabId, detachInfo) {
	chrome.windows.get(
		detachInfo.oldWindowId,
		{
			"populate": true
		},
		closeWindowOnDetachLastRealTab
	);
}
async function closeWindowOnDetachLastRealTab(detachedWindow) {
	if(!detachedWindow)
		return;
	if(detachedWindow.tabs.length != 1)
		return;
	if(!await isOurTab(detachedWindow.tabs[0]))
		return;
	
	chrome.windows.remove(detachedWindow.id);
}

/**
 * Fires whenever a tab is closed.
 * https://developer.chrome.com/docs/extensions/reference/api/tabs#event-onRemoved
 * @param {number} _tabId The ID of the tab that was closed (not used)
 * @param {object} removeInfo An object with a .windowId property containing the window ID.
 */
function tabRemoved(_tabId, removeInfo) {
	if(removeInfo.isWindowClosing)
		return;
	
	keepSpecialTabs(removeInfo.windowId);
}

/**
 * Fires when the local storage (where our settings are kept) change.
 * https://developer.chrome.com/docs/extensions/reference/api/storage#event-onChanged
 */
function storageChanged() {
	chrome.storage.sync.get(
		[
			KOPT_NoFocusTab,
			KOPT_Page,
			KOPT_CustomURL,
		],
		function(items) {
			// var oldPinnedURL = PinnedTabURL; // GDB TODO figure out how to keep track of old pinned URL without a global variable?
			
			// if(oldPinnedURL == PinnedTabURL)
			// 	return;
			
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
	);
}

/**
 * 
 * @param {Window} targetWindow The window object to convert
 * @param {string} oldPinnedURL The URL that we were previously using for our special pinned tabs
 * @param {string} newPinnedURL The URL that we now want to use for our special pinned tabs
 */
async function convertWindow(targetWindow, oldPinnedURL, newPinnedURL) {
	var firstTab = targetWindow.tabs[0];
	if(!await isOurTab(firstTab, oldPinnedURL))
		return;
	
	chrome.tabs.update(
		firstTab.id,
		{
			"url": newPinnedURL
		}
	);
}




