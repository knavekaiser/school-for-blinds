const {
  handleSignIn,
  signingIn,
  signToken,
  genCode,
} = require("../config/passport.js");

app.post("/api/registerUser", (req, res) => {
  const { name, phone, email, password, age, gender, address } = req.body;
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
        if (dbRes) {
          signingIn(dbRes._doc, res);
        } else {
          res.status(500).json({
            code: 500,
            message: "Cound not save to database",
            success: false,
          });
        }
      })
      .catch((err) => {
        if (err.code === 11000) {
          res.status(409).json({
            message: "phone or email already exists",
            code: 409,
            success: false,
          });
        } else {
          console.log(err);
          res.status(500).json({
            code: 500,
            message: "database error",
            success: false,
          });
        }
      });
  } else {
    res.status(400).json({
      code: 400,
      message: "missing fields",
      requiredFileds: "name, phone, email, password",
      fieldsFound: req.body,
      success: false,
    });
  }
});
app.post(
  "/api/userLogin",
  passport.authenticate("user", { session: false, failWithError: true }),
  handleSignIn,
  (err, req, res, next) => {
    console.log(err);
    res.status(401).json({ code: 401, message: "invalid credentials" });
  }
);
app.get(
  "/api/authUser",
  passport.authenticate("userPrivate"),
  (req, res) => {
    const user = { ...req.user._doc };
    ["pass", "__v"].forEach((key) => delete user[key]);
    res.json({ code: "ok", user, message: "authentication success" });
  },
  (err, req, res, next) => {
    res.status(401).json({ code: 401, message: "invalid credentials" });
  }
);

app.get(
  "/api/viewUserProfile",
  passport.authenticate("userPrivate"),
  (req, res) => {
    User.aggregate([
      { $match: { _id: ObjectId(req.user._id) } },
      {
        $lookup: {
          from: "chats",
          as: "allChats",
          pipeline: [
            {
              $match: {
                user: new ObjectId(req.user._id),
              },
            },
          ],
        },
      },
      {
        $lookup: {
          from: "teleconsults",
          as: "allTeleConsults",
          pipeline: [
            {
              $match: {
                user: new ObjectId(req.user._id),
              },
            },
          ],
        },
      },
      {
        $set: {
          teleConsults: {
            $filter: {
              input: "$allTeleConsults",
              as: "tele",
              cond: {
                $eq: ["$$tele.user", "$_id"],
              },
            },
          },
          chats: {
            $filter: {
              input: "$allChats",
              as: "chat",
              cond: {
                $eq: ["$$chat.user", "$_id"],
              },
            },
          },
        },
      },
      {
        $lookup: {
          from: "books",
          localField: "appointments",
          foreignField: "_id",
          as: "appointments",
        },
      },
      {
        $project: {
          allChats: 0,
          allTeleConsults: 0,
          pass: 0,
          __v: 0,
        },
      },
    ])
      .then((dbRes) => {
        if (dbRes.length) {
          res.json({ code: "ok", user: dbRes[0] });
        } else {
          res.status(404).json({ code: 404, message: "user does not exists" });
        }
      })
      .catch((err) => {
        console.log(err);
        res.status(500).json({ code: 500, message: "database error" });
      });
  }
);
app.patch(
  "/api/editUserProfile",
  passport.authenticate("userPrivate"),
  (req, res) => {
    User.findOneAndUpdate({ _id: req.user._id }, { ...req.body }, { new: true })
      .then((user) => {
        delete user._doc.pass;
        res.json({ code: "ok", message: "profile updated", user: user._doc });
      })
      .catch((err) => {
        console.log(err);
        res.status(500).json({ code: 500, message: "database error" });
      });
  }
);

app.post("/api/sendUserOTP", async (req, res) => {
  const { phone } = req.body;
  const code = genCode(6);
  const [user, hash] = await Promise.all([
    User.findOne({ phone }),
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
            code: "ok",
            message: "6 digit code has been sent, enter it within 2 minutes",
            success: true,
          });
        } else {
          res.status(500).json({ code: 500, message: "database error" });
        }
      })
      .catch((err) => {
        console.log(err);
        res.status(500).json({ code: 500, message: "database error" });
      });
  } else {
    res.status(404).json({
      code: 404,
      message: "user does not exists",
      success: false,
    });
  }
});
app.put("/api/submitUserOTP", async (req, res) => {
  const { phone, code } = req.body;
  const dbOtp = await OTP.findOne({ id: phone });
  if (!dbOtp) {
    res.status(404).json({ code: 404, message: "code does not exists" });
    return;
  }
  if (bcrypt.compareSync(code, dbOtp.code)) {
    User.findOne({ phone }).then((dbUser) => {
      signingIn(dbUser._doc, res);
    });
  } else {
    if (dbOtp.attempt > 2) {
      OTP.findOneAndDelete({ id: phone }).then(() => {
        res
          .status(403)
          .json({ code: 403, message: "too many attempts, start again" });
      });
    } else {
      dbOtp.updateOne({ attempt: dbOtp.attempt + 1 }).then(() => {
        res.status(400).json({
          code: 400,
          message: "wrong code",
          attempt: dbOtp.attempt + 1,
        });
      });
    }
  }
});

app.post("/api/sendUserForgotPassOTP", async (req, res) => {
  const { phone, email } = req.body;
  const code = genCode(6);
  const [user, hash] = await Promise.all([
    User.findOne({ $or: [{ phone }, { email }] }),
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
            code: "ok",
            message: "6 digit code has been sent, enter it within 2 minutes",
            success: true,
          });
        } else {
          res.status(500).json({ code: 500, message: "database error" });
        }
      })
      .catch((err) => {
        res.status(500).json({ code: 500, message: "database error" });
      });
  } else {
    res.status(400).json({ code: 400, message: "user does not exist" });
  }
});
app.put("/api/submitUserForgotPassOTP", async (req, res) => {
  const { phone, email, code } = req.body;
  const dbOtp = await OTP.findOne({ id: phone || email });
  if (!dbOtp) {
    res.status(404).json({ code: 404, message: "code does not exists" });
    return;
  }
  if (bcrypt.compareSync(code, dbOtp.code)) {
    OTP.findOneAndUpdate(
      { _id: dbOtp._id },
      { expireAt: new Date(new Date().getTime() + 120000) }
    )
      .then(() => {
        res.json({ code: "ok", message: "OTP correct" });
      })
      .catch((err) => {
        console.log(err);
        res.status(500).json({ code: 500, message: "database error" });
      });
  } else {
    if (dbOtp.attempt > 2) {
      OTP.findOneAndDelete({ id: phone || email }).then(() => {
        res.status(403).json({ code: 403, message: "too many attempts" });
      });
    } else {
      dbOtp.updateOne({ attempt: dbOtp.attempt + 1 }).then(() => {
        res.status(400).json({
          code: 400,
          message: "wrong code",
          attempt: dbOtp.attempt + 1,
        });
      });
    }
  }
});
app.patch("/api/userResetPass", async (req, res) => {
  const { phone, email, code, newPass } = req.body;
  const dbOtp = await OTP.findOne({ id: phone || email });
  if (!dbOtp) {
    res.status(404).json({ code: 404, message: "code does not exists" });
    return;
  }
  if (bcrypt.compareSync(code, dbOtp.code)) {
    bcrypt
      .hash(newPass, 10)
      .then((hash) =>
        User.findOneAndUpdate({ $or: [{ phone }, { email }] }, { pass: hash })
      )
      .then((dbUser) => {
        signingIn(dbUser._doc, res);
      });
  } else {
    if (dbOtp.attempt > 2) {
      OTP.findOneAndDelete({ id: phone }).then(() => {
        res.status(403).json({ code: 403, message: "too many attempts" });
      });
    } else {
      dbOtp.updateOne({ attempt: dbOtp.attempt + 1 }).then(() => {
        res.status(400).json({
          code: 400,
          message: "wrong code",
          attempt: dbOtp.attempt + 1,
        });
      });
    }
  }
});

app.get(
  "/api/getAllLedgers",
  passport.authenticate("userPrivate"),
  (req, res) => {
    PaymentLedger.find({ user: req.user._id })
      .then((dbRes) => {
        res.json({ code: "ok", ledgers: dbRes });
      })
      .catch((err) => {
        console.log(err);
        res.status(500).json({ code: 500, message: "datebase error" });
      });
  }
);
app.get(
  "/api/getSingleLedger",
  passport.authenticate("userPrivate"),
  (req, res) => {
    if (req.query._id) {
      PaymentLedger.aggregate([
        { $match: { _id: ObjectId(req.query._id) } },
        {
          $lookup: {
            from: "books",
            as: "bookings",
            localField: "product",
            foreignField: "_id",
          },
        },
        {
          $lookup: {
            from: "chats",
            as: "chats",
            localField: "product",
            foreignField: "_id",
          },
        },
        {
          $lookup: {
            from: "teleconsults",
            as: "tele",
            localField: "product",
            foreignField: "_id",
          },
        },
        {
          $lookup: {
            from: "orders",
            as: "orders",
            localField: "product",
            foreignField: "_id",
          },
        },
        {
          $lookup: {
            from: "diagnosticbookings",
            as: "diagnostics",
            localField: "product",
            foreignField: "_id",
          },
        },
        {
          $set: {
            product: {
              $switch: {
                branches: [
                  {
                    case: {
                      $eq: [
                        {
                          $size: "$bookings",
                        },
                        1,
                      ],
                    },
                    then: {
                      $first: "$bookings",
                    },
                  },
                  {
                    case: {
                      $eq: [
                        {
                          $size: "$orders",
                        },
                        1,
                      ],
                    },
                    then: {
                      $first: "$orders",
                    },
                  },
                  {
                    case: {
                      $eq: [
                        {
                          $size: "$chats",
                        },
                        1,
                      ],
                    },
                    then: {
                      $first: "$chats",
                    },
                  },
                  {
                    case: {
                      $eq: [
                        {
                          $size: "$tele",
                        },
                        1,
                      ],
                    },
                    then: {
                      $first: "$tele",
                    },
                  },
                  {
                    case: {
                      $eq: [
                        {
                          $size: "$diagnostics",
                        },
                        1,
                      ],
                    },
                    then: {
                      $first: "$diagnostics",
                    },
                  },
                ],
                default: null,
              },
            },
          },
        },
        {
          $unset: ["bookings", "chats", "tele", "orders", "diagnostics"],
        },
      ])
        .then((dbRes) => {
          if (dbRes.length) {
            res.json({ code: "ok", ledger: dbRes[0] });
          } else {
            res
              .status(404)
              .json({ code: 404, message: "ledger does not exist" });
          }
        })
        .catch((err) => {
          console.log(err);
          res.status(500).json({ code: 500, message: "database error" });
        });
    } else {
      res.status(400).json({
        code: 400,
        message: "ledger _id is required",
      });
    }
  }
);
