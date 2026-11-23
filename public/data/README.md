# Star data

`stars.bin`, `star-names.json`: derived from the HYG Database v4.1
(https://github.com/astronexus/HYG-Database) by David Nash / astronexus.
License: CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0/).
These derived files are shared under the same license.

Changes: stars ≤ 1000 pc, Sol removed, positions rotated to the site's ecliptic scene frame,
B-V → temperature + RGB, binary packing. Regenerate: `node scripts/build-star-catalog.mjs <hygdata_v41.csv>`.
