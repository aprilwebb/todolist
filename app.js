import dotenv from "dotenv";
import express from "express";
import bodyParser from "body-parser";
import session from "express-session";
import passport from "passport";
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
    saveUninitialized: false,
  })
);

app.use(passport.initialize());
app.use(passport.session());

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

///////////////////////////////////////////////////////////////////////////

let items = [];
let currentListTitle = "My To Do List";

///////////////////////////////////////////////////////////////////////////

app.get("/", async (req, res) => {
  res.render("home.ejs");
});

app.get("/mylist", async (req, res) => {
  try {
    const userId = req.isAuthenticated() ? req.user.id : null;

    if (userId) {
      const result = await db.query(
        "SELECT * FROM items WHERE user_id = $1 ORDER BY id",
        [userId]
      );
      const userItems = result.rows;

      res.render("list.ejs", {
        listTitle: currentListTitle,
        listItems: userItems,
      });
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
    res.redirect("/");
  });
});

// ///////////////////////////////////////////////////////////////////////////
app.post("/add", async (req, res) => {
  const item = req.body.newItem;
  const userId = req.isAuthenticated() ? req.user.id : null;

  try {
    const result = await db.query(
      "INSERT INTO items (title, user_id) VALUES ($1, $2)",
      [item, userId]
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
  const updatedListTitle = req.body.updatedListTitle;
  const listId = req.body.listId;

  try {
    const result = await db.query(
      "UPDATE lists SET list_title = $1 WHERE id = $2",
      [updatedListTitle, listId]
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

  try {
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
  } catch (error) {
    console.log("Signup error:", error);
    res.redirect("/signup");
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
