Chrome Tab Registry
===================

A tab registry library for use in Google Chrome extensions.

A problem when working with tabs in Google Chrome extensions is that there are situations in which
they don't retain a consistent ID. These scripts attempt to assign tabs a consistent and unique GUID
so they can be accurately identified.

The problem and proposed solution is well explained on Stack Overflow: [Persistent unique ID for Chrome tabs that lasts between browser sessions](http://stackoverflow.com/questions/11005258/persistent-unique-id-for-chrome-tabs-that-lasts-between-browser-sessions).

This solution:
- Is not 100% robust
- Ultimately shouldn't be required
