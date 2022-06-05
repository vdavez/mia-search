# MiA Search

Proof of concept of search for Made in America Waivers using client-side search.

## How it works

The actual site is built using [eleventy](https://11ty.dev), and specifically uses [pagination](https://www.11ty.dev/docs/pagination/) to create individual waiver pages from the [MiA data](https://github.com/GSA/made-in-america-data). [NB: The data source has some quality issues (specifically around data duplication), which caused some build errors until I manually removed a dupe.]

Then, for search, we use [minisearch]((https://github.com/lucaong/minisearch).

The whole thing compiles into the `_site` directory, which can be served on [Federalist](https://federalist.18f.gov).

## How to run it

```sh
npm install
npm run start
```
