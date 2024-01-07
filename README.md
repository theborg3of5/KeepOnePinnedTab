Keep one (optionally unfocusable) per window pinned tab open at all times. Prevents Chrome windows from closing with last tab.
This extension prevents Chrome from closing when you close the final tab in a window. It keeps one pinned, blank tab always open as the first tab in your tab bar, and reopens it if it is closed.

------------------------

Inspired by "Live On":
https://chrome.google.com/webstore/detail/live-on/oficfgdfeoknbjfhommlpiekdapmnebh/

Icons by Everaldo Coelho:
http://www.everaldo.com/

Project released open-source, Github project available:
https://github.com/theborg3of5/KeepOnePinnedTab

------------------------

Please note that this was made for personal use, so replies and fixes may be delayed.

------------------------

Changelog:
1.0: Initial Release.
1.1: Bugfix: now takes into account whether the window is a popup vs. normal, and allows selection of special tab to aid in easier ctrl+tabbing.
1.2: Broke main functionality with last update, now fixed.
1.3: Extending closing functionality to second, semi-special tab.
2.0: Back from hiatus! Fixed the issue where a new pinned tab would appear upon every startup for some users, and moved the close-extra-new-tabs functionality out to a new extension, called "Close Extra New Tabs" (see other apps by this developer).
3.0: Added an options page! You can now set what URL you want the pinned tab to have, rather than it always being your new tab page. Defaults to new tab page if you don't set it.
3.1: Fixed an issue where the extension would open tabs forever, sorry folks!
3.2: Took out a console.log() that was left in (no functional impact).
4.0: Major update! Changes:
  - Built-in options for pages to pin.
  - Option: no focus special pinned tab.
  - Squashed all known bugs.
4.1: A few small bugfixes:
  - Don't open two new tabs (+ pinned one) when opening a new window.
  - Work correctly in incognito mode.
4.2: Fix issue where we keep opening new pinned tabs when Chrome is allowed to stay open in the background
5.0: Complete rewrite and upgrade to manifest v3!
  - Fixes the "never focus pinned tab" setting.
  - Cleans up the settings page (and changes how we store settings behind the scenes).