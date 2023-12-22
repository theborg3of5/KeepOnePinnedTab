// #region Constants
// Options for which sort of pinned tab we keep.
const PinnedTabPage_Default    = "Default";
const PinnedTabPage_BlankLight = "BlankLight";
const PinnedTabPage_BlankDark  = "BlankDark";
const PinnedTabPage_Custom     = "Custom";

// Keys that we use to index into the sync storage.
const KOPT_NoFocusTab = "KeepOnePinnedTab_NoFocusPinnedTab";
const KOPT_Page       = "KeepOnePinnedTab_PinnedTabPage";
const KOPT_CustomURL = "KeepOnePinnedTab_CustomPinnedTabURL";
const KOPT_PinnedURL = "KeepOnePinnedTab_PinnedURL";
// #endregion Constants

// GDB TODO will need to get rid of these global variables, probably using chrome.storage.local instead (see https://developer.chrome.com/docs/extensions/develop/migrate/to-service-workers#persist-states)
// var NextCreateTriggersKeep  = false;


// #region Event Listeners
// chrome.windows.onCreated.addListener(windowCreated);
// chrome.tabs.onActivated.addListener(tabActivated);

// chrome.tabs.onCreated.addListener(tabCreated);
// chrome.tabs.onDetached.addListener(tabDetached);
// chrome.tabs.onRemoved.addListener(tabRemoved);
// chrome.storage.onChanged.addListener(storageChanged);
// #endregion Event Listeners

chrome.windows.onCreated.addListener((newWindow) => 
{
	console.log("Created window: " + newWindow.id.toString());
	console.log(newWindow);

	keepNeededTabs(newWindow.id);

	// chrome.alarms.create("windowCreateFinish", {
	// 	when: (Date.now() + 5000)
  	// });
});

chrome.alarms.onAlarm.addListener((alarm) => {
	if (alarm.name !== "windowCreateFinish")
		return;

	console.log("Alarm went off!");
	updateAllWindows();
});


chrome.tabs.onCreated.addListener((tab) =>
{
	console.log("Tab created: " + tab);
	console.log(tab);
});

chrome.tabs.onRemoved.addListener((tabId, removeInfo) =>
{
	console.log("Tab removed: " + tabId.toString());
	console.log(removeInfo);
	
	// If the window is closing (as in the user is trying to close the whole window) then just let it happen.
	if (removeInfo.isWindowClosing)
		return;
	
	keepNeededTabs(removeInfo.windowId);
});

chrome.tabs.onAttached.addListener(async (tabId, attachInfo) =>
{
	console.log("Tab attached: " + tabId.toString());
	console.log(attachInfo);

	// keepSpecialTabs(attachInfo.newWindowId);
});

chrome.tabs.onDetached.addListener((tabId, detachInfo) => 
{
	console.log("Tab detached: " + tabId.toString());
	console.log(detachInfo);

	// keepSpecialTabs(detachInfo.oldWindowId);
});


chrome.tabs.onActivated.addListener(async (activeInfo) =>
{ 
	console.log("Tab activated: " + activeInfo.tabId.toString());
	console.log(activeInfo);

	// We only care about activations if we're trying to block activation of our pinned tab.
	if (!await shouldBlockPinnedTabFocus())
		return;
	
	const activeTab = await chrome.tabs.get(activeInfo.tabId);
	if (!activeTab || (activeTab == undefined))
		return;
	if (!activeTab.active) // Not active anymore
		return;
	if (activeTab.index !== 0) // Not the first tab
		return;
	if (!isSpecialPinnedTab(activeTab, await getPinnedURL())) // Not our special pinned tab
		return;
	
	await unfocusTab(activeTab);
});

async function unfocusTab(tab)
{ 
	if (!tab || (tab == undefined))
		return;

	const window = await getWindow(tab.windowId);
	if (!window)
		return;

	// Safety check: make sure there should be a tab there to focus.
	if(window.tabs.length < 2)
		return;
	
	// Focus the following tab.
	chrome.tabs.update(window.tabs[1].id, { active: true });
}

async function getWindow(windowId)
{
	if (windowId == "")
		return null;

	const window = await chrome.windows.get(
		windowId,
		{
			"populate": true,
			"windowTypes": ["normal"]
		}
	);
	if (!window || (window == undefined))
		return null;

	return window;
}

// On startup and around every 15 seconds, make sure all windows have the tabs they need (catches
// stuff like detached tabs).
chrome.alarms.create("windowCreateFinish", {
	periodInMinutes: .25,
	when: Date.now()
});

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
	New:
		Settings as async getter functions (that can be await'd)
		On tab activation - same as before
		On tab creation - nothing
		On window creation - keep special tabs
		On tab detach, consider closing the special tabs (might have to suspend keep on close for that specific window or tab)
			If that doesn't work, go back to closing the whole window like before.
		On tab close (remove), check that tab's window to make sure we have the proper tabs (could maybe expand it to all windows, but that might be overkill)
		On settings change - same as before (just now using async getter functions)
		"keep special tabs" - same basic idea, but clean up and document
*/

// #region Settings getters
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
// #endregion Settings getters

async function updateAllWindows()
{
	const windows = await chrome.windows.getAll({ "populate": true, "windowTypes": ["normal"] });
	windows.forEach(window => { keepNeededTabs(window.id) });
}

async function keepNeededTabs(targetWindowId) {
	if(!targetWindowId)
		return;
	
	const targetWindow = await getWindow(targetWindowId);
	if (!targetWindow || (targetWindow == undefined) )
		return

	const pinnedURL = await getPinnedURL();
	
	// Safety checks
	if(pinnedURL == "")
		return;
	if(targetWindow.type != "normal")
		return;
	
	// Make sure our special pinned tab is the first one in the window.
	if (!isSpecialPinnedTab(targetWindow.tabs[0], pinnedURL))
	{
		chrome.tabs.create({
			"windowId": targetWindow.id,
			"url":      pinnedURL,
			"index":    0,
			"pinned":   true,
			"active":   false
		});
		
		// Since new windows always have at least 1 tab to begin with, if we just added a pinned tab the
		// window is guaranteed to have 2 (so we won't need to add an additional tab below).
		return;
	}

	// Make sure we have at least 1 additional tab with our pinned tab (as a window with only our pinned
	// tab will close if the user tries to close that tab).
	if (targetWindow.tabs.length < 2)
	{ 
		chrome.tabs.create({
			"windowId": targetWindow.id,
			"active":   true
		});
	}
}


function isSpecialPinnedTab(tab, urlToCheck) { // GDB TODO rename (honestly most of these functions)
	if (urlToCheck == "")
		return false;
	if(!tab || (tab == undefined) )
		return false;
	if(!tab.pinned)
		return false;
	
	// Make sure the tab has (or will have once it loads) our target URL.
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
async function windowCreated(newWindow) {
	// NextCreateTriggersKeep = true;
	// const key =  + newWindow.id.toString();
	// await chrome.storage.local.set({ "WindowCreated": true });

	// setWindowJustCreated(newWindow.id, true);

	console.log("Created window: " + newWindow.id.toString());
	keepNeededTabs(newWindow.id); // GDB TODO see attach event below, for: why does doing this here (but not in tab creation) cause an error on merging a tab back into an existing window?
}

async function setWindowJustCreated(windowId, toValue)
{ 
	const windowCreated = await chrome.storage.local.get(["WindowCreated"])
	
	if (!windowCreated)
	{
		windowCreated = {};
		await chrome.storage.local.set({ "WindowCreated": windowCreated });
	}
	
	windowCreated[windowId] = toValue;
}

async function wasWindowJustCreated(windowId)
{ 
	const windowCreated = await chrome.storage.local.get(["WindowCreated"])

	return windowCreated[windowId];

	// await chrome.storage.local.set({ "WindowCreated": true });
}

/**
 * gdbtodo
 * https://developer.chrome.com/docs/extensions/reference/api/tabs#event-onActivated
 * @param gdbtodo activeInfo gdbtodo
 */
async function tabActivated(activeInfo) {
	if (!await shouldBlockPinnedTabFocus())
		return;

	// GDB TODO back here
		// chrome.windows.get(
		// 	activeInfo.windowId,
		// 	{
		// 		"populate": true,
		// 		"windowTypes": ["normal"]
		// 	},
		// 	function (targetWindow)
		// 	{
		// 		if (ourTabIsFocused(targetWindow))
		// 			unfocusPinnedTab(targetWindow);
		// 	}
		// );
}
async function ourTabIsFocused(targetWindow) {
	if(!targetWindow || (targetWindow == undefined) )
		return false;
	
	var firstTab = targetWindow.tabs[0];
	if(!firstTab.active)
		return false;
	
	if(!isSpecialPinnedTab(firstTab, await getPinnedURL()))
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
async function tabCreated(tab)
{
	// // When the first tab in a new window gets created, add in our special pinned tab.
	// // if (await wasWindowJustCreated(tab.windowId))
	// if (await chrome.storage.local.get(["WindowCreated"]))
	// {
	// 	// NextCreateTriggersKeep = false;
	// 	await chrome.storage.local.set({ "WindowCreated": false })
	// 	// setWindowJustCreated(tab.windowId, false);
	// 	keepSpecialTabs(tab.windowId);
	// }
	console.log("Tab created: " + tab.id.toString());
}

/**
 * gdbtodo
 * https://developer.chrome.com/docs/extensions/reference/api/tabs#event-onDetached
 * @param gdbtodo tabId gdbtodo
 * @param gdbtodo detachInfo gdbtodo
 */
async function tabDetached(tabId, detachInfo) { // GDB TODO should I just get rid of the extra pinned tab here rather than trying to hit the whole window?
	console.log("Tab detached from window: " + detachInfo.oldWindowId.toString()); // GDB TODO might take an override or something to say "ignore tabRemoved for this particular window", maybe?
	
	const detachedWindow = await chrome.windows.get(detachInfo.oldWindowId, { "populate": true });
	
	if(!detachedWindow)
		return;
	// if(!await chrome.windows.get(detachedWindow.id, {
	// 	"populate": true,
	// 	"windowTypes": ["normal"]
	// });
	if (detachedWindow.tabs.length != 1)
		return;
	if(!isSpecialPinnedTab(detachedWindow.tabs[0]))
		return;
	
	try	{
		chrome.windows.remove(detachedWindow.id);
	}
	catch (error)
	{ 
		// The above sometimes fails on attaching a new tab to an existing window, because onDetached fires
		// on attaching for some reason - but we don't care because the window already closed.
	}
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
	
	keepNeededTabs(removeInfo.windowId);
}

/**
 * Fires when the local storage (where our settings are kept) change.
 * https://developer.chrome.com/docs/extensions/reference/api/storage#event-onChanged
 * @param {object} changes Contains all changed keys with oldValue/newValue inside.
 */
function storageChanged(changes)
{
	// Only need to worry about updating things if something about the pinned tab URL changed.
	if (!changes[KOPT_PinnedURL])
		return;

	const { oldValue, newValue } = changes[KOPT_PinnedURL]; // GDB TODO finish converting everything over (conversion and the like) to new simplified settings node
	const oldPinnedURL = oldValue;
	const newPinnedURL = newValue;

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

/**
 * "Convert" a window over to a new pinned tab URL (replacing the old pinned tab with a new one).
 * @param {Window} targetWindow The window object to convert
 * @param {string} oldPinnedURL The URL that we were previously using for our special pinned tabs
 * @param {string} newPinnedURL The URL that we now want to use for our special pinned tabs
 */
async function convertWindow(targetWindow, oldPinnedURL, newPinnedURL) {
	var firstTab = targetWindow.tabs[0];
	if(!isSpecialPinnedTab(firstTab, oldPinnedURL))
		return;
	
	chrome.tabs.update(
		firstTab.id,
		{
			"url": newPinnedURL
		}
	);
}




