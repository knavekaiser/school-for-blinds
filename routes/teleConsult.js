app.get("/api/findVendorsForTeleConsult", (req, res) => {
  const { sort, order, page, perPage } = req.query;
  const sortOrder = {
    [sort || "rating"]: order === "asc" ? 1 : -1,
  };
  Vendor.aggregate([
    {
      $match: {
        "teleConsult.available": true,
      },
    },
    {
      $lookup: {
        from: "teleconsults",
        as: "teleBookings",
        pipeline: [{ $match: { completed: false } }],
      },
    },
    {
      $set: {
        "teleConsult.days": {
          $map: {
            input: "$teleConsult.days",
            as: "day",
            in: {
              _id: "$$day._id",
              day: "$$day.day",
              hours: "$$day.hours",
              bookings: {
                $filter: {
                  input: "$teleBookings",
                  as: "book",
                  cond: {
                    $and: [
                      {
                        $eq: ["$$book.vendor", "$_id"],
                      },
                      {
                        $eq: ["$$book.completed", false],
                      },
                      {
                        $eq: [
                          {
                            $dayOfWeek: "$$book.date",
                          },
                          "$$day.day",
                        ],
                      },
                    ],
                  },
                },
              },
            },
          },
        },
        price: "$teleConsult.charge",
      },
    },
    {
      $project: {
        pass: 0,
        teleBookings: 0,
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
    .then((dbRes) => {
      res.json(dbRes[0]);
    })
    .catch((err) => {
      console.log(err);
      res.status(500).json({ message: "something went wrong" });
    });
});
app.post(
  "/api/bookTeleConsult",
  passport.authenticate("userPrivate"),
  (req, res) => {
    const { date, vendor, token, user, charge, sessionLength } = req.body;
    new TeleConsult({
      token,
      date,
      vendor,
      user,
      charge,
      sessionLength,
    })
      .save()
      .then((dbRes) => {
        if (dbRes) {
          res.json(dbRes);
          notify(
            dbRes.vendor,
            JSON.stringify({
              title: "Tele Consult!",
              body: "Someone booked a tele consult session.",
            }),
            "Vendor"
          );
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
  "/api/updateTeleConsultUser",
  passport.authenticate("userPrivate"),
  (req, res) => {
    TeleConsult.findOneAndUpdate(
      { _id: req.body._id, user: req.user._id },
      { ...req.body }
    )
      .then((dbRes) => {
        if (dbRes) {
          res.json({ message: "booking updated" });
        } else {
          res.json({ message: "bad request" });
        }
      })
      .catch((err) => {
        console.log(err);
        res.status(500).json({ message: "something went wrong" });
      });
  }
);

app.patch(
  "/api/cancelTeleConsultUser",
  passport.authenticate("userPrivate"),
  (req, res) => {
    TeleConsult.findOneAndUpdate(
      { _id: req.body._id, user: req.user._id, completed: false },
      { cancelled: true }
    )
      .then((dbRes) => {
        if (dbRes) {
          res.json({ message: "booking has been cancelled." });
          notify(
            dbRes.vendor,
            JSON.stringify({
              title: "Tele Consult Booking!",
              body: "A tele consult booking has been cancelled.",
            }),
            "Vendor"
          );
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

app.post(
  "/api/createLedgerForTeleConsultUser",
  passport.authenticate("userPrivate"),
  (req, res) => {
    const { amount, paymentMethod, teleConsult, transactionId } = req.body;
    Promise.all([
      razorpay.payments.fetch(transactionId),
      TeleConsult.findOne({ _id: teleConsult }),
    ]).then(([razorRes, teleConsult]) => {
      if (razorRes && teleConsult) {
        new PaymentLedger({
          type: "collection",
          user: req.user._id,
          amount,
          paymentMethod,
          note: "payment for teleConsult", // specific for this route
          transactionId,
          product: teleConsult._id,
        })
          .save()
          .then((dbRes) => {
            if (dbRes) {
              return TeleConsult.findOneAndUpdate(
                { _id: teleConsult },
                { paid: true }
              );
            } else {
              return null;
            }
          })
          .then((update) => {
            if (update) {
              res.json({ message: "payment successful" });
              notify(
                update.vendor,
                JSON.stringify({
                  title: "Payment recieved!",
                  body: "Payment recieved for tele consult appointment.",
                }),
                "Vendor"
              );
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
        res.status(400).json({ message: "bad request" });
      }
    });
  }
);

app.get(
  "/api/getAllTeleConsultsUser",
  passport.authenticate("userPrivate"),
  (req, res) => {
    const {
      dateFrom,
      dateTo,
      completed,
      cancelled,
      paid,
      page,
      perPage,
    } = req.query;
    const query = {
      user: ObjectId(req.user._id),
      ...(dateFrom && { date: { $gte: new Date(dateFrom) } }),
      ...(dateTo && { date: { $lte: new Date(dateTo) } }),
      ...(dateFrom &&
        dateTo && {
          date: {
            $gte: new Date(dateFrom),
            $lte: new Date(dateTo),
          },
        }),
      ...(completed && { completed: completed === "true" }),
      ...(paid && { paid: paid === "true" }),
      ...(cancelled && { cancelled: cancelled === "true" }),
    };
    TeleConsult.aggregate([
      { $match: query },
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
          "vendor.bookings": 0,
          "vendor.medicalRecords": 0,
          "vendor.teleConsults": 0,
          "vendor.chat": 0,
        },
      },
      {
        $facet: {
          teleConsults: [
            { $skip: +perPage * (+(page || 1) - 1) },
            { $limit: +(perPage || 20) },
          ],
          pageInfo: [{ $group: { _id: null, count: { $sum: 1 } } }],
        },
      },
    ])
      .then((dbRes) => {
        res.json(dbRes[0]);
      })
      .catch((err) => {
        console.log(err);
        res.status(500).json({ message: "something went wrong" });
      });
  }
);

app.get(
  "/api/getSingleTeleConsultUser",
  passport.authenticate("userPrivate"),
  (req, res) => {
    const query = {
      user: ObjectId(req.user._id),
      _id: ObjectId(req.query._id),
    };
    TeleConsult.aggregate([
      { $match: query },
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
          "vendor.bookings": 0,
          "vendor.medicalRecords": 0,
          "vendor.teleConsults": 0,
          "vendor.chat": 0,
        },
      },
    ])
      .then((dbRes) => {
        if (dbRes.length) {
          res.json(dbRes[0]);
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
