const express = require("express");
global.mongoose = require("mongoose");
global.Schema = mongoose.Schema;
global.passport = require("passport");
global.jwt = require("jsonwebtoken");
global.jwt_decode = require("jwt-decode");
const bcrypt = require("bcryptjs");
const ObjectID = require("mongodb").ObjectID;
require("./models/user");
require("./models/vendors");
require("dotenv").config();
const PORT = process.env.PORT || 3001;
const URI = process.env.MONGO_URI;

const app = express();

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

require("./config/passport");
app.use(passport.initialize());

app.get("/failed", (req, res) => {
  res.json({ message: "auth Failed" });
});

app.post("/api/registerUser", (req, res) => {
  const {
    name,
    phone,
    email,
    password,
    location,
    age,
    gender,
    address,
  } = req.body;
  if (name && phone && email && password && location && age && gender) {
    bcrypt
      .hash(password, 10)
      .then((hash) => {
        return new User({
          ...req.boy,
          pass: hash,
        }).save();
      })
      .then((dbRes) => {
        res.json({ message: "registered successfully", user: dbRes });
      })
      .catch((err) => {
        if (err.code === 11000) {
          res.status(400).json({
            message: "user exists",
            code: err.code,
            field: Object.keys(err.keyValue)[0],
          });
        } else {
          console.log(err);
          res.status(500).json({ message: "something went wrong" });
        }
      });
  } else {
    res.status(400).json({ message: "Incomplete request" });
  }
});
app.post("/api/registerVendor", (req, res) => {
  const { vendorType, name, email, password, phone } = req.body;
  if (
    (vendorType === "Doctor" || vendorType === "Clinic") &&
    name &&
    email &&
    password &&
    phone
  ) {
    const Model = global[vendorType];
    console.log(name);
    bcrypt
      .hash(password, 10)
      .then((hash) => new Model({ ...req.body, pass: hash }).save())
      .then((dbRes) => {
        res.json({ message: "registered successfully", user: dbRes });
      })
      .catch((err) => {
        if (err.code === 11000) {
          res.status(400).json({
            message: "user exists",
            code: err.code,
            field: Object.keys(err.keyValue)[0],
          });
        } else {
          console.log(err);
          res.status(500).json({ message: "something went wrong" });
        }
      });
  } else {
    res.status(400).json({ message: "Incomplete request" });
  }
});
const signToken = (_id) => {
  return jwt.sign(
    {
      iss: "schoolForBlinds",
      sub: _id,
    },
    process.env.JWT_SECRET
  );
};
app.post(
  "/api/login",
  passport.authenticate("local", { session: false, failWithError: true }),
  (req, res, next) => {
    const user = req.use;
    const token = signToken(req.user._id);
    res.cookie("access_token", token, { httpOnly: true, sameSite: true });
    res.status(200).json({ code: "ok", isAuthenticated: true, user: user });
  },
  (err, req, res, next) => {
    res.status(401).json({ code: 401, message: "invalid credentials" });
  }
);

app.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);
app.get(
  "/googleAuthcalllback",
  passport.authenticate("google", { failureRedirect: "/login" }),
  (req, res) => {
    const token = signToken(req.user._id);
    const user = req.user;
    res.cookie("access_token", token, { httpOnly: true, sameSite: true });
    res.status(200).json({ code: "ok", isAuthenticated: true, user: user });
  }
);
app.get("/auth/facebook", passport.authenticate("facebook"));
app.get(
  "/facebookAuthCallback",
  passport.authenticate("facebook", {
    successRedirect: "/",
    failureRedirect: "/login",
  })
);

app.get("/api/findDoctors", (req, res) => {
  Doctor.find({ ...req.query }).then((data) => {
    res.json(data);
  });
});
app.get("/api/getDoctorInfo", (req, res) => {
  Doctor.findOne({ _id: req.query._id }).then((data) => {
    res.json(data);
  });
});
app.get("/api/findClinin", (req, res) => {
  Clinic.find(...req.query).then((data) => {
    res.json(data);
  });
});
app.get("/api/getClinicInfo", (req, res) => {
  Clinic.findOne({ _id: req.query._id }).then((data) => {
    res.json(data);
  });
});
app.get("/api/checkDoctorsCalendar", (req, res) => {
  const { _id, from, to } = req.query;
  const query = {
    vendor: _id,
    ...(from && to && { from, to }),
  };
  Book.find(query, "date").then((data) => {});
});
app.post("/api/bookAnAppointment", (req, res) => {});
app.post("/api/bookAnAppointmentAsGuest", (req, res) => {});

app.listen(PORT, () => {
  console.log("listening to port:", PORT);
});
