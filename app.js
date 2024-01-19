import dotenv from "dotenv";
import express from "express";
import bodyParser from "body-parser";
import session from "express-session";
import passport from "passport";
import GoogleStrategy from "passport-google-oauth20";
import bcrypt from "bcrypt";
import pg from "pg";

dotenv.config();
const app = express();
const port = 3000;

const db = new pg.Client({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});
db.connect();

app.use(express.static("public"));
app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({ extended: true }));

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24,
    },
  })
);

app.use(passport.initialize());
app.use(passport.session());

///////////////////////////////////////////////////////////////////////////

let items = [];
let defaultListTitle = ["My List"];
///////////////////////////////////////////////////////////////////////////

app.get("/", async (req, res) => {
  res.render("login.ejs");
});

app.get("/mylist", async (req, res) => {
  try {
    const userId = req.isAuthenticated() ? req.user.id : null;

    if (userId) {
      const result = await db.query(
        "SELECT * FROM items WHERE user_id = $1 ORDER BY id",
        [userId]
      );
      const listsResult = await db.query(
        "SELECT id, list_title FROM lists WHERE user_id = $1",
        [userId]
      );
      const userItems = result.rows;

      if (listsResult.rows.length > 0) {
        res.render("list.ejs", {
          lists: listsResult.rows,
          listItems: userItems,
        });
      } else {
        await db.query(
          "INSERT INTO lists (list_title, user_id) VALUES ($1, $2) RETURNING *",
          [defaultListTitle[0], userId]
        );
        const newListResult = await db.query(
          "SELECT id, list_title FROM lists WHERE user_id = $1",
          [userId]
        );
        res.render("list.ejs", {
          lists: newListResult.rows,
          listItems: userItems,
        });
      }
    } else {
      res.redirect("/login");
    }
  } catch (error) {
    console.log(error);
    res.redirect("/login");
  }
});

app.get("/login", (req, res) => {
  res.render("login");
});

app.get("/signup", (req, res) => {
  res.render("signup");
});

app.get("/logout", (req, res) => {
  req.logout((err) => {
    if (err) {
      console.error("Logout error:", err);
    }
    req.session = null;
    res.redirect("/login");
  });
});

app.get(
  "/auth/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
  })
);

app.get(
  "/auth/google/taskmaster",
  passport.authenticate("google", {
    successRedirect: "/mylist",
    failureRedirect: "/login",
  })
);

// ///////////////////////////////////////////////////////////////////////////
app.post("/add", async (req, res) => {
  const item = req.body.newItem;
  const userId = req.isAuthenticated() ? req.user.id : null;
  const listId = req.body.listId;

  try {
    const result = await db.query(
      "INSERT INTO items (title, user_id, list_id) VALUES ($1, $2, $3)",
      [item, userId, listId]
    );

    res.redirect("/mylist");
  } catch (error) {
    console.log(error);
  }
});

app.post("/addList", async (req, res) => {
  const list = req.body.newList;
  const userId = req.isAuthenticated() ? req.user.id : null;

  try {
    const result = await db.query(
      "INSERT INTO lists (list_title, user_id) VALUES ($1, $2)",
      [list, userId]
    );
    res.redirect("/mylist");
  } catch (error) {
    console.log(error);
  }
});

app.post("/edit", async (req, res) => {
  const item = req.body.updatedItemTitle;
  const id = req.body.updatedItemId;

  try {
    const result = await db.query("UPDATE items SET title = $1 WHERE id = $2", [
      item,
      id,
    ]);
    res.redirect("/mylist");
  } catch (error) {
    console.log(error);
  }
});

app.post("/editListTitle", async (req, res) => {
  const updatedListTitle = req.body.listTitle;
  const userId = req.isAuthenticated() ? req.user.id : null;

  try {
    const result = await db.query(
      "UPDATE lists SET list_title = $1 WHERE user_id = $2",
      [updatedListTitle, userId]
    );
    res.redirect("/mylist");
  } catch (error) {
    console.log(error);
  }
});

app.post("/delete", async (req, res) => {
  const id = req.body.deleteItem;

  try {
    const result = await db.query("DELETE FROM items WHERE id = $1", [id]);
    res.redirect("/mylist");
  } catch (error) {
    console.log(error);
  }
});

app.post("/login", async (req, res) => {
  const email = req.body.username;
  const password = req.body.password;

  if (!email || !password) {
    console.log("Login failed: Username and password are required");
    return res.redirect("/login");
  }
  try {
    const result = await db.query(
      "SELECT id, password_hash FROM users WHERE username = $1",
      [email]
    );

    if (result.rows.length > 0) {
      const storedPasswordHash = result.rows[0].password_hash;

      const password_match = await bcrypt.compare(password, storedPasswordHash);

      if (password_match) {
        req.login(result.rows[0], (err) => {
          if (err) {
            console.log("Login error:", err);
            res.redirect("/login");
          } else {
            console.log("Logged in");
            res.redirect("/mylist");
          }
        });
      } else {
        console.log("Login failed: Incorrect password");
        res.redirect("/login");
      }
    } else {
      console.log("Login failed: User not found");
      res.redirect("/signup");
    }
  } catch (error) {
    console.log(error);
  }
});

app.post("/signup", async (req, res) => {
  const email = req.body.username;
  const password = req.body.password;

  if (!email || !password) {
    console.log("Sign Up failed: Username and password are required");
    return res.redirect("/signup");
  }

  try {
    const existingUser = await db.query(
      "SELECT * FROM users WHERE username = $1",
      [email]
    );

    if (existingUser.rows.length > 0) {
      console.log("User already exists. Try logging in.");
      return res.redirect("/login");
    } else {
      const hashedPassword = await bcrypt.hash(password, 10);
      const result = await db.query(
        "INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING *",
        [email, hashedPassword]
      );

      const newUser = result.rows[0];

      req.login(newUser, (err) => {
        if (err) {
          console.log("Login error:", err);
          res.redirect("/login");
        } else {
          console.log("User signed up and logged in successfully");
          res.redirect("/mylist");
        }
      });
    }
  } catch (error) {
    console.log("Signup error:", error);
    res.redirect("/signup");
  }
});

passport.use(
  "google",
  new GoogleStrategy(
    {
      clientID: process.env.CLIENT_ID,
      clientSecret: process.env.CLIENT_SECRET,
      callbackURL: "http://localhost:3000/auth/google/taskmaster",
      userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo",
    },
    async (accessToken, refreshToken, profile, cb) => {
      try {
        const existingUser = await db.query(
          "SELECT * FROM users WHERE username = $1",
          [profile.emails[0].value]
        );
        console.log(profile);
        if (existingUser.rows.length === 0) {
          const newUser = await db.query(
            "INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING *",
            [profile.emails[0].value, "google"]
          );
          cb(null, newUser.rows[0]);
          console.log("New User: ", newUser.rows[0]);
        } else {
          cb(null, existingUser.rows[0]);
          console.log("Existing user: ", existingUser.rows[0]);
        }
      } catch (error) {
        cb(error);
      }
    }
  )
);

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const result = await db.query("SELECT * FROM users WHERE id = $1", [id]);

    if (result.rows.length > 0) {
      const user = result.rows[0];
      done(null, user);
    } else {
      done(new Error("User not found"), null);
    }
  } catch (error) {
    done(error, null);
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
