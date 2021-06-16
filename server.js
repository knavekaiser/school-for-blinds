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
require("dotenv").config();
const PORT = process.env.PORT || 3001;
const URI = process.env.MONGO_URI;
const path = require("path");

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

app.put(
  "/api/assignAsstToVendor",
  passport.authenticate("vendorPrivate"),
  (req, res) => {
    const { vendor, asst } = req.body;
    Promise.all([
      Vendor.findOne({ _id: vendor }),
      Assistant.findOne({ _id: asst }),
    ])
      .then(([vendor, asst]) => {
        if (vendor && asst) {
          const newAssts = [
            ...vendor.assistants.filter(
              (asst) => asst.profile.toString() === asst.toString()
            ),
            { profile: asst._id, canApproveAppointments: false },
          ];
          return Promise.all([
            Vendor.findOneAndUpdate(
              { _id: vendor._id },
              { assistants: newAssts }
            ),
            Assistant.findOneAndUpdate(
              { _id: asst._id },
              { vendor: vendor._id }
            ),
          ]);
        } else {
          res.status(400).json({ message: "bad request" });
        }
      })
      .then(([vendor, asst]) => {
        if (vendor && asst) {
          res.json({ message: "assistants assigned" });
        } else {
          res.status(500).json({ message: "something went wrong" });
        }
      })
      .catch((err) => {
        if (err.code === 11000) {
          res
            .status(400)
            .json({ message: "assistant is already assigned to someone else" });
        } else {
          console.log(err);
          res.status(500).json({ message: "something went wrong" });
        }
      });
  }
);
app.put(
  "/api/removeAsstFromVendor",
  passport.authenticate("vendorPrivate"),
  (req, res) => {
    const { vendor, asst } = req.body;
    Promise.all([
      Vendor.findOne({ _id: vendor }),
      Assistant.findOne({ _id: asst }),
    ])
      .then(([vendor, asst]) => {
        if (vendor && asst) {
          const newAssts = [
            ...vendor.assistants.filter(
              (asst) => asst.profile.toString() === asst.toString()
            ),
          ];
          return Promise.all([
            Vendor.findOneAndUpdate(
              { _id: vendor._id },
              { assistants: newAssts }
            ),
            Assistant.findOneAndUpdate({ _id: asst._id }, { vendor: null }),
          ]);
        } else {
          res.status(400).json({ message: "bad request" });
        }
      })
      .then(([vendor, asst]) => {
        if (vendor && asst) {
          res.json({ message: "assistant removed" });
        } else {
          res.status(500).json({ message: "something went wrong" });
        }
      })
      .catch((err) => {
        console.log(err);
        res.status(500).json({ message: "something went wrong" });
      });
  }
);

require("./routes/vendor.js");

app.get("/api/logout", (req, res) => {
  res.clearCookie("access_token");
  res.json({ user: null, success: true });
});

// ------------------------------------------------------- OAuth
app.get(
  "/api/auth/google",
  passport.authenticate("vendorGoogle", { scope: ["profile", "email"] })
);
app.get(
  "/googleAuthcalllback",
  passport.authenticate("vendorGoogle", {
    session: false,
    failWithError: true,
  }),
  handleSignIn,
  (err, req, res, next) => {
    res.status(401).json({ code: 401, message: "invalid credentials" });
  }
);
app.get("/api/auth/facebook", passport.authenticate("vendorFacebook"));
app.get(
  "/facebookAuthCallback",
  passport.authenticate("vendorFacebook", {
    session: false,
    failWithError: true,
  }),
  handleSignIn,
  (err, req, res, next) => {
    res.status(401).json({ code: 401, message: "invalid credentials" });
  }
);

app.post("/api/addSpeciality", (req, res) => {
  new Speciality({
    name: req.body.name,
    symptoms: req.body.symptoms,
  })
    .save()
    .then((dbRes) => {
      res.json({ message: "speciality added" });
    })
    .catch((err) => {
      console.log(err);
      res.status(500).json({ message: "something went wrong" });
    });
});
app.get("/api/getSpeciality", (req, res) => {
  // WARNING: this aggregate pipeline only works in mogodb Atlas
  // Speciality.aggregate([
  //   {
  //     $search: {
  //       index: `symptoms`,
  //       compound: {
  //         should: [
  //           {
  //             autocomplete: {
  //               query: req.query.q,
  //               path: `name`,
  //               tokenOrder: "any",
  //               fuzzy: { maxEdits: 1, prefixLength: 3 },
  //             },
  //           },
  //           {
  //             autocomplete: {
  //               query: req.query.q,
  //               path: `symptoms`,
  //               tokenOrder: "any",
  //               fuzzy: { maxEdits: 1, prefixLength: 3 },
  //             },
  //           },
  //         ],
  //       },
  //     },
  //   },
  //   { $limit: 8 },
  // ])

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

require("./routes/appointments.js");

require("./routes/medicalRecords.js");

require("./routes/teleConsult.js");

require("./routes/chat.js");

require("./routes/pharmacy.js");

require("./routes/diagnostic.js");

// this funciton stats an interval that runs a function every 1 minutes,
// which finds any appointment between 9 and 10 minutes
// sends all the doctors and clients notification saying,
// 'your next appointment starts in 10 minutes'
function appointmentReminder() {
  setInterval(() => {
    const min = new Date(new Date().getTime() + 540000);
    const max = new Date(new Date().getTime() + 600000);
    Book.find({
      date: { $lte: max, $gte: min },
      approved: true,
      completed: false,
      cancelled: false,
    }).then((appointments) => {
      Promise.all(
        appointments.map(async (app) => {
          notify(
            app.vendor,
            JSON.stringify({
              title: "upcoming appointment",
              body: `your next appointment starts in 10 minute`,
            })
          );
          notify(
            app.user,
            JSON.stringify({
              title: "upcoming appointment",
              body: `your appointment starts in 10 minute`,
            })
          );
        })
      );
    });
  }, 1000);
}

app.post(
  "/api/notifyUserVendor",
  passport.authenticate("vendorPrivate"),
  (req, res) => {
    const { _id, title, body } = req.query._id;
    notifyUser(
      _id,
      JSON.stringify({
        title,
        body,
      })
    );
    // send email or sms here
  }
);
app.post(
  "/api/notifyUserAsst",
  passport.authenticate("asstPrivate"),
  (req, res) => {
    const { _id, title, body } = req.query._id;
    notifyUser(
      _id,
      JSON.stringify({
        title,
        body,
      })
    );
    // send email or sms here
  }
);

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
    console.log("listening to port:", PORT);
  })
);

app.get(
  "/api/initiateChat",
  passport.authenticate("userPrivate"),
  (req, res) => {
    console.log("users are asking for doctors online");
    res.json("");
  }
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
