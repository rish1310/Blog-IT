import express from "express";
import bodyParser from "body-parser";
import _ from "lodash";
import mongoose from "mongoose";
import env from 'dotenv';
import bcrypt from "bcrypt";
import session from "express-session";
import flash from "express-flash";
import passport from "passport";
import { Strategy } from "passport-local";
import GoogleStrategy from "passport-google-oauth2";
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

env.config();

mongoose.connect(process.env.MONGO_URI);
function formatDate() {  //function for publish date
  const options = { month: 'long', day: 'numeric', year: 'numeric' };
  const today = new Date();
  return today.toLocaleDateString('en-US', options);
}

const homeStartingContent = "Welcome to BlogIT, the digital haven where words come to life and ideas take flight. As we usher you into a realm of boundless creativity and compelling narratives, BlogIT stands as a vibrant community dedicated to the art of blogging. Whether you're an experienced wordsmith or a novice storyteller, our platform is your canvas. Engage with thought-provoking articles, diverse perspectives, and the latest insights across a spectrum of topics. BlogIT is not just a website; it's a celebration of expression, a nexus where the power of words converges with the dynamic pulse of the digital age. Join us on this exciting journey, where every post is a step into the extraordinary tapestry of the blogosphere.";

const app = express();
const port = 3000;
const saltRounds = 13;
app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: true }));

app.set('view engine', 'ejs');
app.set('views', join(__dirname, 'views'));

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: true
}));
app.use(flash());

app.use(passport.initialize());
app.use(passport.session());

app.use((req, res, next) => {
  res.locals.authenticated = req.isAuthenticated();
  next();
});

const usersSchema = new mongoose.Schema({
  _id: Number,
  firstName: String,
  lastName: String,
  email: String,
  password: String
});


// Middleware to handle automatic incrementation of ID before saving
usersSchema.pre('save', function (next) {
  const doc = this;
  if (doc.isNew) {
    latestId = Math.max(doc._id || 0, latestId) + 1;
    doc._id = latestId;
  }
  next();
});

const User = mongoose.model("User", usersSchema);

const users = await User.find({});
let latestId = users[users.length - 1]._id || 0;

const blogsSchema = ({
  title: String,
  body: String,
  author: {
    id: {
      type: mongoose.Schema.Types.Number,
      ref: "User"
    },
    name: String
  },
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
  if (req.isAuthenticated()) {
    res.render("compose.ejs");
  } else {
    res.redirect("/login");
  }
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

app.get("/author/:userID", async (req, res) => {
  try {
    const requestedUser = req.params.userID;
    const blogs = await Blog.find({ 'author.id': requestedUser });
    console.log(blogs);
    res.render("author.ejs", { blogs: blogs, _ });
  } catch (error) {
    console.log(error);
  }

});

app.get("/register", async (req, res) => {
  if (req.isAuthenticated()) {
    res.redirect("/dashboard");
  } else {
    res.render("register.ejs");
  }
});

app.get("/login", async (req, res) => {
  if (req.isAuthenticated()) {
    res.redirect("/dashboard");
  } else {
    res.render("login.ejs");
  }
});

app.get("/logout", (req, res) => {
  req.logout((err) => {
    if (err) console.log(err);
    res.redirect("/");
  });
});

app.get("/dashboard", async (req, res) => {
  if (req.isAuthenticated()) {
    const blogs = await Blog.find({ 'author.id': req.user._id });
    res.render("dashboard.ejs", { blogs: blogs, name: req.user.firstName + " " + req.user.lastName });
  } else {
    res.redirect("/login");
  }
})

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

app.get("/auth/google", passport.authenticate("google", {
  scope: ["profile", "email"]
})
);

app.get(
  "/auth/google/dashboard",
  passport.authenticate("google", {
    successRedirect: "/dashboard",
    failureRedirect: "/login",
  })
);

app.post("/register", async (req, res) => {
  const email = req.body.username;
  const password = req.body.password;
  const foundUser = await User.findOne({ email: email });
  if (foundUser) {
    return res.render('register', { error: 'Email already exists. Try logging in.' });
  } else {
    bcrypt.hash(password, saltRounds, (err, hash) => {
      if (err) {
        console.log("Error Hashing password: ", err);
      } else {
        const newUser = new User({
          firstName: req.body.fname,
          lastName: req.body.lname,
          email: email,
          password: hash
        });
        newUser.save();
        req.login(newUser, (err) => {
          console.log(err);
          res.redirect("/dashboard");
        });
      }
    });
  }
});

app.post("/login", (req, res, next) => {
  passport.authenticate("local", {
    successRedirect: "/dashboard",
    failureRedirect: "/login",
    failureFlash: true  // Enable flash messages
  })(req, res, next);
});

passport.use("local", new Strategy(async function verify(username, password, cb) {
  try {
    const user = await User.findOne({ email: username });
    if (user) {
      const storedHashedPassword = user.password;
      bcrypt.compare(password, storedHashedPassword, (err, result) => {
        if (err) {
          return cb(err);
        } else {
          if (result) {
            return cb(null, user);
          } else {
            return cb(null, false, { message: 'Wrong Email/Password. Please try again.' });
          }
        }
      });
    } else {
      return cb(null, false, { message: 'Wrong Email/Password. Please try again.' });
    }
  } catch (err) {
    return cb(err);
  }
}));

passport.use("google", new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: "https://blog-it-f51h.onrender.com/auth/google/dashboard",
  userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
}, async (accessToken, refreshToken, profile, cb) => {
  // console.log(profile);
  try {
    const result = await User.findOne({ email: profile.email });
    if (!result) {
      let lastName = profile.name.familyName;
      if (lastName == undefined) {
        lastName = "";
      }
      const newUser = new User({
        firstName: profile.name.givenName,
        lastName: lastName,
        email: profile.email,
        password: "google"
      });
      newUser.save();
      cb(null, newUser);
    } else {
      cb(null, result);
    }
  } catch (err) {
    return cb(err);
  }
}
))

app.post("/compose", (req, res) => {
  const publishdate = formatDate();
  const blog = new Blog({
    title: req.body.blogTitle,
    body: req.body.blogBody,
    author: {
      id: req.user._id,
      name: req.user.firstName + " " + req.user.lastName
    },
    date: publishdate
  });
  blog.save();
  res.redirect("/");
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

  await Blog.findByIdAndUpdate(blogToEdit._id, {
    title: updatedTitle,
    body: updatedBody,
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

passport.serializeUser((user, cb) => {
  cb(null, user);
});
passport.deserializeUser((user, cb) => {
  cb(null, user);
});

app.listen(process.env.PORT || port, () => {
  console.log(`Server started on port ${port}`);
});
