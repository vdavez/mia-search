import MiniSearch from "minisearch";
import waivers_data from "./_data/waivers.json";

const waivers = waivers_data.map((d) => {
  return {
    id: d._id,
    title: d.data.procurementTitle,
    summary: d.data.summaryOfProcurement,
    rationale: d.data.waiverRationaleSummary,
  };
});

let miniSearch = new MiniSearch({
  fields: ["title", "summary", "rationale"], // fields to index for full-text search
  storeFields: ["title", "summary"], // fields to return with search results
});

// Index all documents
miniSearch.addAll(waivers);

const searchInput = document.getElementById("search-field");

const getResults = (e) => {
  e.preventDefault();
  let results = miniSearch.search(searchInput.value);
  filterList(results);
};

const filterList = (results) => {
  const children = document.getElementById("waivers").children;
  const ids = results.map((d) => `waiver-${d.id}`);
  if (ids.length === 0) {
    for (var i = 0; i < children.length; i++) {
      children[i].hidden = false;
    }
    return true;
  }

  for (var i = 0; i < children.length; i++) {
    if (!ids.find((e) => e == children[i].id)) {
      children[i].hidden = true;
    } else {
      children[i].hidden = false;
    }
  }
};

document.getElementById("waiver-search").addEventListener("submit", getResults);
