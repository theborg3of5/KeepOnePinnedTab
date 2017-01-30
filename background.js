// Boot it up and schedule functions for events.
updateTabs();
chrome.tabs.onRemoved.addListener(updateTabs);
