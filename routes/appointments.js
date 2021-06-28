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
    ...(type ? { type } : { $or: [{ type: "Doctor" }, { type: "Clinic" }] }),
    ...(gender && { gender }),
    ...(speciality && { speciality: new RegExp(speciality, "gi") }),
    ...(education && { education: new RegExp(education, "gi") }),
    ...(age && { age }),
    ...(onlineBooking && { onlineBooking: onlineBooking === "true" }),
  };
  const sortOrder = {
    ...(sort && { [sort || "popularity"]: order === "asc" ? 1 : -1 }),
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
      $lookup: {
        from: "books",
        as: "allBookings",
        pipeline: [],
      },
    },
    {
      $set: {
        chambers: {
          $map: {
            input: "$chambers",
            as: "chamber",
            in: {
              _id: "$$chamber._id",
              open: "$$chamber.open",
              charge: "$$chamber.charge",
              sessionLength: "$$chamber.sessionLength",
              street: "$$chamber.street",
              city: "$$chamber.city",
              state: "$$chamber.state",
              zip: "$$chamber.zip",
              location: "$$chamber.location",
              visitingDays: {
                $map: {
                  input: "$$chamber.visitingDays",
                  as: "visitingDay",
                  in: {
                    _id: "$$visitingDay._id",
                    day: "$$visitingDay.day",
                    hours: "$$visitingDay.hours",
                    bookings: {
                      $filter: {
                        input: "$allBookings",
                        as: "book",
                        cond: {
                          $and: [
                            {
                              $eq: ["$$book.vendor", "$_id"],
                            },
                            {
                              $eq: ["$$book.chamber", "$$chamber._id"],
                            },
                            {
                              $eq: ["$$book.completed", false],
                            },
                            {
                              $eq: [
                                {
                                  $dayOfWeek: "$$book.date",
                                },
                                "$$visitingDay.day",
                              ],
                            },
                          ],
                        },
                      },
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
      $unset: "allBookings",
    },
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
        chambers: 1, //{ $size: { $ifNull: ["$chambers", []] } },
        popularity: { $size: { $ifNull: ["$bookings", []] } },
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
  Vendor.aggregate(pipeline)
    .then((data) => {
      res.json(data[0]);
    })
    .catch((err) => {
      console.log(err);
      res.status(500).json({ message: "something went wrong" });
    });
});
app.get("/api/getVendorDetails", (req, res) => {
  const { _id, userLocation } = req.query;
  if (!ObjectId.isValid(_id)) {
    res.status(400).json({ message: "wrong _id" });
    return;
  }
  Vendor.aggregate([
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
            },
          },
        ]
      : []),
    { $match: { _id: ObjectId(_id) } },
    {
      $lookup: {
        from: "books",
        as: "allBookings",
        pipeline: [],
      },
    },
    {
      $set: {
        chambers: {
          $map: {
            input: "$chambers",
            as: "chamber",
            in: {
              _id: "$$chamber._id",
              open: "$$chamber.open",
              charge: "$$chamber.charge",
              sessionLength: "$$chamber.sessionLength",
              street: "$$chamber.street",
              city: "$$chamber.city",
              state: "$$chamber.state",
              zip: "$$chamber.zip",
              location: "$$chamber.location",
              visitingDays: {
                $map: {
                  input: "$$chamber.visitingDays",
                  as: "visitingDay",
                  in: {
                    _id: "$$visitingDay._id",
                    day: "$$visitingDay.day",
                    hours: "$$visitingDay.hours",
                    bookings: {
                      $filter: {
                        input: "$allBookings",
                        as: "book",
                        cond: {
                          $and: [
                            {
                              $eq: ["$$book.vendor", "$_id"],
                            },
                            {
                              $eq: ["$$book.chamber", "$$chamber._id"],
                            },
                            {
                              $eq: ["$$book.completed", false],
                            },
                            {
                              $eq: [
                                {
                                  $dayOfWeek: "$$book.date",
                                },
                                "$$visitingDay.day",
                              ],
                            },
                          ],
                        },
                      },
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
      $unset: "allBookings",
    },
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
        chambers: 1, //{ $size: { $ifNull: ["$chambers", []] } },
        popularity: { $size: { $ifNull: ["$bookings", []] } },
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
  ]).then((data) => {
    res.json(data[0]);
  });
});
app.post(
  "/api/bookAnAppointment",
  passport.authenticate("userPrivate"),
  (req, res) => {
    const { vendor, date, chamber, sessionLength, charge } = req.body;
    let bookingInfo = {};
    new Book({
      vendor,
      user: req.user._id,
      date,
      chamber,
      sessionLength,
      charge,
    })
      .save()
      .then((dbRes) => {
        bookingInfo = dbRes;
        return Promise.all([
          Vendor.updateBooking(vendor),
          User.updateAppointments(req.user._id),
        ]);
      })
      .then(() => {
        res.json({ message: "successfully booked", bookingInfo });
        notify(
          bookingInfo.vendor,
          JSON.stringify({
            title: "appointment booked",
            body: `an appointment has been booked for ${bookingInfo.date}`,
          }),
          "Vendor"
        );
      })
      .catch((err) => {
        console.log(err);
        res.status(500).json({ message: "something went wrong" });
      });
  }
);

app.post(
  "/api/createLedgerForAppointmentUser",
  passport.authenticate("userPrivate"),
  (req, res) => {
    const { amount, paymentMethod, book, transactionId } = req.body;
    Promise.all([
      razorpay.payments.fetch(transactionId),
      Book.findOne({ _id: book }),
    ]).then(([razorRes, book]) => {
      if (razorRes && book._id) {
        new PaymentLedger({
          type: "collection",
          user: req.user._id,
          amount,
          paymentMethod,
          note: "payment for appointment", // specific for this route
          transactionId,
          product: book._id,
        })
          .save()
          .then((dbRes) => {
            if (dbRes) {
              return Book.findOneAndUpdate({ _id: book }, { paid: true });
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
                  body: "Payment recieved for appointment.",
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

app.patch(
  "/api/updateAppointment",
  passport.authenticate("userPrivate"),
  (req, res) => {
    Book.findOneAndUpdate(
      { _id: req.body._id, user: req.user._id },
      { ...req.body }
    )
      .then((dbRes) => {
        if (dbRes) {
          res.json({ message: "appointment updated" });
          if (
            req.body.date &&
            new Date(dbRes.date).getTime() !== new Date(req.body.date).getTime()
          ) {
            notify(
              dbRes.vendor,
              JSON.stringify({
                title: "appointment rescheduled!",
                body: `An appointment has been rescheduled for ${new Date(
                  req.body.date
                )}`,
              }),
              "Vendor"
            );
          }
        } else {
          res.status(400).json({ message: "bad reqeust" });
        }
      })
      .catch((err) => {
        console.log(err);
        res.status(500).json({ message: "something went wrong" });
      });
  }
);

app.patch(
  "/api/cancelAnAppointmentUser",
  passport.authenticate("userPrivate"),
  (req, res) => {
    Book.findOneAndUpdate(
      { _id: req.body._id, user: req.user._id, completed: false },
      { cancelled: true }
    )
      .then((appointment) => {
        if (appointment) {
          res.json({ message: "appointment has been cancelled" });
          notify(
            appointment.vendor,
            JSON.stringify({
              title: "appointment cancelled",
              body: "an appointment has been cancelled",
            }),
            "Vendor"
          );
        } else {
          res.status(400).json({ message: "appointment could not be found" });
        }
      })
      .catch((err) => {
        res.status(500).json({ message: "something went wrong" });
      });
  }
);
app.get("/api/getDelay", passport.authenticate("userPrivate"), (req, res) => {
  const { vendor, chamber, appointmentTime } = req.query;
  if (!ObjectId.isValid(vendor)) {
    res.status(400).json({ message: "wrong or no id" });
    return;
  }
  Book.aggregate([
    {
      $match: {
        approved: true,
        vendor: ObjectId(vendor),
        chamber: chamber,
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

app.post(
  "/api/giveFeedbackToVendor",
  passport.authenticate("userPrivate"),
  (req, res) => {
    const { vendor, rating, feedback } = req.body;
    const user = req.user._id;
    Vendor.addFeedback({ vendor, rating, user, feedback })
      .then((dbRes) => {
        res.json({ message: "feedback posted" });
      })
      .catch((err) => {
        if (err === "forbidden") {
          res.status(400).json({
            message: "you didn't complete any session with this doctor",
          });
        } else {
          console.log(err);
          res.status(500).json({ message: "something went wrong" });
        }
      });
  }
);
app.patch(
  "/api/editFeedbackToVendor",
  passport.authenticate("userPrivate"),
  (req, res) => {
    const { vendor, rating, feedback } = req.body;
    const user = req.user._id;
    Vendor.addFeedback({ vendor, rating, user, feedback })
      .then((dbRes) => {
        res.json({ message: "feedback posted" });
      })
      .catch((err) => {
        console.log(err);
        res.status(500).json({ message: "something went wrong" });
      });
  }
);
app.delete(
  "/api/deleteFeedbackToVendor",
  passport.authenticate("userPrivate"),
  (req, res) => {
    const { vendor } = req.body;
    const user = req.user._id;
    Vendor.deleteFeedback({ vendor, user })
      .then((dbRes) => {
        res.json({ message: "feedback deleted" });
      })
      .catch((err) => {
        console.log(err);
        res.status(500).json({ message: "something went wrong" });
      });
  }
);

app.post(
  "/api/feedbackToAppointment",
  passport.authenticate("userPrivate"),
  (req, res) => {
    const { _id, rating, feedback } = req.body;
    if ((_id, rating, feedback)) {
      Book.findOneAndUpdate(
        { _id: req.body._id, user: req.user._id, completed: true },
        {
          userReview: {
            rating: req.body.rating,
            feedback: req.body.feedback,
          },
        }
      )
        .then((dbRes) => {
          if (dbRes) {
            res.json({ message: "feedback posted" });
          } else {
            res.status(400).json({ message: "bad request" });
          }
        })
        .catch((err) => {
          console.log(err);
          res.status(500).json({ message: "something went wrong" });
        });
    } else {
      res.status(400).json({ message: "incomplete request" });
    }
  }
);
app.delete(
  "/api/feedbackToAppointment",
  passport.authenticate("userPrivate"),
  (req, res) => {
    Book.findOneAndUpdate(
      { _id: req.body._id, user: req.user._id, completed: true },
      { userReview: null }
    )
      .then((dbRes) => {
        if (dbRes) {
          res.json({ message: "feedback deleted" });
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
