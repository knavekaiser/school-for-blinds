app.post(
  "/api/addDiagnostic",
  passport.authenticate("vendorPrivate"),
  (req, res) => {
    new Diagnostic({
      ...req.body,
      vendor: req.user._id,
    })
      .save()
      .then((dbRes) => {
        res.json({ message: "diagnostic added" });
      })
      .catch((err) => {
        console.log(err);
        res.status(500).json({ message: "something went wrong" });
      });
  }
);
app.patch(
  "/api/editDiagnostic",
  passport.authenticate("vendorPrivate"),
  (req, res) => {
    Diagnostic.findOneAndUpdate(
      { _id: req.body._id, vendor: req.user._id },
      { ...req.body }
    )
      .then((dbRes) => {
        if (dbRes) {
          res.json({ message: "diagnostic updated" });
        } else {
          res.status(400).json({ message: "bad request" });
        }
      })
      .catch((err) => {
        console.log(err);
        res.status(500).json({ message: "something went wrong" });
      });
  }
);
app.get("/api/findDiagnostics", (req, res) => {
  const {
    q,
    page,
    perPage,
    userLocation,
    sort,
    order,
    maxDistance,
  } = req.query;
  const query = {
    ...(q && {
      $or: [
        { name: { $regex: new RegExp(q, "gi") } },
        { dscr: { $regex: new RegExp(q, "gi") } },
      ],
    }),
  };
  const sortOrder = {
    ...(sort && { [sort || "popularity"]: order === "asc" ? 1 : -1 }),
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
              key: "address.location",
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
        popularity: { $size: { $ifNull: ["$bookings", []] } },
        price: 1,
        discount: 1,
        keywords: 1,
      },
    },
    { $sort: sortOrder },
    {
      $facet: {
        diagnostics: [
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
  const { _id, userLocation } = req.query;
  Diagnostic.aggregate([
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
            },
          },
        ]
      : []),
    {
      $match: {
        _id: new ObjectId(_id),
      },
    },
    {
      $lookup: {
        from: "vendors",
        localField: "vendor",
        foreignField: "_id",
        as: "vendor",
      },
    },
    {
      $set: {
        vendor: {
          $first: "$vendor",
        },
      },
    },
    {
      $project: {
        "vendor.pass": 0,
        "vendor.__v": 0,
        __v: 0,
      },
    },
  ])
    .then((diagnostic) => {
      res.json(diagnostic[0]);
    })
    .catch((err) => {
      console.log(err);
      res.status(500).json({ message: "something went wrong" });
    });
});
app.post(
  "/api/bookDiagnostic",
  passport.authenticate("userPrivate"),
  (req, res) => {
    new DiagnosticBooking({ ...req.body })
      .save()
      .then((dbRes) => {
        res.json({ message: "diagnostic successfully booked" });
        Vendor.findOne({ _id: req.body.vendor }, "assistants")
          .populate("assistants")
          .then(({ assistants }) => {
            if (assistants.length) {
              notify(
                assistants[0].profile,
                JSON.stringify({
                  title: "Diagnostic booked",
                  body: `someone booked a test, be at the location at ${new Date(
                    dbRes.timeToCollectSample
                  )} to collect sample.`,
                })
              );
            }
          });
      })
      .catch((err) => {
        console.log(err);
        res.status(500).json({ message: "something went wrong" });
      });
  }
);

app.patch(
  "/api/editDiagnosticBookingUser",
  passport.authenticate("userPrivate"),
  (req, res) => {
    DiagnosticBooking.findOneAndUpdate(
      { _id: req.body._id, customer: req.user._id },
      { ...req.body }
    )
      .then((dbRes) => {
        if (dbRes) {
          res.json({ message: "booking updated" });
        } else {
          res.status(400).json({ message: "bad request" });
        }
      })
      .catch((err) => {
        console.log(err);
        res.status(500).json({ message: "something went wrong" });
      });
  }
);
app.patch(
  "/api/editDiagnosticBookingAsst",
  passport.authenticate("asstPrivate"),
  (req, res) => {
    DiagnosticBooking.findOneAndUpdate(
      { _id: req.body._id, vendor: req.user.vendor },
      { ...req.body }
    )
      .then((dbRes) => {
        if (dbRes) {
          res.json({ message: "booking updated" });
        } else {
          res.status(400).json({ message: "bad request" });
        }
      })
      .catch((err) => {
        console.log(err);
        res.status(500).json({ message: "something went wrong" });
      });
  }
);
app.patch(
  "/api/editDiagnosticBookingVendor",
  passport.authenticate("vendorPrivate"),
  (req, res) => {
    DiagnosticBooking.findOneAndUpdate(
      { _id: req.body._id, vendor: req.user.vendor },
      { ...req.body }
    )
      .then((dbRes) => {
        if (dbRes) {
          res.json({ message: "booking updated" });
        } else {
          res.status(400).json({ message: "bad request" });
        }
      })
      .catch((err) => {
        console.log(err);
        res.status(500).json({ message: "something went wrong" });
      });
  }
);

app.patch(
  "/api/diagnosticCompletedAsst",
  passport.authenticate("asstPrivate"),
  (req, res) => {
    DiagnosticBooking.findOneAndUpdate(
      { _id: req.body._id, vendor: req.user.vendor, delivered: false },
      { delivered: true }
    )
      .then((dbRes) => {
        if (dbRes) {
          res.json({ message: "test result delivered" });
          notify(
            dbRes.customer,
            JSON.stringify({
              title: "Test result has been delivered",
              body: "Click here to review your experience.",
            })
          );
          dbRes.tests.forEach(async (diagnostic) => {
            console.log(diagnostic);
            await new Sale({ product: diagnostic._id, qty: 1 }).save();
          });
        } else {
          res.status(400).json({ message: "something went wrong" });
        }
      })
      .catch((err) => {
        console.log(err);
        res.status(500).json({ message: "something went wrong" });
      });
  }
);
app.patch(
  "/api/diagnosticCompletedVendor",
  passport.authenticate("vendorPrivate"),
  (req, res) => {
    DiagnosticBooking.findOneAndUpdate(
      { _id: req.body._id, vendor: req.user._id, delivered: false },
      { delivered: true }
    )
      .then((dbRes) => {
        if (dbRes) {
          res.json({ message: "test result delivered" });
          notify(
            dbRes.customer,
            JSON.stringify({
              title: "Test result has been delivered",
              body: "Click here to review your experience.",
            })
          );
          dbRes.tests.forEach(async (diagnostic) => {
            console.log(diagnostic);
            await new Sale({ product: diagnostic._id, qty: 1 }).save();
          });
        } else {
          res.status(400).json({ message: "something went wrong" });
        }
      })
      .catch((err) => {
        console.log(err);
        res.status(500).json({ message: "something went wrong" });
      });
  }
);

app.post(
  "/api/payForDiagnostic",
  passport.authenticate("userPrivate"),
  (req, res) => {
    const { amount, paymentMethod, diagnostic } = req.body;
    // users give all their payment info in the request body.
    // payment api gets called with those detail.
    // return status code 200 and a transaction id in case
    // of a successful transaction
    if (200) {
      new PaymentLedger({
        type: "collection",
        user: req.user._id,
        amount,
        paymentMethod,
        note: "payment for diagnostics", // specific for this route
        transactionId: "415425125422105120", // from payment gateway
        product: diagnostic,
      })
        .save()
        .then((dbRes) => {
          if (dbRes) {
            return DiagnosticBooking.findOneAndUpdate(
              { _id: diagnostic },
              { paid: true }
            );
          } else {
            return null;
          }
        })
        .then((update) => {
          if (update) {
            res.json({ message: "payment successful" });
          } else {
            res.status(400).json({ message: "something went wrong" });
          }
        })
        .catch((err) => {
          if (err.code === 11000) {
            res.status(400).json({
              message: "transaction id found in the database",
              code: err.code,
              field: Object.keys(err.keyValue)[0],
            });
          } else {
            console.log(err);
            res.status(500).json({ message: "something went wrong" });
          }
        });
    } else {
      // send different error based on the payment gateway error
      res.status(500).json({ message: "something went wrong" });
    }
  }
);
