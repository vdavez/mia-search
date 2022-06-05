module.exports = function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy("src/assets");
  // Return your Object options:
  return {
    dir: {
      input: "src",
      output: "_site",
    },
    templateFormats: ["html", "md", "njk"],
    passthroughFileCopy: true,
  };
};
