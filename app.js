import express from "express";
import bodyParser from "body-parser";
import _ from "lodash";
import mongoose from "mongoose";
import dotenv from 'dotenv';
dotenv.config();

mongoose.connect(process.env.MONGODBURI);
function formatDate() {  //function for publish date
  const options = { month: 'long', day: 'numeric', year: 'numeric' };
  const today = new Date();
  return today.toLocaleDateString('en-US', options);
}

const homeStartingContent = "Welcome to BlogIT, the digital haven where words come to life and ideas take flight. As we usher you into a realm of boundless creativity and compelling narratives, BlogIT stands as a vibrant community dedicated to the art of blogging. Whether you're an experienced wordsmith or a novice storyteller, our platform is your canvas. Engage with thought-provoking articles, diverse perspectives, and the latest insights across a spectrum of topics. BlogIT is not just a website; it's a celebration of expression, a nexus where the power of words converges with the dynamic pulse of the digital age. Join us on this exciting journey, where every post is a step into the extraordinary tapestry of the blogosphere.";

const app = express();
const port = 3000;
app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: true }));

const blogsSchema = ({
  title: String,
  body: String,
  author: String,
  date: String
});

const Blog = mongoose.model("Blog", blogsSchema);

app.get("/", async (req, res) => {
  const blogs = await Blog.find({});
  res.render("home.ejs", {
    home: homeStartingContent,
    blogs: blogs
  });
});

app.get("/about", (req, res) => {
  res.render("about.ejs");
});

app.get("/contact", (req, res) => {
  res.render("contact.ejs");
});

app.get("/compose", (req, res) => {
  res.render("compose.ejs");
});

app.post("/compose", (req, res) => {
  const publishdate = formatDate();
  const blog = new Blog({
    title: req.body.blogTitle,
    body: req.body.blogBody,
    author: req.body.blogAuthor,
    date: publishdate
  });
  blog.save();
  res.redirect("/");
});

app.get("/blogs/:blogName", async (req, res) => {
  const requestedTitle = req.params.blogName;
  let newBlog;
  const blogs = await Blog.find({});
  blogs.forEach((blog) => {

    if (_.lowerCase(blog.title) == _.lowerCase(requestedTitle)) {
      newBlog = blog;
    }
  });
  res.render("blog.ejs", { blog: newBlog, blogs: blogs });
});

app.get("/edit/:blogName", async (req, res) => {
  const requestedTitle = req.params.blogName;
  let blogToEdit;
  const blogs = await Blog.find({});
  blogs.forEach((blog) => {
    if (_.lowerCase(blog.title) == _.lowerCase(requestedTitle)) {
      blogToEdit = blog;
    }
  });
  res.render("compose.ejs", { blog: blogToEdit });
});

app.post("/edit/:blogName", async (req, res) => {
  const requestedTitle = req.params.blogName;
  let blogToEdit;
  const blogs = await Blog.find({});
  blogs.forEach((blog) => {
    if (_.lowerCase(blog.title) == _.lowerCase(requestedTitle)) {
      blogToEdit = blog;
    }
  });
  const updatedTitle = req.body.blogTitle;
  const updatedBody = req.body.blogBody;
  const updatedAuthor = req.body.blogAuthor;

  await Blog.findByIdAndUpdate(blogToEdit._id, {
    title: updatedTitle,
    body: updatedBody,
    author: updatedAuthor
  });
  res.redirect(`/blogs/${encodeURIComponent(updatedTitle)}`);
});

app.post("/blogs/:blogName", async (req, res) => {
  const blogId = req.body.deleteBlog;
  const action = req.query._method || req.body._method;
  if (action === "DELETE") {
    await Blog.deleteOne({ _id: blogId });
    res.redirect("/");
  } else {
    res.status(400).send("Invalid action");
  }
});


app.listen(process.env.PORT || port, () => {
  console.log(`Server started on port ${port}`);
});
