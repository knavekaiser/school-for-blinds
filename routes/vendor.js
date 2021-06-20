const {
  handleSignIn,
  signingIn,
  signToken,
  genCode,
} = require("../config/passport.js");

app.post("/api/registerVendor", (req, res) => {
  const { vendorType, name, phone, email, password, age, gender } = req.body;
  if (
    (vendorType === "Doctor" ||
      vendorType === "Clinic" ||
      vendorType === "Pharmacy") &&
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
        if (dbRes) {
          signingIn(dbRes, res);
        } else {
          res.status(500).json({ message: "something went wrong" });
        }
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
  handleSignIn,
  (err, req, res, next) => {
    res.status(401).json({ code: 401, message: "invalid credentials" });
  }
);
app.get(
  "/api/authVendor",
  passport.authenticate("vendorPrivate"),
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
  "/api/viewVendorProfile",
  passport.authenticate("vendorPrivate"),
  (req, res) => {
    Vendor.aggregate([
      {
        $match: {
          _id: new ObjectId(req.user._id),
        },
      },
      {
        $lookup: {
          from: "books",
          localField: "bookings",
          foreignField: "_id",
          as: "bookings",
        },
      },
      {
        $lookup: {
          from: "assistants",
          localField: "assistants.profile",
          foreignField: "_id",
          as: "assistantsProfile",
        },
      },
      {
        $set: {
          assistants: {
            $map: {
              input: "$assistants",
              as: "asst",
              in: {
                canApproveAppointments: "$$asst.canApproveAppointments",
                _id: "$$asst._id",
                profile: {
                  $first: {
                    $filter: {
                      input: "$assistantsProfile",
                      as: "ass",
                      cond: {
                        $eq: ["$$asst.profile", "$$ass._id"],
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      {
        $project: {
          pass: 0,
          __v: 0,
          assistantsProfile: 0,
          "assistants.profile.pass": 0,
          "assistants.profile.__v": 0,
          "assistants.profile.vendor": 0,
        },
      },
    ])
      .then((dbRes) => {
        if (dbRes.length) {
          res.json(dbRes[0]);
        } else {
          res.status(400).json({ message: "account could not be found" });
        }
      })
      .catch((err) => {
        console.log(err);
        res.status(400).json({ message: "something went wrong" });
      });
  }
);
app.patch(
  "/api/editVendorProfile",
  passport.authenticate("vendorPrivate"),
  (req, res) => {
    Vendor.findOneAndUpdate(
      { _id: req.user._id },
      {
        ...req.body,
        ...(req.body.password && {
          pass: bcrypt.hashSync(req.body.password, 10),
        }),
      }
    )
      .then((dbRes) => {
        res.json({ message: "profile updated" });
      })
      .catch((err) => {
        console.log(err);
        res.status(500).json({ message: "something went wrong" });
      });
  }
);

app.post("/api/sendVendorOTP", async (req, res) => {
  const { phone } = req.body;
  const code = genCode(6);
  const [user, hash] = await Promise.all([
    Vendor.findOne({ phone }),
    bcrypt.hash(code, 10),
    OTP.findOneAndDelete({ id: phone }),
  ]);
  if (user) {
    new OTP({
      id: req.body.phone,
      code: hash,
    })
      .save()
      .then((dbRes) => {
        if (dbRes) {
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
    res.status(400).json({ message: "invalid request" });
  }
});
app.put("/api/submitVendorOTP", async (req, res) => {
  const { phone, code } = req.body;
  const dbOtp = await OTP.findOne({ id: phone });
  if (!dbOtp) {
    res.status(404).json({ message: "code does not exists" });
    return;
  }
  if (bcrypt.compareSync(code, dbOtp.code)) {
    Vendor.findOne({ phone }).then((vendor) => {
      const user = JSON.parse(JSON.stringify(vendor));
      signingIn(user, res);
    });
  } else {
    if (dbOtp.attempt > 2) {
      OTP.findOneAndDelete({ id: phone }).then(() => {
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

app.post("/api/sendVendorForgotPassOTP", async (req, res) => {
  const { phone, email } = req.body;
  const code = genCode(6);
  const [user, hash] = await Promise.all([
    Vendor.findOne({ $or: [{ phone }, { email }] }),
    bcrypt.hash(code, 10),
    OTP.findOneAndDelete({ id: phone || email }),
  ]);
  if (user) {
    new OTP({
      id: phone || email,
      code: hash,
    })
      .save()
      .then((dbRes) => {
        if (dbRes) {
          // send text massage or email here
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
    res.status(400).json({ message: "invalid request" });
  }
});
app.put("/api/submitVendorForgotPassOTP", async (req, res) => {
  const { phone, email, code } = req.body;
  const dbOtp = await OTP.findOne({ id: phone || email });
  if (!dbOtp) {
    res.status(404).json({ message: "code does not exists" });
    return;
  }
  if (bcrypt.compareSync(code, dbOtp.code)) {
    OTP.findOneAndUpdate(
      { _id: dbOtp._id },
      { expireAt: new Date(new Date().getTime() + 120000) }
    )
      .then(() => {
        res.json({ message: "OTP correct" });
      })
      .catch((err) => {
        console.log(err);
        res.status(500).json({ message: "something went wrong" });
      });
  } else {
    if (dbOtp.attempt > 2) {
      OTP.findOneAndDelete({ id: phone || email }).then(() => {
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
app.patch("/api/vendorResetPass", async (req, res) => {
  const { phone, email, code, newPass } = req.body;
  const dbOtp = await OTP.findOne({ id: phone || email });
  if (!dbOtp) {
    res.status(404).json({ message: "code does not exists" });
    return;
  }
  if (bcrypt.compareSync(code, dbOtp.code)) {
    bcrypt
      .hash(newPass, 10)
      .then((hash) =>
        Vendor.findOneAndUpdate({ $or: [{ phone }, { email }] }, { pass: hash })
      )
      .then((dbUser) => {
        const user = JSON.parse(JSON.stringify(dbUser));
        signingIn(user, res);
        return dbUser;
      })
      .then((dbUser) => {
        if (dbUser) {
          OTP.findByIdAndDelete(dbOtp._id).then((value) => {});
        }
      })
      .catch((err) => {
        console.log(err);
        res.status(500).json({ message: "something went wrong" });
      });
  } else {
    if (dbOtp.attempt > 2) {
      OTP.findOneAndDelete({ id: phone }).then(() => {
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

app.patch(
  "/api/changeAsstStatus",
  passport.authenticate("vendorPrivate"),
  (req, res) => {
    const { canApproveAppointments, assistant } = req.body;
    const newAsst = req.user.assistants.map((asst) =>
      asst.profile.toString() === assistant.toString()
        ? {
            profile: assistant,
            canApproveAppointments,
          }
        : asst
    );
    Vendor.findOneAndUpdate({ _id: req.user._id }, { assistants: newAsst })
      .then((dbRes) => {
        res.json({ message: "assistant updated" });
      })
      .catch((err) => {
        console.log(err);
        res.status(500).json({ message: "something went wrong" });
      });
  }
);
