const express = require("express");
const jwt = require("jsonwebtoken");
const config = require("./config");
const axios = require("axios");
const db = require("./db");
const app = express();
const http = require("http");
const server = http.createServer(app);
const { Server } = require("socket.io");
require("dotenv").config();
app.use(express.json());



const safeDbRequest = async (lambda, defaultVal = {}) => {
  const e = new Error();
  try {
    const rv = await lambda();
    return rv || defaultVal;
  } catch (e) {
    return defaultVal;
  }
};

const verifyPassword = async (password, password_hash) => {
  const result = await axios.get(
    "http://141.94.77.9/caisse/verify_password.php?password=" +
      password +
      "&" +
      "hashed_password=" +
      password_hash
  );
  return result.data;
};

app.post("/api/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    let user = await safeDbRequest(
      () => db.qr_user.findOne({ where: { username: username } }),
      {}
    );
    console.log(user.dataValues);
    let password_hash = user.password_hash;
    password_hash = password_hash.replace(/^\$2y(.+)$/i, "$2a$1");
    if (user) {
      user = user.dataValues;
      if (await verifyPassword(password, password_hash)) {
        const restaurant = await safeDbRequest(
          () =>
            db.qr_restaurant.findOne({
              where: {
                user_id: user.manager_id,
              },
            }),
          {}
        );

        const token = jwt.sign(
          { userId: user.id, restId: restaurant.dataValues.id },
          config.JWTPRIVATEKEY
        );
   

        return res.send({
          token,
          user_id: user.id,
          username: user.username,
          tva: restaurant.dataValues.tva,
          address: restaurant.dataValues.address,
          telephone: restaurant.dataValues.telephone,
        });
      }
      res.status(400).send({ msg: "wrong password" });
    }
   } catch (err) {
    console.log(err);
    res.status(400).send({ msg: "user not found" });
  }
});


const io = new Server(server,{
  cors:{
    origin:"*",
    methods:["GET","POST"]
  }
  
});


var cors = require("cors");
app.use(cors());

app.get("/", (req, res) => {
  res.sendFile(__dirname + "/index.html");
});

io.on("connection", (socket) => {
  console.log("a user connected");
  socket.on("notification", (data) => {
    console.log(data);
    socket.broadcast.emit("a",data)
  });
  socket.on("disconnect", () => {
    console.log("user disconnected");
  });
});


server.listen(5002, () => {
  console.log("listening on *:5002");
});
