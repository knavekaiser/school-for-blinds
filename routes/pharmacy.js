app.get("/api/findProducts", (req, res) => {
  const {
    name,
    brand,
    price,
    sort,
    order,
    perPage,
    page,
    category,
  } = req.query;
  const sortOrder = {
    [sort || "popularity"]: order === "asc" ? 1 : -1,
  };
  const query = {
    ...(name && { name: new RegExp(name, "gi") }),
    ...(brand && { brand: new RegExp(brand, "gi") }),
    ...(price && {
      price: { $gt: +price.split("-")[0], $lt: +price.split("-")[1] },
    }),
    ...(category && { category }),
  };
  Product.aggregate([
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
        popularity: {
          $reduce: {
            input: "$sales",
            initialValue: {
              total: 0,
            },
            in: {
              total: {
                $add: ["$$value.total", "$$this.qty"],
              },
            },
          },
        },
      },
    },
    {
      $set: {
        popularity: "$popularity.total",
      },
    },
    {
      $project: {
        "vendor.pass": 0,
        "vendor.chambers": 0,
        "vendor.chat": 0,
        "vendor.teleConsult": 0,
        "vendor.assistants": 0,
        "vendor.__v": 0,
        __v: 0,
      },
    },
    { $sort: sortOrder },
    {
      $facet: {
        products: [
          { $skip: +perPage * (+(page || 1) - 1) },
          { $limit: +(perPage || 20) },
        ],
        pageInfo: [{ $group: { _id: null, count: { $sum: 1 } } }],
      },
    },
  ])
    .then((products) => {
      res.json(products[0]);
    })
    .catch((err) => {
      console.log(err);
      res.status(500).json({ message: "something went wrong" });
    });
});
app.get("/api/checkProductAvailability", (req, res) => {
  Product.findOne({ _id: req.query._id })
    .then((product) => {
      if (product) {
        res.json({ available: product.available });
      } else {
        res.json({ available: 0 });
      }
    })
    .catch((err) => {
      res.status(500).json({ message: "something went wrong" });
    });
});
app.post(
  "/api/placeOrder",
  passport.authenticate("userPrivate"),
  (req, res) => {
    const {
      products,
      vendor,
      total,
      discount,
      prescriptions,
      address,
      shop,
    } = req.body;
    if (products && vendor && total && shop) {
      Product.find({
        $or: req.body.products.map((pr) => ({ _id: pr.product })),
      })
        .then((fullProducts) => {
          const order = new Order({
            ...req.body,
            products: fullProducts.map((prod) => {
              return {
                ...prod._doc,
                qty: products.filter(
                  (pr) => pr.product === prod._id.toString()
                )[0].qty,
              };
            }),
            customer: { ...req.user._doc },
          });
          return order.save();
        })
        .then((order) => {
          if (order) {
            res.json("order has been placed");
            order.products.forEach(async (item) => {
              await Product.findOneAndUpdate(
                { _id: item._id },
                { $inc: { available: -Math.abs(item.qty) } }
              );
            });
          } else {
            res.status(500).json({ message: "something went wrong" });
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
app.get(
  "/api/getAllOrders",
  passport.authenticate("userPrivate"),
  (req, res) => {
    Order.find({ "customer._id": req.user._id })
      .then((dbRes) => {
        res.json(dbRes);
      })
      .catch((err) => {
        console.log(err);
        res.status(500).json({ message: "something went wrong" });
      });
  }
);

app.post(
  "/api/createLedgerForStoreUser",
  passport.authenticate("userPrivate"),
  (req, res) => {
    const { amount, paymentMethod, order, transactionId } = req.body;
    Promise.all([
      razorpay.payments.fetch(transactionId),
      Order.findOne({ _id: order, "customer._id": req.user._id }),
    ])
      .then(([razorRes, order]) => {
        if (razorRes && order) {
          new ShopLedger({
            ...req.body,
            type: "collection",
            user: req.user._id,
            note: "store payment", // specific for this route
            product: order,
          })
            .save()
            .then((dbRes) => {
              if (dbRes) {
                return Order.findOneAndUpdate({ _id: order }, { paid: true });
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
                    body: "Payment recieved for an order.",
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
      })
      .catch((err) => {
        console.log(err);
        res.status(500).json({ message: "something went wrong" });
      });
  }
);
app.get(
  "/api/verifyUser/:user/:order",
  passport.authenticate("userPrivate", { failureRedirect: "/login" }),
  (req, res) => {
    if (req.user._id.toString() === req.params.user) {
      Order.findOne({ "customer._id": req.params.user, _id: req.params.order })
        .then((dbRes) => {
          if (dbRes) {
            res.json({ message: "contratulation, this order is yours" });
          } else {
            res.json({ message: "bad request" });
          }
        })
        .catch((err) => {
          console.log(err);
          res.status(500).json({ message: "something went wrong" });
        });
    } else {
      res.status(403).json({ message: "forbidden" });
    }
  }
);

app.post(
  "/api/giveFeedbackToDeliveryStaff",
  passport.authenticate("userPrivate"),
  (req, res) => {
    const { staff, rating, feedback } = req.body;
    const user = req.user._id;
    DeliveryStaff.addFeedback({ staff, rating, user, feedback })
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
  "/api/editFeedbackToDeliveryStaff",
  passport.authenticate("userPrivate"),
  (req, res) => {
    const { staff, rating, feedback } = req.body;
    const user = req.user._id;
    DeliveryStaff.addFeedback({ staff, rating, user, feedback })
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
  "/api/deleteFeedbackToDeliveryStaff",
  passport.authenticate("userPrivate"),
  (req, res) => {
    const { staff } = req.body;
    const user = req.user._id;
    DeliveryStaff.deleteFeedback({ staff, user })
      .then((dbRes) => {
        res.json({ message: "feedback deleted" });
      })
      .catch((err) => {
        console.log(err);
        res.status(500).json({ message: "something went wrong" });
      });
  }
);
