# Star data

`stars.bin`, `star-names.json`: derived from the HYG Database v4.1
(https://github.com/astronexus/HYG-Database) by David Nash / astronexus.
License: CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0/).
These derived files are shared under the same license.

Changes: stars ≤ 1000 pc, Sol removed, positions rotated to the site's ecliptic scene frame,
B-V → temperature + RGB, binary packing. Regenerate: `node scripts/build-star-catalog.mjs <hygdata_v41.csv>`.

# Earth place names

`places-earth.json`: towns/cities ≥ 15 000 inhabitants from GeoNames `cities15000`
(https://www.geonames.org, CC BY 4.0) + geography points/marine names from Natural Earth 10m
(https://www.naturalearthdata.com, public domain). Regenerate:
`node scripts/build-earth-places.mjs <cities15000.txt> <regions.geojson> <elev.geojson> <marine.geojson>`
(Natural Earth files: ne_10m_geography_regions_points, ne_10m_geography_regions_elevation_points,
ne_10m_geography_marine_polys).
