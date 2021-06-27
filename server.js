const express = require("express");
const webPush = require("web-push");
global.mongoose = require("mongoose");
global.Schema = mongoose.Schema;
global.passport = require("passport");
global.jwt = require("jsonwebtoken");
global.jwt_decode = require("jwt-decode");
global.bcrypt = require("bcryptjs");
global.ObjectId = require("mongodb").ObjectId;
require("./models/user");
require("./models/vendors");
require("./models/products");
require("./models/ledger");
require("dotenv").config();
const PORT = process.env.PORT || 3003;
const URI = process.env.MONGO_URI;
const path = require("path");
const Razorpay = require("razorpay");

global.razorpay = new Razorpay({
  key_id: process.env.RAZOR_PAY_ID,
  key_secret: process.env.RAZOR_PAY_SECRET,
});

const { handleSignIn } = require("./config/passport.js");
global.notify = (client, body) => {
  return NotificationSubscription.findOne({ client }).then((subscription) => {
    if (subscription) {
      return webPush.sendNotification(subscription, body);
    }
  });
};

const publicVapidKey = process.env.PUBLIC_VAPID_KEY;
const privateVapidKey = process.env.PRIVATE_VAPID_KEY;
webPush.setVapidDetails(
  "mailto:support@schoolforblinds.com",
  publicVapidKey,
  privateVapidKey
);

global.app = express();

mongoose
  .connect(URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useCreateIndex: true,
    useFindAndModify: false,
  })
  .then(() => console.log("connected to db"))
  .catch((err) => console.log("could not connect to db, here's why: " + err));

app.use(express.json());

const cookieParser = require("cookie-parser");
app.use(cookieParser());
require("./config/passport");
app.use(passport.initialize());

require("./routes/user.js");

require("./routes/assistant.js");

app.post("/api/contactUsRequest", (req, res) => {
  new ContactUs({ ...req.body })
    .save()
    .then((dbRes) => {
      res.json({ message: "request submitted" });
    })
    .catch((err) => {
      console.log(err);
      res.status(500).json({ message: "something went wrong" });
    });
});

app.get("/api/logout", (req, res) => {
  res.clearCookie("access_token");
  res.json({ user: null, success: true });
});

// ------------------------------------------------------- OAuth
app.get(
  "/api/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);
app.get(
  "/googleAuthcalllback",
  passport.authenticate("google", {
    successRedirect: "/",
    failureRedirect: "/login",
  }),
  handleSignIn
);
app.get("/api/auth/facebook", passport.authenticate("facebook"));
app.get(
  "/facebookAuthCallback",
  passport.authenticate("facebook", {
    successRedirect: "/",
    failureRedirect: "/login",
  }),
  handleSignIn,
  (err, req, res, next) => {
    res.status(401).json({ code: 401, message: "invalid credentials" });
  }
);

require("./routes/appointments.js");

require("./routes/medicalRecords.js");

require("./routes/teleConsult.js");

require("./routes/chat.js");

require("./routes/pharmacy.js");

require("./routes/diagnostic.js");

app.get("/api/getSpeciality", (req, res) => {
  Speciality.find({
    $or: [
      { name: new RegExp(req.query.q, "gi") },
      { symptoms: new RegExp(req.query.q, "gi") },
    ],
  })
    .limit(8)
    .then((dbRes) => {
      res.json(dbRes);
    })
    .catch((err) => {
      console.log(err);
      res.status(500).json({ message: "something went wrong" });
    });
});

// notification
app.post("/subscribe", (req, res) => {
  new NotificationSubscription({ ...req.body })
    .save()
    .then((dbRes) => {
      res.status(200).json({ message: "successfully subscribed" });
    })
    .catch((err) => {
      res.status(500).json({ message: "something went wrong" });
    });
});
app.delete("/unsubscribe", (req, res) => {
  NotificationSubscription.findByIdAndDelete(req.body._id)
    .then((dbRes) => {
      res.status(200).json({ message: "successfully unsubscribed" });
    })
    .catch((err) => {
      res.status(500).json({ message: "something went wrong" });
    });
});

app.use(express.static("public"));

const socketIO = require("socket.io");
const io = socketIO(
  app.listen(PORT, () => {
    console.log("user/vendor backend listening to port:", PORT);
  })
);

io.on("connection", async (socket) => {
  const sockets = await io.fetchSockets();
  const _id = socket.handshake.query.user;
  const type = socket.handshake.query.type;
  const target = socket.handshake.query.target;
  if (type === "vendor") {
    socket.join(_id);
  } else {
    socket.join(target);
    io.to(target).emit("connected");
    // io.broadcast.to(target).emit("connected");
    // clients on "connected" puts the target
    // into query params of next request
  }
  socket.on("newMessage", (payload) => {
    io.to(socket.handshake.query.room).emit("newData", {
      user: payload.id,
      message: payload.message,
    });
  });
});
