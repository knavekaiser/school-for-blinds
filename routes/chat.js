app.get("/api/findVendorsForChat", (req, res) => {
  const { sort, order, page, perPage } = req.query;
  const sortOrder = {
    [sort || "rating"]: order === "asc" ? 1 : -1,
  };
  Vendor.aggregate([
    {
      $match: {
        "chat.available": true,
      },
    },
    {
      $lookup: {
        from: "chats",
        as: "chatBookings",
        pipeline: [{ $match: { completed: false } }],
      },
    },
    {
      $set: {
        "chat.days": {
          $map: {
            input: "$chat.days",
            as: "day",
            in: {
              _id: "$$day._id",
              day: "$$day.day",
              hours: "$$day.hours",
              bookings: {
                $filter: {
                  input: "$chatBookings",
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
        price: "$chat.charge",
      },
    },
    {
      $project: {
        pass: 0,
        chatBookings: 0,
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
      res.status(500).json({ code: 500, message: "database error" });
    });
});
app.post("/api/bookChat", passport.authenticate("userPrivate"), (req, res) => {
  const { date, vendor, token, charge, sessionLength } = req.body;
  if (token && date && vendor && sessionLength) {
    new Chat({
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
          res.json({
            code: "ok",
            message: "chat successfully booked",
            bookingInfo: dbRes,
          });
          notify(
            dbRes.vendor,
            JSON.stringify({
              title: "Chat!",
              body: "Someone booked a chat session.",
            }),
            "Vendor"
          );
        } else {
          res.status(400).json({ code: 400, message: "database error" });
        }
      })
      .catch((err) => {
        console.log(err);
        res.status(500).json({ code: 500, message: "database error" });
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
});

app.patch(
  "/api/updateChatUser",
  passport.authenticate("userPrivate"),
  (req, res) => {
    Chat.findOneAndUpdate(
      { _id: req.body._id, user: req.user._id },
      { ...req.body },
      { new: true }
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
  "/api/cancelChatUser",
  passport.authenticate("userPrivate"),
  (req, res) => {
    Chat.findOneAndUpdate(
      { _id: req.body._id, user: req.user._id, completed: false },
      { cancelled: true },
      { new: true }
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
              title: "Chat Booking!",
              body: "A chat booking has been cancelled.",
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
  "/api/createLedgerForChatUser",
  passport.authenticate("userPrivate"),
  (req, res) => {
    const { amount, paymentMethod, chat, transactionId } = req.body;
    if (transactionId && amount && chat) {
      Promise.all([
        razorpay.payments.fetch(transactionId),
        Chat.findOne({ _id: chat }),
      ])
        .then(([razorRes, chat]) => {
          if (razorRes && chat) {
            new PaymentLedger({
              type: "collection",
              user: req.user._id,
              amount,
              paymentMethod,
              note: "payment for chat", // specific for this route
              transactionId,
              product: chat._id,
            })
              .save()
              .then((dbRes) => {
                if (dbRes) {
                  return Chat.findOneAndUpdate(
                    { _id: chat },
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
                      body: "Payment recieved for chat appointment.",
                    }),
                    "Vendor"
                  );
                } else {
                  res
                    .status(500)
                    .json({ code: 500, message: "database error" });
                }
              })
              .catch((err) => {
                if (err.code === 11000) {
                  res.status(429).json({
                    code: 429,
                    message: "transaction id found in the database",
                    success: false,
                  });
                } else {
                  console.log(err);
                  res
                    .status(500)
                    .json({ code: 500, message: "something went wrong" });
                }
              });
          } else {
            res.status(404).json({
              code: 404,
              message: "payment or chat could not be found.",
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
        requiredFields: "transactionId, amount, booking",
        fieldsFound: req.body,
        success: false,
      });
    }
  }
);

app.get(
  "/api/getAllChatsUser",
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
    Chat.aggregate([
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
          chats: [
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
  "/api/getSingleChatUser",
  passport.authenticate("userPrivate"),
  (req, res) => {
    const query = {
      user: ObjectId(req.user._id),
      _id: ObjectId(req.query._id),
    };
    if (!req.query._id) {
      res.status(400).json({
        code: 400,
        message: "chat _id is required in query parameter.",
      });
      return;
    }
    Chat.aggregate([
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
          res.json({ code: "ok", chat: dbRes[0] });
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
