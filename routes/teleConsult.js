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
      res.json({ code: "ok", ...dbRes[0] });
    })
    .catch((err) => {
      console.log(err);
      res.status(500).json({ code: 500, message: "database error", err });
    });
});
app.post(
  "/api/bookTeleConsult",
  passport.authenticate("userPrivate"),
  (req, res) => {
    const { date, vendor, token, charge, sessionLength } = req.body;
    if (token && date && vendor && sessionLength) {
      new TeleConsult({
        token,
        date,
        vendor,
        user: req.user._id,
        charge,
        sessionLength,
      })
        .save()
        .then((dbRes) => {
          if (dbRes) {
            res.json({ code: "ok", bookingInfo: dbRes });
            notify(
              dbRes.vendor,
              JSON.stringify({
                title: "Tele Consult!",
                body: "Someone booked a tele consult session.",
              }),
              "Vendor"
            );
          } else {
            res.status(500).json({ code: 500, message: "database error" });
          }
        })
        .catch((err) => {
          console.log(err);
          res.status(500).json({ code: 500, message: "database error", err });
        });
    } else {
      res.status(500).json({
        code: 500,
        message: "missing fields",
        requiredFields: "token, date, vendor, sessionLength",
        fieldsFound: req.body,
        success: false,
      });
    }
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
          res.json({
            code: "ok",
            message: "booking updated",
            bookingInfo: dbRes,
          });
        } else {
          res
            .status(404)
            .json({ code: 404, message: "booking does not exist" });
        }
      })
      .catch((err) => {
        console.log(err);
        res.status(500).json({ code: 500, message: "database error" });
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
          res.json({
            code: "ok",
            message: "booking has been cancelled.",
            bookingInfo: dbRes,
          });
          notify(
            dbRes.vendor,
            JSON.stringify({
              title: "Tele Consult Booking!",
              body: "A tele consult booking has been cancelled.",
            }),
            "Vendor"
          );
        } else {
          res
            .status(404)
            .json({ code: 404, message: "booking does not exist" });
        }
      })
      .catch((err) => {
        console.log(err);
        res.status(500).json({ code: 500, message: "database error" });
      });
  }
);

app.post(
  "/api/createLedgerForTeleConsultUser",
  passport.authenticate("userPrivate"),
  (req, res) => {
    const { amount, paymentMethod, teleConsult, transactionId } = req.body;
    if (transactionId && amount && teleConsult) {
      Promise.all([
        razorpay.payments.fetch(transactionId),
        TeleConsult.findOne({ _id: teleConsult }),
      ])
        .then(([razorRes, teleConsult]) => {
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
                    { paid: true },
                    { new: true }
                  );
                } else {
                  return null;
                }
              })
              .then((update) => {
                if (update) {
                  res.json({
                    code: "ok",
                    message: "payment successful",
                    bookingInfo: update,
                  });
                  notify(
                    update.vendor,
                    JSON.stringify({
                      title: "Payment recieved!",
                      body: "Payment recieved for tele consult appointment.",
                    }),
                    "Vendor"
                  );
                } else {
                  res
                    .status(400)
                    .json({ code: 400, message: "database error" });
                }
              })
              .catch((err) => {
                if (err.code === 11000) {
                  res.status(429).json({
                    code: 429,
                    message: "transaction id found in the database",
                  });
                } else {
                  console.log(err);
                  res
                    .status(500)
                    .json({ code: 500, message: "something went wrong" });
                }
              });
          } else {
            res.status(400).json({
              code: 400,
              message: "payment or teleConsult does not exist",
            });
          }
        })
        .catch((err) => {
          if (err.statusCode === 400) {
            res
              .status(404)
              .json({ code: 404, message: "payment does not exist" });
          } else {
            console.log(err);
            res.status(500).json({ code: 500, message: "database error" });
          }
        });
    } else {
      res.status(400).json({
        code: 400,
        message: "missing fields",
        requiredFields: "transactionId, amount, teleConsult",
        fieldsFound: req.body,
        success: false,
      });
    }
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
        res.json({ code: "ok", ...dbRes[0] });
      })
      .catch((err) => {
        console.log(err);
        res.status(500).json({ code: 500, message: "something went wrong" });
      });
  }
);

app.get(
  "/api/getSingleTeleConsultUser",
  passport.authenticate("userPrivate"),
  (req, res) => {
    if (!req.query._id) {
      res.status(400).json({
        code: 400,
        message: "tele consult _id is required in query parameter.",
      });
      return;
    }
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
          res.json({ code: "ok", teleConsult: dbRes[0] });
        } else {
          res
            .status(404)
            .json({ code: 404, message: "chat could not be found" });
        }
      })
      .catch((err) => {
        console.log(err);
        res.status(500).json({ code: 500, message: "database error" });
      });
  }
);
