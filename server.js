const express = require("express");
const webPush = require("web-push");
global.mongoose = require("mongoose");
global.Schema = mongoose.Schema;
global.passport = require("passport");
global.jwt = require("jsonwebtoken");
global.jwt_decode = require("jwt-decode");
global.bcrypt = require("bcryptjs");
global.ObjectID = require("mongodb").ObjectID;
require("./models/user");
require("./models/vendors");
require("./models/products");
require("dotenv").config();
const PORT = process.env.PORT || 3001;
const URI = process.env.MONGO_URI;
const path = require("path");
function genCode(length) {
  if (length <= 0) return;
  var result = "";
  while (result.length < length) {
    result += Math.floor(Math.random() * 10);
  }
  return result;
}

const publicVapidKey = process.env.PUBLIC_VAPID_KEY;
const privateVapidKey = process.env.PRIVATE_VAPID_KEY;
webPush.setVapidDetails(
  "mailto:support@schoolforblinds.com",
  publicVapidKey,
  privateVapidKey
);

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

const cookieParser = require("cookie-parser");
app.use(cookieParser());
require("./config/passport");
app.use(passport.initialize());

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
  if (name && phone && email && password) {
    bcrypt
      .hash(password, 10)
      .then((hash) => {
        return new User({
          ...req.body,
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
app.post(
  "/api/userLogin",
  passport.authenticate("user", { session: false, failWithError: true }),
  (req, res, next) => {
    const user = req.user;
    const token = signToken(req.user._id);
    res.cookie("access_token", token, { httpOnly: true, sameSite: true });
    res.status(200).json({ code: "ok", isAuthenticated: true, user: user });
  },
  (err, req, res, next) => {
    console.log(err);
    res.status(401).json({ code: 401, message: "invalid credentials" });
  }
);
app.get(
  "/api/authUser",
  passport.authenticate("userPrivate", {
    session: false,
    failWithError: true,
  }),
  (req, res) => {
    const user = { ...req.user._doc };
    ["pass", "__v"].forEach((key) => delete user[key]);
    res.json({ code: "ok", user });
  },
  (err, req, res, next) => {
    res.status(401).json({ code: 401, message: "invalid credentials" });
  }
);

app.post("/api/sendVendorLoginOTP", async (req, res) => {
  const { phone } = req.body;
  const code = genCode(6);
  const [user, hash] = await Promise.all([
    User.findOne({ phone }),
    bcrypt.hash(code, 10),
    LoginOTP.findOneAndDelete({ id: phone }),
  ]);
  if (user) {
    new LoginOTP({
      id: req.body.phone,
      code: hash,
    })
      .save()
      .then((dbRes) => {
        if (dbRes) {
          console.log(code);
          // send text massage here
          res.json({
            message: "6 digit code has been sent, enter it within 2 minutes",
          });
        } else {
          res.status(500).json({ message: "something went wrong" });
        }
      })
      .catch((err) => {
        console.log(err);
        console.log("something went wrong");
      });
  } else {
    res.status(400).json({ message: "invalid requrest" });
  }
});
app.put("/api/submitVendorLoginOTP", async (req, res) => {
  const { phone, code } = req.body;
  const dbOtp = await LoginOTP.findOne({ id: phone });
  if (!dbOtp) {
    res.status(404).json({ message: "code does not exists" });
    return;
  }
  if (bcrypt.compareSync(code, dbOtp.code)) {
    User.findOne({ phone }).then((dbUser) => {
      const user = JSON.parse(JSON.stringify(dbUser));
      const token = signToken(user._id);
      ["pass", "__v"].forEach((key) => delete user[key]);
      res.cookie("access_token", token, { httpOnly: true, sameSite: true });
      res.status(200).json({ code: "ok", isAuthenticated: true, user: user });
    });
  } else {
    if (dbOtp.attempt > 2) {
      LoginOTP.findOneAndDelete({ id: phone }).then(() => {
        res.status(429).json({ message: "start again" });
      });
    } else {
      dbOtp.updateOne({ attempt: dbOtp.attempt + 1 }).then(() => {
        res
          .status(400)
          .json({ message: "wrong code", attempt: dbOtp.attempt + 1 });
      });
    }
  }
});

app.post("/api/registerVendor", (req, res) => {
  const { vendorType, name, phone, email, password, age, gender } = req.body;
  if (
    (vendorType === "Doctor" || vendorType === "Clinic") &&
    name &&
    email &&
    password &&
    phone
  ) {
    const Model = global[vendorType];
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
app.post(
  "/api/vendorLogin",
  passport.authenticate("vendor", { session: false, failWithError: true }),
  (req, res, next) => {
    const user = req.user;
    const token = signToken(req.user._id);
    res.cookie("access_token", token, { httpOnly: true, sameSite: true });
    res.status(200).json({ code: "ok", isAuthenticated: true, user: user });
  },
  (err, req, res, next) => {
    res.status(401).json({ code: 401, message: "invalid credentials" });
  }
);
app.get(
  "/api/authVendor",
  passport.authenticate("vendorPrivate", {
    session: false,
    failWithError: true,
  }),
  (req, res) => {
    const user = { ...req.user._doc };
    ["pass", "__v"].forEach((key) => delete user[key]);
    res.json({ code: "ok", user });
  },
  (err, req, res, next) => {
    res.status(401).json({ code: 401, message: "invalid credentials" });
  }
);
app.get(
  "/api/vendorPrivate",
  passport.authenticate("vendorPrivate", {
    session: false,
    failWithError: true,
  }),
  (req, res) => {
    res.json({ message: "private route" });
  },
  (err, req, res, next) => {
    res.status(401).json({ code: 401, message: "invalid credentials" });
  }
);

app.post("/api/sendVendorLoginOTP", async (req, res) => {
  const { phone } = req.body;
  const code = genCode(6);
  const [user, hash] = await Promise.all([
    Vendor.findOne({ phone }),
    bcrypt.hash(code, 10),
    LoginOTP.findOneAndDelete({ id: phone }),
  ]);
  if (user) {
    new LoginOTP({
      id: req.body.phone,
      code: hash,
    })
      .save()
      .then((dbRes) => {
        if (dbRes) {
          console.log(code);
          // send text massage here
          res.json({
            message: "6 digit code has been sent, enter it within 2 minutes",
          });
        } else {
          res.status(500).json({ message: "something went wrong" });
        }
      })
      .catch((err) => {
        console.log(err);
        console.log("something went wrong");
      });
  } else {
    res.status(400).json({ message: "invalid requrest" });
  }
});
app.put("/api/submitVendorLoginOTP", async (req, res) => {
  const { phone, code } = req.body;
  const dbOtp = await LoginOTP.findOne({ id: phone });
  if (!dbOtp) {
    res.status(404).json({ message: "code does not exists" });
    return;
  }
  if (bcrypt.compareSync(code, dbOtp.code)) {
    Vendor.findOne({ phone }).then((vendor) => {
      const user = JSON.parse(JSON.stringify(vendor));
      const token = signToken(vendor._id);
      ["pass", "__v"].forEach((key) => delete user[key]);
      res.cookie("access_token", token, { httpOnly: true, sameSite: true });
      res.status(200).json({ code: "ok", isAuthenticated: true, user: user });
    });
  } else {
    if (dbOtp.attempt > 2) {
      LoginOTP.findOneAndDelete({ id: phone }).then(() => {
        res.status(429).json({ message: "start again" });
      });
    } else {
      dbOtp.updateOne({ attempt: dbOtp.attempt + 1 }).then(() => {
        res
          .status(400)
          .json({ message: "wrong code", attempt: dbOtp.attempt + 1 });
      });
    }
  }
});

app.get("/logout", (req, res) => {
  res.clearCookie("access_token");
  res.json({ user: null, success: true });
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

app.get(
  "/api/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);
app.get(
  "/googleAuthcalllback",
  passport.authenticate("google", { session: false, failWithError: true }),
  (req, res) => {
    const token = signToken(req.user._id);
    const user = req.user;
    res.cookie("access_token", token, { httpOnly: true, sameSite: true });
    res.status(200).json({ code: "ok", isAuthenticated: true, user: user });
  },
  (err, req, res, next) => {
    res.status(401).json({ code: 401, message: "invalid credentials" });
  }
);
app.get("/api/auth/facebook", passport.authenticate("facebook"));
app.get(
  "/facebookAuthCallback",
  passport.authenticate("facebook", { session: false, failWithError: true }),
  (req, res) => {
    const token = signToken(req.user._id);
    const user = req.user;
    res.cookie("access_token", token, { httpOnly: true, sameSite: true });
    res.status(200).json({ code: "ok", isAuthenticated: true, user: user });
  },
  (err, req, res, next) => {
    res.status(401).json({ code: 401, message: "invalid credentials" });
  }
);

app.get("/api/findVendors", (req, res) => {
  const {
    q,
    type,
    gender,
    age,
    speciality,
    sort,
    order,
    onlineBooking,
    education,
    perPage,
    page,
    userLocation,
    maxDistance,
  } = req.query;
  const query = {
    ...(q && {
      $or: [
        { name: { $regex: new RegExp(q, "gi") } },
        { keywords: { $in: [new RegExp(q, "gi")] } },
      ],
    }),
    ...(type && { type }),
    ...(gender && { gender }),
    ...(speciality && { speciality: new RegExp(speciality, "gi") }),
    ...(education && { education: new RegExp(education, "gi") }),
    ...(age && { age }),
    ...(onlineBooking && { onlineBooking: onlineBooking === "true" }),
  };
  const sortOrder = {
    ...(sort && { sort: order === "asc" ? 1 : -1 }),
    ...(userLocation ? { distance: -1 } : { age: order === "asc" ? 1 : -1 }),
  };
  const pipeline = [
    ...(userLocation
      ? [
          {
            $geoNear: {
              near: {
                type: "Point",
                coordinates: [
                  +userLocation.split(",")[0],
                  +userLocation.split(",")[1],
                ],
              },
              spherical: true,
              distanceField: "distance",
              key: "chambers.location",
              maxDistance: maxDistance || 200000000,
            },
          },
        ]
      : []),
    { $match: query },
    {
      $project: {
        distance: 1,
        rating: "$rating.totalRating",
        onlineBooking: 1,
        available: 1,
        type: 1,
        name: 1,
        phone: 1,
        education: 1,
        speciality: 1,
        age: 1,
        chambers: { $size: { $ifNull: ["$chambers", []] } },
        bookings: { $size: { $ifNull: ["bookings", []] } },
        price: {
          $cond: {
            if: { $gt: [{ $sum: "$chambers.charge" }, 0] },
            then: {
              $divide: [
                { $sum: "$chambers.charge" },
                { $size: { $ifNull: ["$chambers", []] } },
              ],
            },
            else: 0,
          },
        },
        keywords: 1,
      },
    },
    { $sort: sortOrder },
    {
      $facet: {
        vendors: [
          { $skip: +perPage * (+(page || 1) - 1) },
          { $limit: +(perPage || 20) },
        ],
        pageInfo: [{ $group: { _id: null, count: { $sum: 1 } } }],
      },
    },
  ];
  Vendor.aggregate(pipeline).then((data) => {
    res.json(data);
  });
});
app.get("/api/getVendorDetails", (req, res) => {
  if (!ObjectID.isValid(req.query._id)) {
    res.status(400).json({ message: "worng _id" });
    return;
  }
  Vendor.findOne({ _id: req.query._id }).then((data) => {
    res.json(data);
  });
});
app.get("/api/checkDoctorsCalendar", (req, res) => {
  const { _id, from, to } = req.query;
  const query = {
    vendor: _id,
    ...(from && to && { from, to }),
  };
  if (!ObjectID.isValid(_id)) {
    res.status(400).json({ message: "wrong or no _id" });
    return;
  }
  Book.find(query, "date sessionLength").then((data) => {
    res.json(data);
  });
});
app.post("/api/bookAnAppointment", (req, res) => {
  const { vendor, user, date, address, sessionLength, charge } = req.body;
  let bookingInfo = {};
  new Book({
    vendor,
    user,
    date,
    address,
    sessionLength,
    charge,
  })
    .save()
    .then((dbRes) => {
      bookingInfo = dbRes;
      return Promise.all([
        Vendor.updateBooking(vendor),
        User.updateBooking(user),
      ]);
    })
    .then(() => {
      res.json({ message: "successfully booked", bookingInfo });
      NotificationSubscription.findOne({ vendor: bookingInfo.vendor }).then(
        (subscription) => {
          webPush.sendNotification(
            subscription,
            JSON.stringify({
              title: "appoint booked",
              body: `an appointment has been booked for ${bookingInfo.date}`,
            })
          );
        }
      );
    })
    .catch((err) => {
      console.log(err);
      res.status(500).json({ message: "something went wrong" });
    });
});
app.patch("/api/approveAppointment", (req, res) => {
  Book.findOneAndUpdate(
    { _id: req.body._id, approved: false },
    { approved: true }
  )
    .then((dbRes) => {
      res.json({ message: "appointment approved" });
      NotificationSubscription.findOne({ client: dbRes.user }).then(
        (subscription) => {
          webPush.sendNotification(
            subscription,
            `Your appointment has been approved for ${new Date(dbRes.date)}`
          );
        }
      );
    })
    .catch((err) => {
      res.status(500).json({ message: "something went wrong" });
    });
});
app.patch("/api/cancelAnAppointment", (req, res) => {
  Book.findOneAndUpdate(
    { _id: req.body.appointment_id, user: req.body.user },
    { cancelled: true }
  )
    .then((appointment) => {
      if (appointment) {
        res.json({ message: "appointment has been cancelled" });
        NotificationSubscription.findOne({ vendor: appointment.vendor }).then(
          (subscription) => {
            webPush.sendNotification(
              subscription,
              JSON.stringify({
                title: "appoint cancelled",
                body: "an appointment has been cancelled",
              })
            );
          }
        );
      } else {
        res.status(400).json({ message: "appointment could not be found" });
      }
    })
    .catch((err) => {
      res.status(500).json({ message: "something went wrong" });
    });
});
app.patch("/api/updatedPrescription", (req, res) => {
  Prescription.findByIdAndUpdate(req.body._id, { ...req.body });
});
app.post("/api/addPrescription", (req, res) => {
  const { vendor, user, date, img, medicines } = req.body;
  new Prescription({
    vendor,
    user,
    date,
    img,
    medicines,
  })
    .save()
    .then((dbRes) => {
      res.json({ message: "prescription saved" });
    })
    .catch((err) => {
      res.json({ message: "something went wrong" });
    });
});

app.post("/api/addMedicine", (req, res) => {
  new Medicine({
    ...req.body,
  })
    .save()
    .then((dbRes) => {
      res.json({ message: "medicine added" });
    })
    .catch((err) => {
      console.log(err);
      res.status(500).json({ message: "something went worng" });
    });
});
app.get("/api/findMedicine", (req, res) => {
  const { name, brand, price, sort, order, perPage, page } = req.query;
  const sortOrder = {
    [sort || "popularity"]: order === "asc" ? 1 : -1,
  };
  const query = {
    ...(name && { name }),
    ...(brand && { brand }),
    ...(price && {
      price: { $gt: +price.split("-")[0], $lt: +price.split("-")[1] },
    }),
  };
  Medicine.aggregate([
    { $match: query },
    {
      $lookup: {
        from: "sales",
        localField: "sales",
        foreignField: "_id",
        as: "sales",
      },
    },
    {
      $project: {
        popularity: {
          $reduce: {
            input: "$sales",
            initialValue: { total: 0 },
            in: {
              total: { $add: ["$$value.total", "$$this.qty"] },
            },
          },
        },
        name: 1,
        available: 1,
        brand: 1,
        price: 1,
        createdAt: 1,
        updatedAt: 1,
        prescriptionRequired: 1,
        dscr: 1,
        discount: 1,
      },
    },
    {
      $set: {
        popularity: "$popularity.total",
      },
    },
    { $sort: sortOrder },
    {
      $facet: {
        medicines: [
          { $skip: +perPage * (+(page || 1) - 1) },
          { $limit: +(perPage || 20) },
        ],
        pageInfo: [{ $group: { _id: null, count: { $sum: 1 } } }],
      },
    },
  ])
    .then((medicines) => {
      res.json(medicines);
    })
    .catch((err) => {
      console.log(err);
      res.status(500).json({ message: "something went wrong" });
    });
});
app.get("/api/checkMedicineAvailability", (req, rse) => {
  Medicine.findOne({ _id: req.query._id })
    .then((medicine) => {
      if (medicine) {
        res.json({ available: medicine.available });
      } else {
        res.json({ available: 0 });
      }
    })
    .catch((err) => {
      res.status(500).json({ message: "something went wrong" });
    });
});
app.post("/api/placeOrder", (req, res) => {
  new Order({
    products: req.body.products,
    total: req.body.total,
    discount: req.body.discount,
    customer: req.body.customer,
  })
    .save()
    .then((order) => {
      res.json("order has been placed");
    })
    .catch((err) => {
      console.log(err);
      res.status(500).json({ message: "something went wrong" });
    });
});
app.get("/api/getOrders", (req, res) => {
  const {
    sort,
    order,
    page,
    perPage,
    paid,
    approved,
    shipped,
    delivered,
    within,
  } = req.query;
  const query = {
    ...(within && {
      "customer.address.shipping.location": {
        $geoWithin: {
          $geometry: {
            type: "Polygon",
            coordinates: within,
          },
        },
      },
    }),
  };
  const sortOrder = {
    [sort || "age"]: order === "asc" ? 1 : -1,
  };
  mongoose
    .aggregate([
      {
        $lookup: {
          from: "medicines",
          localField: "products.product",
          foreignField: "_id",
          as: "string",
        },
      },
      { $sort: sortOrder },
      {
        $facet: {
          vendors: [
            { $skip: +perPage * (+(page || 1) - 1) },
            { $limit: +(perPage || 20) },
          ],
          pageInfo: [{ $group: { _id: null, count: { $sum: 1 } } }],
        },
      },
    ])
    .then((orders) => {
      res.json({ orders });
    });
});
app.patch("/api/approveOrder", (req, res) => {
  Order.findByIdAndUpdate(req.body._id, { approved: true })
    .then((dbRes) => {
      res.json({ message: "order approved" });
      // send mail or sms to dbRes.customer.email/phone
    })
    .catch((err) => {
      console.log(err);
      res.status(500).json({ message: "something went wrong" });
    });
});
app.patch("/api/updateOrder", (req, res) => {
  Order.findByIdAndUpdate(req.body._id, { ...req.body })
    .then((dbRes) => {
      res.json({ message: "order updated" });
    })
    .catch((err) => {
      console.log(err);
      res.status(500).json({ message: "something went wrong" });
    });
});

app.post("/api/addDiagnostic", (req, res) => {
  new Diagnostic({
    ...req.body,
  })
    .save()
    .then((dbRes) => {
      res.json({ message: "diagnostic added" });
    })
    .catch((err) => {
      console.log(err);
      res.status(500).json({ message: "something went wrong" });
    });
});
app.patch("/api/updateDiagnostic", (req, res) => {
  Diagnostic.findByIdAndUpdate(req.body._id, { ...req.body })
    .then((dbRes) => {
      res.json({ message: "successfully updated" });
    })
    .catch((err) => {
      console.log(err);
      res.status(500).json({ message: "something went worng" });
    });
});
app.get("/api/getDiagnostics", (req, res) => {
  const { q, page, perPage, userLocation, sort, order } = req.query;
  const query = {
    ...(q && {
      $or: [{ name: { $regex: new RegExp(q, "gi") } }],
    }),
  };
  const sortOrder = {
    ...(sort && { sort: order === "asc" ? 1 : -1 }),
    ...(userLocation
      ? { distance: -1 }
      : { bookings: order === "asc" ? 1 : -1 }),
  };
  const pipeline = [
    ...(userLocation
      ? [
          {
            $geoNear: {
              near: {
                type: "Point",
                coordinates: [
                  +userLocation.split(",")[0],
                  +userLocation.split(",")[1],
                ],
              },
              spherical: true,
              distanceField: "distance",
              key: "chambers.location",
              maxDistance: maxDistance || 200000000,
            },
          },
        ]
      : []),
    { $match: query },
    {
      $project: {
        distance: 1,
        available: 1,
        name: 1,
        bookings: { $size: { $ifNull: ["$bookings", []] } },
        price: 1,
        discount: 1,
        keywords: 1,
      },
    },
    { $sort: sortOrder },
    {
      $facet: {
        vendors: [
          { $skip: +perPage * (+(page || 1) - 1) },
          { $limit: +(perPage || 20) },
        ],
        pageInfo: [{ $group: { _id: null, count: { $sum: 1 } } }],
      },
    },
  ];
  Diagnostic.aggregate(pipeline)
    .then((diagnostic) => {
      res.json(diagnostic);
    })
    .catch((err) => {
      console.log(err);
      res.status(500).json({ message: "something went wrong" });
    });
});
app.get("/api/getDiagnosticDetail", (req, res) => {
  Diagnostic.findOne({ _id: req.query._id })
    .then((diagnostic) => {
      res.json(diagnostic);
    })
    .catch((err) => {
      console.log(err);
      res.status(500).json({ message: "something went wrong" });
    });
});
app.post("/api/bookDiagnostic", (req, res) => {
  new DiagnosticBooking({ ...req.body })
    .save()
    .then((dbRes) => {
      res.json(dbRes);
    })
    .catch((err) => {
      console.log(err);
      res.status(500).json({ message: "something went wrong" });
    });
});
app.path("/api/updateDiagnosticBooking", (req, res) => {
  DiagnosticBooking.findByIdAndUpdate(req.body._id, { ...req.body })
    .then((dbRes) => {
      res.json({ message: "booking updated" });
    })
    .catch((err) => {
      console.log(err);
      res.status(500).json({ message: "something went wrong" });
    });
});

app.post("/api/postSales", (req, res) => {
  new Sales({
    product: req.body._id,
    qty: req.body.qty,
  })
    .save()
    .then((dbRes) => {
      res.json("done");
      Medicine.addSale(req.body._id, dbRes._id);
    })
    .catch((err) => {
      console.log(err);
      res.status(500).json({ message: "something went wrong" });
    });
});

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
          NotificationSubscription.find({ client: app.vendor }).then(
            (subscription) => {
              webPush.sendNotification(
                subscription,
                JSON.stringify({
                  title: "upcoming appointment",
                  body: `your next appoint starts in 10 minute`,
                })
              );
            }
          );
        })
      );
    });
  }, 1000);
}

app.patch("/api/sessionCompleted", (req, res) => {
  Book.findOneAndUpdate(
    { _id: req.body._id, approved: true },
    { completed: true }
  )
    .then((currentAppointment) => {
      if (currentAppointment) {
        res.json({ message: "successfully updated" });
        return currentAppointment;
      } else {
        throw 404;
      }
    })
    .then((currentAppointment) => {
      return Book.find({
        vendor: currentAppointment.vendor,
        date: { $gte: new Date(currentAppointment.date) },
        completed: false,
      })
        .sort({ date: 1 })
        .limit(1);
    })
    .then((nextAppointment) => {
      return Vendor.findById(nextAppointment[0].vendor, "assistants").populate(
        "assistants"
      );
    })
    .then((vendor) => {
      if (vendor.assistants && vendor.assistants.length) {
        const activeAsst = vendor.assistants.filter(
          (asst) => asst.status.canApproveAppointments
        )[0];
        NotificationSubscription.findOne({ client: activeAsst._id }).then(
          (subscription) => {
            webPush.sendNotification(
              subscription,
              JSON.stringify({
                title: "appointment ended",
                body:
                  "an appointment has just been ended, please take a photograph of the prescription and upload",
              })
            );
          }
        );
      }
    })
    .catch((err) => {
      if (err === 404) {
        res
          .status(400)
          .json({ message: "appointment has not been approved yet" });
      } else {
        res.status(500).json({ message: "something went wrong" });
      }
    });
});
app.post("/api/giveFeedbackToVendor", (req, res) => {
  const { vendor, rating, feedback } = req.body;
  const user = req.user._id;
  Vendor.addFeedback({ vendor, rating, user: req.user, feedback })
    .then((dbRes) => {
      res.json({ message: "feedback posted" });
    })
    .catch((err) => {
      console.log(err);
      res.status(500).json({ message: "something went wrong" });
    });
});
app.get("/api/getDelay", (req, res) => {
  const { vendor, appointmentTime } = req.query;
  if (!ObjectID.siValid(vendor)) {
    res.status(400).json({ message: "wrong or no id" });
    return;
  }
  Book.aggregate([
    {
      $match: {
        approved: true,
        vendor: ObjectId(vendor),
        date: { $lt: Date("2021-06-09T06:52:29.000+00:00") },
      },
    },
    {
      $group: {
        _id: null,
        time: { $sum: "$sessionLength" },
      },
    },
  ])
    .then((raw) => {
      if (raw.length) {
        return raw[0].time;
      } else {
        return null;
      }
    })
    .then((dbRes) => {
      res.json({ estimatedDelay: dbRes });
    })
    .catch((err) => {
      res.json({ message: "something went wrong" });
    });
});

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
app.post("/unsubscribe", (req, res) => {
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
