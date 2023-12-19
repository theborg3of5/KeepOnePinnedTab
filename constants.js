// Options for which sort of pinned tab we keep.
var PinnedTabPage_Default    = "Default";
var PinnedTabPage_BlankLight = "BlankLight";
var PinnedTabPage_BlankDark  = "BlankDark";
var PinnedTabPage_Custom     = "Custom";

// Actual URLs for the non-custom pinned tab options.
var PinnedTabURL_Default    = "chrome://newtab/";
var PinnedTabURL_BlankLight = chrome.runtime.getURL("Resources/blankLight.html");
var PinnedTabURL_BlankDark  = chrome.runtime.getURL("Resources/blankDark.html");

// Keys that we use to index into the sync storage.
var KOPT_NoFocusTab = "KeepOnePinnedTab_NoFocusPinnedTab";
var KOPT_Page       = "KeepOnePinnedTab_PinnedTabPage";
var KOPT_CustomURL  = "KeepOnePinnedTab_CustomPinnedTabURL";
const KOPT_PinnedURL = "KeepOnePinnedTab_PinnedURL";
