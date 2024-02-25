import express from "express";
import bodyParser from "body-parser";
import axios from "axios";

const app = express();
const port = process.env.PORT || 8000;

const API_URL = "https://openlibrary.org";

let authorArray = [];

let genreArray = [];

app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: true }));

app.get("/", (req, res) => {
  res.render("index.ejs");
});

app.get("/search-author", (req, res) => {
  res.render("search-author.ejs");
});

app.get("/search-genre", (req, res) => {
  res.render("search-genre.ejs");
});

// Make text title case
function toTitleCase(str) {
  return str.replace(/\w\S*/g, function (txt) {
    return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
  });
}

// search using the /author endpoint for works and return the first one
async function fetchTopWork(authorName, authorKey) {
  try {
    const formatAuthorKey = authorKey.substring(9);
    const response = await axios.get(
      `${API_URL}/search/authors.json?q=${authorName}`
    );
    const authors = response.data.docs;

    const index = authors.findIndex((x) => x.key === formatAuthorKey);

    const topWork = authors[index].top_work;
    const topSubjects = authors[index].top_subjects;
    
    // console.log("AUTHOR: " + authorName + ", KEY= "+formatAuthorKey+", INDEX: " + index+ ", BOOK: " + authors[index].top_work);

    if (authors.length >= 0) {
      // Returns the top work from given author
      return { topWork: topWork, topSubjects: topSubjects };
    } else {
      return "No works found";
    }
  } catch (error) {
    console.error("Error fetching works for author:", authorName, error);
    return "Error fetching works";
  }
}

// Search for genre or author using dropdown to select search type
app.post("/search", async (req, res) => {
  const searchType = req.body.searchType;

  if (searchType === "searchAuthor") {
    try {
      const authorInput = req.body.searchInput;
      const authorInputTitleCase = toTitleCase(authorInput);

      // Search for an author to get the genres they write
      const response = await axios.get(
        `${API_URL}/search/authors.json?q=${authorInput}&lang=eng`
      );

      //Push author name and their top genres to a new array
      const result = response.data.docs;
      authorArray = [];

      result.forEach((result) => {
        authorArray.push({
          author: result.name,
          subjects: result.top_subjects,
          key: result.key,
          topWork: result.top_work,
        });
      });

      res.render("search-author.ejs", {
        contentAuthorList: authorArray,
        searchInputLowercase: authorInput,
        searchInputTitleCase: authorInputTitleCase,
      });
    } catch (error) {
      console.log("Error fetching author", error);
      res.status(500);
    }

    // search for a genre to get top 25 authors
  } else if (searchType === "searchGenre") {
    try {
      const genreInput = req.body.searchInput;
      const genreInputTitleCase = toTitleCase(genreInput);

      const response = await axios.get(
        `${API_URL}/subjects/${genreInput}.json?details=true&lang=eng`
      );

      // push authors and their open library key to an array
      genreArray = response.data.authors
        .map((author) => ({
          name: author.name,
          authorLastName: author.name.split(" ").slice(-1).join(" "),
          authorFirstName: author.name.split(" ").slice(0, -1).join(" "),
          key: author.key,
        }))
        .sort(
          (a, b) =>
            a.authorLastName.localeCompare(b.authorLastName) ||
            a.authorFirstName.localeCompare(b.authorFirstName)
        );

      // get the top work for each author and push to array
      const fetchWorkPromises = genreArray.map(async (author) => {
        author.topWorkSubjects = await fetchTopWork(author.name, author.key);

        return author;
      });

      const authorsWithTopWorks = await Promise.all(fetchWorkPromises);

      res.render("search-genre.ejs", {
        contentGenreList: authorsWithTopWorks,
        searchInputLowercase: genreInput,
        searchInputTitleCase: genreInputTitleCase,
      });
    } catch (error) {
      console.log("Error fetching genre", error);
      res.status(500);
    }
  }
});

app.listen(port, () => {
  console.log(`App listening at http://localhost:${port}`);
});
